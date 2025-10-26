import prompts from '../constants/prompt.js';
import { openAIRequest } from '../services/openai.js';
import { logger } from '../utils/logger.js';

async function openApiGenerator(curlDocs) {
    const query = prompts.openapi_gen_prompt;

    const context = [
        { role: 'system', content: query },
        {
            role: 'user',
            content:
                'Generate an OpenAPI definition for the following curl documentation: ' +
                JSON.stringify(curlDocs),
        },
    ];

    logger.info('Generating OpenAPI documentation');

    const response = await openAIRequest('gpt-5', [], context, null, { summary: 'detailed' });
    const { output, output_text } = response;

    logger.debug('OpenAPI generation output', { output });
    logger.info('OpenAPI documentation generated successfully');

    return output_text;
}

export default openApiGenerator;
