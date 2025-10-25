import { openAIRequest } from '../services/openai.js';
import { startBrowser, handleBrowserAction } from '../browser/index.js';
import prompts from '../constants/prompt.js';
import curlDocsGenerator from './curl.js';
import { createResource } from '../actions/resources.js';

import { config } from 'dotenv';
config();

const browserAgent = async url => {
    // load the browser with the API documentation page;
    const { page, browser } = await startBrowser(url);

    // get the initial screenshot of the page;
    let initialPageScreenshot = (await page.screenshot()).toString('base64');

    console.log('INITIAL PAGE SCREENSHOT IS: ', initialPageScreenshot.substring(0, 100));

    // define the tools that the agent can use;
    const tools = [
        {
            type: 'computer_use_preview',
            display_width: 1024,
            display_height: 768,
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
    const { output, output_text } = response;
    console.log('OUTPUT IS: ', output);
    console.log('OUTPUT TEXT IS: ', output_text);

    const curlDocs = await computerUseLoop(page, response, url);
    console.log('FINAL RESPONSE IS: ', curlDocs);

    return { browser, page, curlDocs };
};

async function computerUseLoop(pageInstance, response, url) {
    /**
     * Run the loop that executes computer actions until no 'computer_call' is found.
     */
    let curlDocsList = [];
    let curlDocsResponseId = null;
    while (true) {
        const computerCalls = response.output.filter(item => item.type === 'computer_call');

        const reasonings = response.output.filter(item => item.type === 'reasoning');

        if (reasonings.length > 0) {
            console.log('REASONINGS ARE: ', reasonings[0].summary);
        }

        if (computerCalls.length === 0) {
            console.log('No computer call found. Output from model:');
            response.output.forEach(item => {
                console.log('ITEM IS: ', JSON.stringify(item, null, 2));
            });
            break; // Exit when no computer calls are issued.
        }

        // We expect at most one computer call per response.
        const computerCall = computerCalls[0];
        const lastCallId = computerCall.call_id;
        console.log('LAST CALL ID IS: ', lastCallId);
        const action = computerCall.action;

        // Execute the action in the browser
        handleBrowserAction(pageInstance, action);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Allow time for changes to take effect.

        // Take a screenshot after the action
        const screenshotBase64 = (await pageInstance.screenshot()).toString('base64');
        const screenshotUrl = `data:image/png;base64,${screenshotBase64}`;

        // Send the screenshot back as a computer_call_output
        const tools = [
            {
                type: 'computer_use_preview',
                display_width: 1024,
                display_height: 768,
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
        const { output, output_text } = response;
        console.log('OUTPUT IS: ', output);
        console.log('OUTPUT TEXT IS: ', output_text);

        // generate the curl docs
        const { responseId, curlObj } = await curlDocsGenerator(screenshotUrl, curlDocsResponseId);
        curlDocsResponseId = responseId;

        const { curlDocs } = curlObj;

        // Store the curl docs in the vector database and processing each curl doc individually for better semantic search
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
            const resource = await createResource({ content, url });
            console.log('Embeddings created! ');
            console.log('URL Isssss => ', url);
        }

        curlDocsList.push(curlObj);
        console.log('CURL DOCS IS: ', curlObj);
    }

    console.log('CURL DOCS LIST IS: ', curlDocsList);

    return curlDocsList;
}

export { browserAgent };
