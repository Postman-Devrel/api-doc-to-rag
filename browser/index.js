import browserObject from './start.js';
import handleBrowserAction from './action.js';

//Start the browser and create a browser instance
const startBrowser = async url => {
    let browser = await browserObject();
    const page = await browser.newPage();

    // Block unnecessary resources for faster page loads
    await page.route('**/*', route => {
        const resourceType = route.request().resourceType();
        // Block fonts, and media
        if (['font', 'media'].includes(resourceType)) {
            route.abort();
        } else {
            route.continue();
        }
    });

    await page.setViewportSize({
        width: parseInt(process.env.DISPLAY_WIDTH),
        height: parseInt(process.env.DISPLAY_HEIGHT),
    });
    if (url) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(300);
    }

    return {
        browser,
        page,
    };
};

export { startBrowser, handleBrowserAction };
