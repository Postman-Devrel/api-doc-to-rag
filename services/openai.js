import OpenAI from 'openai';
import { config } from 'dotenv';
config();

const configuration = {
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.ORGANIZATIONAL_ID,
};

const openai = new OpenAI(configuration);

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
    const response = await openai.responses.create({
        model,
        tools,
        input,
        reasoning,
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
    });

    return response;
};

export { openAIRequest };
