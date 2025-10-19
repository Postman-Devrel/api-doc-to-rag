import { config } from 'dotenv';
import { browserAgent } from './agents/browser.js';
import openApiGenerator from './agents/openapi.js';
import { writeFile } from 'fs/promises';

config();

(async () => {
    try {
        // const { page, browser } = await startBrowser("https://docs.lu.ma/");
        // console.log('Browser started and navigated to page');

        const {curlDocs, page, browser} = await browserAgent("https://docs.lu.ma/");

        page.close();
        console.log('Page closed');
        browser.close();
        console.log('Browser closed');
        
        // Generate OpenAPI documentation
        const openApi = await openApiGenerator(curlDocs);
        console.log("OPEN API IS: ", openApi);
        // Write the context to a text file
        await writeFile('openapi.json', openApi);
        console.log("openapi written to openapi.json");
        
        
        // Don't forget to close the browser when done
        // await browser.close();
    } catch (error) {
        console.error('Error starting browser:', error);
    }
})()