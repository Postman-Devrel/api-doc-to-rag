import prompts from '../constants/prompt.js';
import schemas from '../constants/schema.js';
import { openAIRequest } from '../services/openai.js';

async function curlDocsGenerator(screenshot, previousResponseId) {
    const query = prompts.curl_docs_prompt;

    const context = [
        {
            role: 'user',
            content: [
                { type: 'input_text', text: query },
                { type: 'input_image', image_url: screenshot },
            ],
        },
    ];
    console.log('GENERATING CURL DOCS FROM SCREENSHOT');

    const curlDocsResponse = await openAIRequest(
        'o4-mini',
        [],
        context,
        schemas.curl_docs_schema,
        { summary: 'detailed' },
        previousResponseId
    );
    const { output, output_text } = curlDocsResponse;

    console.log('GENERATED CURL DOCS IS: ', output_text);

    return {
        responseId: curlDocsResponse.id,
        curlObj: JSON.parse(output_text),
    };
}

export default curlDocsGenerator;
