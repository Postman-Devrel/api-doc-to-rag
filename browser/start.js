/**
 * This function starts and returns a browser instance
 */

import { chromium } from "playwright";

const browserObject = async () => {
	let browser;
	try {
	    console.log("Opening the browser......");
	    browser = await chromium.launch({
            headless: false,
            chromiumSandbox: true,
            env: {},
            args: ["--disable-extensions", "--disable-file-system"],
        });

        console.log("Browser Launched");
	} catch (err) {
	    console.log("Could not create a browser instance => : ", err);
	}
	return browser;
}

export default browserObject;