import OpenAI from "openai";
import { config } from 'dotenv';
config();

const configuration = {
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.ORGANIZATIONAL_ID
};

const openai = new OpenAI(configuration);

/**
 * @param {string} model 
 * @param {Array<object>} tools 
 * @param {Array<object>} input 
 * @param {object} schema 
 * @param {object} reasoning 
 * @returns {object} response 
*/

const openAIRequest = async (model, tools, input, schema, reasoning = { summary: "concise" }, previous_response_id = null) => {
    const response = await openai.responses.create({
        model, tools, input, reasoning, previous_response_id,
        text: schema ? {
            format: {
                name: schema.name,
                type: schema.type,
                schema: schema.schema,
            }
        } : {},
        truncation: "auto"
    });

    return response;
}


export { openAIRequest };