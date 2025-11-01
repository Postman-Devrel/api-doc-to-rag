import prompts from '../constants/prompt.js';
import { openAIRequest } from '../services/openai.js';
import { logger } from '../utils/logger.js';

async function postmanCollectionGenerator(structuredDocs, websiteUrl) {
    const query = prompts.postman_collection_gen_prompt;

    // Format the structured documentation for the LLM
    const formattedDocs = structuredDocs.map(doc => ({
        tags: doc.tags,
        description: doc.description,
        curlCommand: doc.curlCommand,
        parameters: doc.parameters,
    }));

    const context = [
        { role: 'system', content: query },
        {
            role: 'user',
            content:
                `Generate a Postman Collection v2.1 for the following API documentation from ${websiteUrl}. Each endpoint has structured data with tags, description, curl command, and parameters:\n\n` +
                JSON.stringify(formattedDocs, null, 2),
        },
    ];

    logger.info('Generating Postman collection using AI', { docCount: structuredDocs.length });

    const response = await openAIRequest('gpt-5', [], context, null, { summary: 'detailed' });
    const { output, output_text } = response;

    logger.debug('AI collection generation output received');

    // Try to parse the output as JSON
    let collection;
    try {
        collection = JSON.parse(output_text);
        logger.info('Postman collection generated successfully via AI');
    } catch (error) {
        logger.error('Failed to parse AI-generated collection as JSON', {
            error: error.message,
        });
        throw new Error('AI generated invalid JSON for collection');
    }

    return collection;
}

export default postmanCollectionGenerator;
