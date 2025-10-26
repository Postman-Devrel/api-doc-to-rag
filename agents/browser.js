import { openAIRequest } from '../services/openai.js';
import { startBrowser, handleBrowserAction } from '../browser/index.js';
import prompts from '../constants/prompt.js';
import curlDocsGenerator from './curl.js';
import { createResource } from '../actions/resources.js';
import { BrowserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

import { config } from 'dotenv';
config();

const browserAgent = async url => {
    try {
        // load the browser with the API documentation page;
        const { page, browser } = await startBrowser(url);

        // get the initial screenshot of the page;
        let initialPageScreenshot = (await page.screenshot()).toString('base64');

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
                        image_url: `data:image/png;base64,${initialPageScreenshot}`,
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

    try {
        while (true) {
            const computerCalls = response.output.filter(item => item.type === 'computer_call');

            const reasonings = response.output.filter(item => item.type === 'reasoning');

            if (reasonings.length > 0) {
                logger.debug('AI reasoning', { summary: reasonings[0].summary });
            }

            if (computerCalls.length === 0) {
                logger.info('No more computer calls. Finished browsing web page.');
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
            await new Promise(resolve => setTimeout(resolve, 1000)); // Allow time for changes to take effect.

            // Take a screenshot after the action
            const screenshotBase64 = (await pageInstance.screenshot()).toString('base64');
            const screenshotUrl = `data:image/png;base64,${screenshotBase64}`;

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
            response = await openAIRequest(
                'computer-use-preview',
                tools,
                input,
                null,
                { summary: 'concise' },
                response.id
            );
            // const { output, output_text } = response;

            // generate the curl docs
            const { responseId, curlObj } = await curlDocsGenerator(
                screenshotUrl,
                curlDocsResponseId
            );
            curlDocsResponseId = responseId;

            const { curlDocs } = curlObj;

            // Store the curl docs in the vector database and process each curl doc individually for better semantic search
            for (const doc of curlDocs) {
                // Extract meaningful text content
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

                // Store in the resources table and create embeddings
                await createResource({ content, url });
                logger.info('Resource created and embedded');
            }

            curlDocsList.push(curlObj);
        }

        return curlDocsList;
    } catch (error) {
        logger.error('Computer use loop failed', { url, error: error.message });
        throw new BrowserError('Browser automation loop failed', error);
    }
}

export { browserAgent };
