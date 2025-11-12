import { openAIRequest } from '../services/openai.js';
import { startBrowser, handleBrowserAction } from '../browser/index.js';
import prompts from '../constants/prompt.js';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { progressEmitter } from '../utils/progress-emitter.js';
import { curlQueue, curlQueueEvents, embeddingsQueue } from '../queue/config.js';
import { createResourcesWithoutEmbeddings } from '../actions/resources.js';

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
                logger.info('No more computer calls. Waiting for remaining curl jobs...');

                // Wait for any remaining curl jobs to complete
                if (curlJobIds.length > 0) {
                    logger.info(`Waiting for ${curlJobIds.length} remaining curl jobs...`);

                    const jobResults = await Promise.all(
                        curlJobIds.map(async jobId => {
                            try {
                                const job = await curlQueue.getJob(jobId);
                                if (!job) {
                                    logger.warn(`Job ${jobId} not found in queue`);
                                    return null;
                                }

                                const result = await job.waitUntilFinished(curlQueueEvents);
                                return result;
                            } catch (error) {
                                logger.error(`Error waiting for job ${jobId}`, {
                                    error: error.message,
                                });
                                return null;
                            }
                        })
                    );

                    // Collect results for final curlDocsList
                    for (const result of jobResults) {
                        if (result && result.success && result.curlObj) {
                            curlDocsList.push(result.curlObj);
                        }
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
                // The API expects each check to have: id, code, message
                input[0].acknowledged_safety_checks = safetyChecks.map(sc => ({
                    id: sc.id, // Use sc.id, not sc.call_id
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
                    jobIndex,
                    totalJobs: jobIndex, // Will update as we go
                },
                {
                    jobId: `curl-${sessionId || 'no-session'}-${jobIndex}`,
                }
            );

            curlJobIds.push(job.id);

            logger.debug('Curl generation job queued', { jobId: job.id, jobIndex });

            // Process this curl job in the background - create resources & queue embeddings as soon as it completes
            job.waitUntilFinished(curlQueueEvents)
                .then(async result => {
                    if (result.success && result.curlObj) {
                        const { curlDocs } = result.curlObj;

                        if (curlDocs && curlDocs.length > 0) {
                            logger.info(
                                `Curl job ${job.id} completed, creating ${curlDocs.length} resources...`
                            );

                            // Build resource data
                            const docsToEmbed = curlDocs.map(doc => {
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
                                return {
                                    content: contentParts.filter(Boolean).join('\n\n'),
                                    url,
                                    tags: doc.tags,
                                    description: doc.description,
                                    curlCommand: doc.curl,
                                    parameters: doc.parameters,
                                };
                            });

                            // Create resources immediately
                            const insertedResources =
                                await createResourcesWithoutEmbeddings(docsToEmbed);

                            logger.info(
                                `Created ${insertedResources.length} resources, queuing embeddings...`
                            );

                            // Queue embeddings for these resources immediately
                            const embeddingsJobs = insertedResources.map((resource, idx) =>
                                embeddingsQueue.add(
                                    'generate-embeddings',
                                    {
                                        resourceId: resource.id,
                                        content: docsToEmbed[idx].content,
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
                                `Queued ${embeddingsJobs.length} embeddings for curl job ${job.id}`
                            );
                        }
                    }
                })
                .catch(err => {
                    logger.error(`Failed to process completed curl job ${job.id}`, {
                        error: err.message,
                    });
                });
        }

        return curlDocsList;
    } catch (error) {
        logger.error('Computer use loop failed', { url, error: error.message });
        throw new BrowserError('Browser automation loop failed', error);
    }
}

export { browserAgent };
