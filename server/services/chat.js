import { openAIRequest } from './openai.js';
import prompts from '../constants/prompt.js';
import { findRelevantContent } from '../actions/search.js';
import { ExternalAPIError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Chat with documentation using RAG (Retrieval Augmented Generation)
 * @param {string} message - User's question
 * @param {string} url - Website URL to search documentation from
 * @param {number} limit - Number of relevant documents to retrieve
 * @param {string|null} previousResponseId - Previous response ID for conversation continuity
 * @returns {Promise<{response: string, sources: Array, responseId: string}>}
 */
export const chatWithDocumentation = async (message, url, limit = 4, previousResponseId = null) => {
    try {
        // Search for relevant documentation
        const searchResults = await findRelevantContent(message, url, limit);
        console.log('Search results::', searchResults);

        if (!searchResults || searchResults.length === 0) {
            return {
                response:
                    "I don't have any documentation available yet. Please wait for the scraping to complete or try a different question.",
                sources: [],
                responseId: null,
            };
        }

        // Build context from search results
        const context = searchResults
            .map((result, idx) => {
                const parts = [];
                if (result.tags) parts.push(`Tags: ${result.tags}`);
                if (result.description) parts.push(`Description: ${result.description}`);
                if (result.curlCommand) parts.push(`cURL: ${result.curlCommand}`);
                if (result.content) parts.push(`Content: ${result.content}`);
                return `[Source ${idx + 1}]\n${parts.join('\n')}`;
            })
            .join('\n\n');

        // Get system prompt with context - only for first message
        const messages = [];
        if (!previousResponseId) {
            // First message in conversation - include system prompt with context
            const systemPrompt = prompts.chat_rag_prompt(context);
            messages.push({ role: 'system', content: systemPrompt });
        }

        // Add user message
        messages.push({ role: 'user', content: message });

        const response = await openAIRequest(
            'gpt-4o-mini',
            [], // No tools needed for chat
            messages,
            null, // No structured output schema
            undefined, // No reasoning parameter for gpt-4o-mini
            previousResponseId // Pass previous response ID - Responses API handles conversation state
        );

        console.log('Responses API output:', response);

        // Log the full response for debugging
        logger.debug('Responses API output', {
            responseId: response.id,
            outputTypes: response.output.map(o => o.type),
            fullOutput: JSON.stringify(response.output),
        });

        // Extract text response from output
        const textOutput = response.output_text;

        if (!textOutput) {
            logger.error('No text output in Responses API response', {
                responseId: response.id,
                output: response.output,
                outputTypes: response.output.map(o => o.type),
            });
            throw new Error('No text response generated from AI');
        }

        logger.info('Chat response generated', {
            url,
            messageLength: message.length,
            responseLength: textOutput.length,
            sourcesCount: searchResults.length,
            responseId: response.id,
            hasPreviousContext: !!previousResponseId,
        });

        return {
            response: textOutput,
            sources: searchResults.map(r => ({
                tags: r.tags,
                description: r.description?.substring(0, 100),
            })),
            responseId: response.id, // Return response ID for next message
        };
    } catch (error) {
        logger.error('Chat with documentation failed', {
            message,
            url,
            error: error.message,
            stack: error.stack,
        });
        throw new ExternalAPIError('Chat Service', error.message, error);
    }
};
