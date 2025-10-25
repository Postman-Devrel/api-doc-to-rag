import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { startBrowser, handleBrowserAction } from '../browser/index.js';
import { config } from 'dotenv';
config();

const browserAgent = async url => {
    // load the browser with the API documentation page;
    const { page, browser } = await startBrowser(url);

    // get the initial screenshot of the page;
    let initialPageScreenshot = (await page.screenshot()).toString('base64');

    const computerTool = anthropic.tools.computer_20250124({
        displayWidthPx: 1920,
        displayHeightPx: 1080,
        execute: async actionData => {
            switch (actionData.action) {
                case 'screenshot': {
                    return {
                        type: 'image',
                        data: getScreenshot(page),
                    };
                }
                default: {
                    return handleBrowserAction(page, actionData);
                }
            }
        },
        toModelOutput(result) {
            console.log('RESULT IS: ', result);
            return typeof result === 'string'
                ? [{ type: 'text', text: result }]
                : [{ type: 'image', data: result.data, mediaType: 'image/png' }];
        },
    });

    const result = await generateText({
        model: anthropic('claude-sonnet-4-20250514'),
        prompt: 'Read the first three pages of website',
        tools: { computer: computerTool },
    });

    console.log('RESULT TEXT IS: ', result.text);

    return { page, browser, initialPageScreenshot };
};

const getScreenshot = async page => {
    return (await page.screenshot()).toString('base64');
};

browserAgent('https://vercel.com/');
