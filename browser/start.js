/**
 * This function starts and returns a browser instance
 */

import { chromium } from 'playwright';
import { logger } from '../utils/logger.js';

const browserObject = async () => {
    let browser;
    try {
        logger.info('Launching browser');
        browser = await chromium.launch({
            headless: false,
            chromiumSandbox: true,
            env: {},
            args: ['--disable-extensions', '--disable-file-system'],
        });

        logger.info('Browser launched successfully');
    } catch (err) {
        logger.error('Could not create browser instance', { error: err.message });
        throw err;
    }
    return browser;
};

export default browserObject;
