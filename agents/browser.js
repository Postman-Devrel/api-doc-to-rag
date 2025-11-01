import { openAIRequest } from '../services/openai.js';
import { startBrowser, handleBrowserAction } from '../browser/index.js';
import prompts from '../constants/prompt.js';
import curlDocsGenerator from './curl.js';
import { createResourcesBatch } from '../actions/resources.js';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

import { config } from 'dotenv';
config();

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

const browserAgent = async url => {
    try {
        // load the browser with the API documentation page;
        const { page, browser } = await startBrowser(url);

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

        const curlDocs = await computerUseLoop(page, response, url);

        return { browser, page, curlDocs };
    } catch (error) {
        logger.error('Browser agent failed', { url, error: error.message });
        throw new BrowserError('Failed to start browser automation', error);
    }
};

async function computerUseLoop(pageInstance, response, url) {
    /**
     * Run the loop that executes computer actions until no 'computer_call' is found.
     */
    let curlDocsList = [];
    let curlDocsResponseId = null;

    // Queue to store curl docs generation promises for background processing
    const curlDocsQueue = [];

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
                });
            }

            if (computerCalls.length === 0) {
                logger.info('No more computer calls. Processing queued curl docs generation...');

                // Wait for all queued curl docs to complete
                if (curlDocsQueue.length > 0) {
                    logger.info(
                        `Waiting for ${curlDocsQueue.length} queued curl docs to complete...`
                    );
                    const queuedResults = await Promise.all(curlDocsQueue);

                    // Collect all documents for batch embedding creation
                    const allDocsToEmbed = [];
                    for (const { curlObj } of queuedResults) {
                        curlDocsList.push(curlObj);

                        const { curlDocs } = curlObj;
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

                            // Store structured data along with content for OpenAPI generation
                            allDocsToEmbed.push({
                                content,
                                url,
                                tags: doc.tags,
                                description: doc.description,
                                curlCommand: doc.curl,
                                parameters: doc.parameters, // Store as array of objects
                            });
                        }
                    }

                    // Create all embeddings in parallel
                    if (allDocsToEmbed.length > 0) {
                        logger.info(
                            `Creating embeddings for ${allDocsToEmbed.length} documents in batch...`
                        );
                        await createResourcesBatch(allDocsToEmbed);
                        logger.info('All resources created and embedded successfully');
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

            // Execute the action in the browser
            await handleBrowserAction(pageInstance, action);

            const delay = getDelayForAction(action);
            await new Promise(resolve => setTimeout(resolve, delay));

            // Take an optimized screenshot after the action (reduced resolution for speed)
            const screenshotBase64 = await takeScreenshot(pageInstance);
            const screenshotUrl = `data:image/jpeg;base64,${screenshotBase64}`;

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
            const safetyChecks = response.output.filter(
                item => item.type === 'pending_safety_checks'
            );

            if (safetyChecks.length > 0) {
                logger.warn('Safety checks detected, acknowledging...', safetyChecks);

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
            // const { output, output_text } = response;

            // Queue curl docs generation in background (don't wait for it)
            logger.debug('Queuing curl docs generation for background processing');
            const curlDocsPromise = curlDocsGenerator(screenshotUrl, curlDocsResponseId).then(
                result => {
                    curlDocsResponseId = result.responseId;
                    logger.debug('Curl docs generated in background');
                    return result;
                }
            );

            curlDocsQueue.push(curlDocsPromise);

            // Continue immediately to next browser action without waiting!
        }

        return curlDocsList;
    } catch (error) {
        logger.error('Computer use loop failed', { url, error: error.message });
        throw new BrowserError('Browser automation loop failed', error);
    }
}

export { browserAgent };
