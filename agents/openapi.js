import prompts from "../constants/prompt.js";
import { openAIRequest } from "../services/openai.js";

async function openApiGenerator(curlDocs) {
    const query = prompts.openapi_gen_prompt;

    const context = [
        { role: 'system', content: query },
        { role: 'user', content: 'Generate an OpenAPI definition for the following curl documentation: ' + JSON.stringify(curlDocs) }
    ];

    console.log("GENERATING OPEN API Documentation......");

    const response = await openAIRequest("gpt-5", [], context, null, { summary: "detailed" });
    const { output, output_text } = response;
    
    console.log("CURL DOCS OUTPUT is: ", output);
    console.log("GENERATED OPEN API DOCUMENTATION IS: ", output_text);

    return output_text;
}

export default openApiGenerator;