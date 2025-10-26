import browserObject from './start.js';
import handleBrowserAction from './action.js';

//Start the browser and create a browser instance
const startBrowser = async url => {
    let browser = await browserObject();
    const page = await browser.newPage();
    await page.setViewportSize({
        width: parseInt(process.env.DISPLAY_WIDTH),
        height: parseInt(process.env.DISPLAY_HEIGHT),
    });
    if (url) {
        await page.goto(url);

        // Make sure the page is done loading
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
    }

    return {
        browser,
        page,
    };
};

export { startBrowser, handleBrowserAction };
