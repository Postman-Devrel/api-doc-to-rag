import { openAIRequest } from '../services/openai.js';
import { startBrowser, handleBrowserAction } from '../browser/index.js';
import prompts from '../constants/prompt.js';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { progressEmitter } from '../utils/progress-emitter.js';
import { curlQueue, embeddingsQueue } from '../queue/config.js';
import { resources } from '../db/schema/resources.js';
import { websites } from '../db/schema/websites.js';
import { db } from '../db/index.js';
import { eq } from 'drizzle-orm';

/**
 * Helper function to take optimized screenshots
 * Reduces resolution and quality for faster encoding and transfer
 */
const takeScreenshot = async page => {
    const maxWidth = Math.min(1280, parseInt(process.env.DISPLAY_WIDTH));
    const maxHeight = Math.min(800, parseInt(process.env.DISPLAY_HEIGHT));

    const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 60,
        clip: {
            x: 0,
            y: 0,
            width: maxWidth,
            height: maxHeight,
        },
    });

    return screenshot.toString('base64');
};

/**
 * Get optimal delay time based on action type
 * Different actions need different wait times for content to settle
 */
const getDelayForAction = action => {
    const actionType = action.action;
    switch (actionType) {
        case 'mouse_move':
        case 'screenshot':
            return 100; // Very fast - no page changes
        case 'key':
        case 'type':
            return 200; // Fast - minimal changes
        case 'scroll':
            return 250; // Medium - content loads
        case 'click':
            return 400; // Slower - might trigger navigation/actions
        default:
            return 300; // Reasonable fallback
    }
};

const browserAgent = async (url, sessionId = null) => {
    try {
        // load the browser with the API documentation page;
        const { page, browser } = await startBrowser(url);

        if (sessionId) {
            progressEmitter.sendEvent(sessionId, 'browser_started', { url }, 5);
        }

        // get the initial screenshot of the page (optimized for speed);
        let initialPageScreenshot = await takeScreenshot(page);

        // define the computer use tool;
        const tools = [
            {
                type: 'computer_use_preview',
                display_width: parseInt(process.env.DISPLAY_WIDTH),
                display_height: parseInt(process.env.DISPLAY_HEIGHT),
                environment: 'browser', // other possible values: "mac", "windows", "ubuntu"
            },
        ];

        // define the input that the agent will use;
        const input = [
            {
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: prompts.browser_use_prompt,
                    },
                    {
                        type: 'input_image',
                        image_url: `data:image/jpeg;base64,${initialPageScreenshot}`,
                    },
                ],
            },
        ];

        // make the first request to the agent to get the initial action;
        const response = await openAIRequest('computer-use-preview', tools, input);
        // const { output, output_text } = response;

        const curlDocs = await computerUseLoop(page, response, url, sessionId);

        return { browser, page, curlDocs };
    } catch (error) {
        logger.error('Browser agent failed', { url, error: error.message });
        if (sessionId) {
            progressEmitter.sendError(sessionId, error);
        }
        throw new BrowserError('Failed to start browser automation', error);
    }
};

async function computerUseLoop(pageInstance, response, url, sessionId = null) {
    /**
     * Run the loop that executes computer actions until no 'computer_call' is found.
     */
    let curlDocsList = [];
    let curlDocsResponseId = null;

    // Track queued jobs for curl generation
    const curlJobIds = [];
    let jobIndex = 0;

    let actionCount = 0;

    try {
        while (true) {
            const computerCalls = response.output.filter(item => item.type === 'computer_call');

            const reasonings = response.output.filter(item => item.type === 'reasoning');

            if (reasonings.length > 0) {
                reasonings.forEach((reasoning, index) => {
                    logger.info('AI Agent Reasoning', {
                        step: index + 1,
                        summary: reasoning.summary,
                        content: reasoning.content || 'No detailed content',
                    });

                    // Emit reasoning event to SSE
                    if (sessionId) {
                        progressEmitter.sendReasoning(sessionId, reasoning.summary);
                    }
                });
            }

            if (computerCalls.length === 0) {
                logger.info(
                    'No more computer calls. Waiting for curl generation jobs to complete...'
                );

                // Wait for all curl generation jobs to complete
                if (curlJobIds.length > 0) {
                    logger.info(
                        `Waiting for ${curlJobIds.length} curl generation jobs to complete...`
                    );

                    // Wait for all jobs to complete and get results
                    const jobResults = await Promise.all(
                        curlJobIds.map(async jobId => {
                            const job = await curlQueue.getJob(jobId);
                            await job.waitUntilFinished(curlQueue.events);
                            return job.returnvalue;
                        })
                    );

                    // Collect all documents and create resources
                    const allDocsToEmbed = [];
                    for (const result of jobResults) {
                        if (result.success && result.curlObj) {
                            curlDocsList.push(result.curlObj);

                            const { curlDocs } = result.curlObj;
                            for (const doc of curlDocs) {
                                const contentParts = [
                                    `Tags: ${doc.tags}`,
                                    `Description: ${doc.description}`,
                                    `Curl Command: ${doc.curl}`,
                                    `Parameters: ${doc.parameters
                                        .map(
                                            p =>
                                                `${p.name} (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`
                                        )
                                        .join('; ')}`,
                                ];
                                const content = contentParts.filter(Boolean).join('\n\n');

                                // Store structured data
                                allDocsToEmbed.push({
                                    content,
                                    url,
                                    tags: doc.tags,
                                    description: doc.description,
                                    curlCommand: doc.curl,
                                    parameters: doc.parameters,
                                });
                            }
                        }
                    }

                    // Create resources and queue embeddings generation
                    if (allDocsToEmbed.length > 0) {
                        logger.info(
                            `Creating ${allDocsToEmbed.length} resources and queuing embeddings...`
                        );

                        // Get or create website
                        const websiteName = new URL(url).hostname;
                        let websiteResult = await db
                            .select()
                            .from(websites)
                            .where(eq(websites.url, url))
                            .limit(1);

                        let website;
                        if (websiteResult.length === 0) {
                            [website] = await db
                                .insert(websites)
                                .values({ url, name: websiteName })
                                .returning();
                        } else {
                            website = websiteResult[0];
                        }

                        // Insert resources without embeddings
                        const insertedResources = await db
                            .insert(resources)
                            .values(
                                allDocsToEmbed.map(
                                    ({ content, tags, description, curlCommand, parameters }) => ({
                                        content,
                                        websiteId: website.id,
                                        tags,
                                        description,
                                        curlCommand,
                                        parameters,
                                    })
                                )
                            )
                            .returning();

                        logger.info(`Inserted ${insertedResources.length} resources`);

                        // Queue embeddings generation for each resource
                        const embeddingsJobs = insertedResources.map((resource, idx) =>
                            embeddingsQueue.add(
                                'generate-embeddings',
                                {
                                    resourceId: resource.id,
                                    content: allDocsToEmbed[idx].content,
                                    sessionId,
                                    jobIndex: idx + 1,
                                    totalJobs: insertedResources.length,
                                },
                                {
                                    jobId: `embeddings-${resource.id}`,
                                }
                            )
                        );

                        await Promise.all(embeddingsJobs);
                        logger.info(
                            `Queued ${embeddingsJobs.length} embeddings generation jobs in background`
                        );
                    }
                }

                response.output.forEach(item => {
                    logger.debug('Final response item', { item: JSON.stringify(item, null, 2) });
                });
                break; // Exit when no computer calls are issued.
            }

            // We expect at most one computer call per response.
            const computerCall = computerCalls[0];
            const lastCallId = computerCall.call_id;

            const action = computerCall.action;
            logger.debug('Executing action', { action });

            actionCount++;

            // Emit action event to SSE
            if (sessionId) {
                progressEmitter.sendAction(sessionId, action.action, {
                    actionNumber: actionCount,
                    details: action,
                });
            }

            // Execute the action in the browser
            await handleBrowserAction(pageInstance, action);

            const delay = getDelayForAction(action);
            await new Promise(resolve => setTimeout(resolve, delay));

            // Take an optimized screenshot after the action (reduced resolution for speed)
            const screenshotBase64 = await takeScreenshot(pageInstance);
            const screenshotUrl = `data:image/jpeg;base64,${screenshotBase64}`;

            // Send screenshot to client via SSE
            if (sessionId) {
                progressEmitter.sendScreenshot(sessionId, screenshotBase64);
            }

            // Send the screenshot back as a computer_call_output
            const tools = [
                {
                    type: 'computer_use_preview',
                    display_width: parseInt(process.env.DISPLAY_WIDTH),
                    display_height: parseInt(process.env.DISPLAY_HEIGHT),
                    environment: 'browser',
                },
            ];

            const input = [
                {
                    call_id: lastCallId,
                    type: 'computer_call_output',
                    output: {
                        type: 'input_image',
                        image_url: screenshotUrl,
                    },
                },
            ];

            // Check for safety checks that need acknowledgment

            console.log('response.output', JSON.stringify(response.output, null, 2));
            // Extract pending safety checks from computer_call actions
            const safetyChecks = response.output
                .filter(item => item.type === 'computer_call' && item.pending_safety_checks)
                .flatMap(item => item.pending_safety_checks);

            if (safetyChecks.length > 0) {
                logger.warn(
                    'Safety checks detected, ========================== ================== acknowledging...',
                    safetyChecks
                );

                // Acknowledge all safety checks
                input[0].acknowledged_safety_checks = safetyChecks.map(sc => ({
                    id: sc.call_id,
                    code: sc.code,
                    message: sc.message,
                }));
            }

            response = await openAIRequest(
                'computer-use-preview',
                tools,
                input,
                null,
                { summary: 'concise' },
                response.id
            );

            // Queue curl docs generation in BullMQ (background processing)
            jobIndex++;
            logger.debug('Queuing curl docs generation job to BullMQ', { jobIndex });

            const job = await curlQueue.add(
                'generate-curl-docs',
                {
                    screenshot: screenshotUrl,
                    previousResponseId: curlDocsResponseId,
                    sessionId,
                    jobIndex,
                    totalJobs: jobIndex, // Will update as we go
                },
                {
                    jobId: `curl-${sessionId}-${jobIndex}`,
                }
            );

            curlJobIds.push(job.id);

            // Emit queued event to SSE
            if (sessionId) {
                progressEmitter.sendEvent(sessionId, 'curl_progress', {
                    status: 'queued',
                    current: jobIndex,
                    jobId: job.id,
                });
            }

            logger.debug('Curl generation job queued', { jobId: job.id, jobIndex });
        }

        return curlDocsList;
    } catch (error) {
        logger.error('Computer use loop failed', { url, error: error.message });
        throw new BrowserError('Browser automation loop failed', error);
    }
}

export { browserAgent };
