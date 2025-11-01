/**
 * This function starts and returns a browser instance
 */

import { chromium } from 'playwright';
import { logger } from '../utils/logger.js';

const browserObject = async () => {
    let browser;
    try {
        logger.info('Launching browser...');
        browser = await chromium.launch({
            headless: true, // Headless is faster
            chromiumSandbox: true,
            env: {},
            args: [
                // disbale anything that is not necessary for the browser to work or might make page load even a tad bit slower;
                '--disable-extensions',
                '--disable-file-system',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-breakpad',
                '--disable-component-extensions-with-background-pages',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-default-browser-check',
                '--no-first-run',
                '--password-store=basic',
                '--use-mock-keychain',
            ],
        });

        logger.info('Browser launched successfully');
    } catch (err) {
        logger.error('Could not create browser instance', { error: err.message });
        throw err;
    }
    return browser;
};

export default browserObject;
