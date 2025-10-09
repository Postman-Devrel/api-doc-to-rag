import { config } from 'dotenv';
import { browserAgent } from './agents/browser.js';
import openApiGenerator from './agents/openapi.js';
config();

// import start from './controller.js';

(async () => {
    try {
        // const { page, browser } = await startBrowser("https://docs.lu.ma/");
        // console.log('Browser started and navigated to page');

        const curlDocs = await browserAgent("https://docs.lu.ma/");
        
        // Generate OpenAPI documentation
        const openApi = await openApiGenerator(curlDocs);
        console.log("OPEN API IS: ", openApi);
        
        // Don't forget to close the browser when done
        // await browser.close();
    } catch (error) {
        console.error('Error starting browser:', error);
    }
})()

const port = process.env.PORT || 3000;