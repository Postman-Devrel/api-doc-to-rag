import OpenAI from 'openai';
import { ExternalAPIError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

let openai;

// Lazy initialization of OpenAI client
const getOpenAIClient = () => {
    if (!openai) {
        const configuration = {
            apiKey: process.env.OPENAI_API_KEY,
            organization: process.env.ORGANIZATIONAL_ID,
        };
        openai = new OpenAI(configuration);
    }
    return openai;
};

/**
 * Makes a request to OpenAI's responses API
 * @param {string} model - The model identifier to use
 * @param {Array<object>} tools - Array of tool definitions
 * @param {Array<{role: string, content: string}>} input - Array of input messages
 * @param {object|null} schema - Optional schema for structured output with name, type, and schema properties
 * @param {object} [reasoning={ summary: 'concise' }] - Reasoning configuration object
 * @param {string|null} [previous_response_id=null] - Optional ID of previous response for continuation
 * @returns {Promise<object>} The OpenAI API response object
 */

const openAIRequest = async (
    model,
    tools,
    input,
    schema,
    reasoning = { summary: 'concise' },
    previous_response_id = null
) => {
    try {
        const openai = getOpenAIClient();

        // Only include reasoning parameter for reasoning models (o1, o4 series, and computer-use models)
        const isReasoningModel =
            model.startsWith('o1') || model.startsWith('o4') || model.includes('computer-use');

        const requestParams = {
            model,
            tools,
            input,
            previous_response_id,
            text: schema
                ? {
                      format: {
                          name: schema.name,
                          type: schema.type,
                          schema: schema.schema,
                      },
                  }
                : {},
            truncation: 'auto',
        };

        // Only add reasoning parameter for reasoning models
        if (isReasoningModel) {
            requestParams.reasoning = reasoning;
        }

        const response = await openai.responses.create(requestParams);

        return response;
    } catch (error) {
        logger.error('OpenAI API request failed', {
            model,
            error: error.message,
            status: error.status,
        });
        throw new ExternalAPIError('OpenAI', error.message, error);
    }
};

export { openAIRequest };
