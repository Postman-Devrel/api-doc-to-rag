import prompts from '../constants/prompt.js';
import schemas from '../constants/schema.js';
import { openAIRequest } from '../services/openai.js';
import { logger } from '../utils/logger.js';

async function curlDocsGenerator(screenshot, previousResponseId) {
    try {
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
        logger.debug('Generating curl docs from screenshot');

        const curlDocsResponse = await openAIRequest(
            'o4-mini',
            [],
            context,
            schemas.curl_docs_schema,
            { summary: 'detailed' },
            previousResponseId
        );
        const { output, output_text } = curlDocsResponse;

        logger.debug('Generated curl docs', { output_text });

        return {
            responseId: curlDocsResponse.id,
            curlObj: JSON.parse(output_text),
        };
    } catch (error) {
        logger.error('Failed to generate curl docs', { error: error.message });
        // Return empty structure instead of throwing to allow the loop to continue
        return {
            responseId: previousResponseId,
            curlObj: { curlDocs: [], url: '' },
        };
    }
}

export default curlDocsGenerator;
