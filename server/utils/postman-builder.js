import { logger } from './logger.js';
import pkg from 'curl-to-postmanv2';
const { validate, convert } = pkg;

/**
 * Generate a unique key for a request to detect duplicates
 */
function generateRequestKey(request) {
    try {
        // Extract key components
        const method = request.method?.toUpperCase() || 'GET';

        // Build URL string
        let urlString = '';
        if (request.url) {
            if (typeof request.url === 'string') {
                urlString = request.url;
            } else if (request.url.raw) {
                urlString = request.url.raw;
            } else {
                // Construct from parts
                const protocol = request.url.protocol || 'https';
                const host = Array.isArray(request.url.host)
                    ? request.url.host.join('.')
                    : request.url.host || '';
                const path = Array.isArray(request.url.path)
                    ? '/' + request.url.path.join('/')
                    : request.url.path || '';
                urlString = `${protocol}://${host}${path}`;
            }
        }

        // Normalize body (sort keys for consistent comparison)
        let bodyString = '';
        if (request.body) {
            if (request.body.raw) {
                try {
                    const parsed = JSON.parse(request.body.raw);
                    bodyString = JSON.stringify(parsed, Object.keys(parsed).sort());
                } catch {
                    bodyString = request.body.raw;
                }
            } else if (request.body.formdata || request.body.urlencoded) {
                const data = request.body.formdata || request.body.urlencoded;
                bodyString = JSON.stringify(data.sort((a, b) => a.key.localeCompare(b.key)));
            }
        }

        // Create unique key
        return `${method}::${urlString}::${bodyString}`;
    } catch (error) {
        // If we can't generate a key, return a random one to avoid false duplicates
        logger.warn('Failed to generate request key', { error: error.message });
        return `UNIQUE_${Date.now()}_${Math.random()}`;
    }
}

/**
 * Remove markdown heading formatting from text
 */
function cleanMarkdownHeadings(text) {
    if (!text) return text;
    // Remove markdown headings (###, ##, #) and trim whitespace
    return text.replace(/^#{1,6}\s+/, '').trim();
}

/**
 * Convert a single curl command to a Postman request
 */
function convertCurlToPostmanRequest(curlCommand) {
    return new Promise((resolve, reject) => {
        // Validate the curl command first
        const validationResult = validate(curlCommand);
        if (!validationResult.result) {
            reject(new Error('Invalid curl command'));
            return;
        }

        try {
            // Call convert with only 2 parameters: input and callback
            convert({ type: 'string', data: curlCommand }, (error, result) => {
                if (error) {
                    reject(new Error(error));
                    return;
                }

                if (!result || !result.result || !result.output || result.output.length === 0) {
                    reject(new Error('No output from curl conversion'));
                    return;
                }

                const output = result.output[0];

                // Check if output type is 'collection' or 'request'
                if (output.type === 'request') {
                    resolve(output.data);
                } else if (output.type === 'collection') {
                    const request = output.data.item?.[0]?.request;
                    if (!request) {
                        reject(new Error('No request found in converted collection'));
                        return;
                    }
                    resolve(request);
                } else {
                    reject(new Error('Unexpected output type from curl conversion'));
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Build a Postman Collection v2.1 from structured documentation
 */
export async function buildPostmanCollection(structuredDocs, websiteUrl) {
    try {
        logger.info('Building Postman collection', { docCount: structuredDocs.length });

        // Initialize Postman Collection v2.1 structure
        const collection = {
            info: {
                name: `API Documentation - ${new URL(websiteUrl).hostname}`,
                description: `Generated from ${websiteUrl}`,
                schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
            },
            item: [],
        };

        // Track conversion results
        const conversionReport = {
            total: structuredDocs.length,
            successful: 0,
            failed: 0,
            duplicates: 0,
            errors: [],
        };

        // Group requests by tags (folders)
        const requestsByTag = new Map();

        // Track seen requests to avoid duplicates (full request comparison)
        const seenRequests = new Set();

        // Track seen method + name combinations to avoid duplicate operations
        const seenMethodNames = new Set();

        // Track descriptions that need to be prepended to the next valid request
        let pendingDescriptions = [];

        // Process each structured document
        for (let i = 0; i < structuredDocs.length; i++) {
            const doc = structuredDocs[i];

            logger.debug(`Processing resource ${i + 1}`, {
                tags: doc.tags,
                hasDescription: !!doc.description,
                hasCurlCommand: !!doc.curlCommand,
                parameterCount: doc.parameters?.length || 0,
            });

            try {
                if (!doc.curlCommand) {
                    logger.warn(`Resource ${i + 1} has no curl command, will merge with next`, {
                        tags: doc.tags,
                    });
                    // Store the description to prepend to the next valid request
                    if (doc.description) {
                        pendingDescriptions.push(doc.description);
                    }
                    continue; // Skip to next resource
                }

                // Convert curl to Postman request
                const request = await convertCurlToPostmanRequest(doc.curlCommand);

                // Check for full request duplicates (same URL, method, body)
                const requestKey = generateRequestKey(request);
                if (seenRequests.has(requestKey)) {
                    conversionReport.duplicates++;
                    logger.debug(`Skipping duplicate request ${i + 1}`, {
                        name: doc.description?.split('\n')[0],
                        tags: doc.tags,
                    });
                    // Add description to pending if it provides additional context
                    if (doc.description && pendingDescriptions.length === 0) {
                        pendingDescriptions.push(doc.description);
                    }
                    continue; // Skip this duplicate
                }

                // Check for method + name duplicates (same operation name)
                const requestName =
                    cleanMarkdownHeadings(doc.description?.split('\n')[0]) || `Request ${i + 1}`;
                const method = request.method?.toUpperCase() || 'GET';
                const methodNameKey = `${method}::${requestName}`;

                if (seenMethodNames.has(methodNameKey)) {
                    conversionReport.duplicates++;
                    logger.debug(`Skipping duplicate request ${i + 1} (method+name match)`, {
                        method,
                        name: requestName,
                        tags: doc.tags,
                    });
                    // Add description to pending if it provides additional context
                    if (doc.description && pendingDescriptions.length === 0) {
                        pendingDescriptions.push(doc.description);
                    }
                    continue; // Skip this duplicate
                }

                // Mark this request as seen
                seenRequests.add(requestKey);
                seenMethodNames.add(methodNameKey);

                // Combine pending descriptions with current description
                let finalDescription = doc.description || '';
                if (pendingDescriptions.length > 0) {
                    finalDescription = pendingDescriptions.join('\n\n') + '\n\n' + finalDescription;
                    logger.debug(
                        `Merged ${pendingDescriptions.length} pending description(s) to resource ${i + 1}`
                    );
                    pendingDescriptions = []; // Clear pending descriptions
                }

                // Create the Postman item
                const item = {
                    name: requestName,
                    request: {
                        ...request,
                        description: finalDescription,
                    },
                };

                // Group by tag (folder)
                const tag = doc.tags || 'Uncategorized';
                if (!requestsByTag.has(tag)) {
                    requestsByTag.set(tag, []);
                }
                requestsByTag.get(tag).push(item);

                conversionReport.successful++;
                logger.debug(`Successfully converted resource ${i + 1}`, {
                    name: item.name,
                    method: request.method,
                    tags: tag,
                });
            } catch (error) {
                conversionReport.failed++;
                const errorDetail = {
                    index: i + 1,
                    tags: doc.tags,
                    description: doc.description?.substring(0, 100),
                    error: error.message,
                    curlPreview: doc.curlCommand?.substring(0, 100),
                };
                conversionReport.errors.push(errorDetail);

                logger.error(`Failed to convert resource ${i + 1}`, errorDetail);

                // Add description to pending if this resource failed
                if (doc.description) {
                    pendingDescriptions.push(doc.description);
                }
            }
        }

        // Handle any remaining pending descriptions
        if (pendingDescriptions.length > 0) {
            logger.warn(
                `${pendingDescriptions.length} description(s) at the end had no valid curl to attach to`
            );
        }

        // Convert grouped requests to folders
        for (const [tag, requests] of requestsByTag.entries()) {
            collection.item.push({
                name: tag,
                item: requests,
            });
        }

        // Log conversion report
        logger.info('Postman collection built', {
            totalResources: conversionReport.total,
            successful: conversionReport.successful,
            duplicates: conversionReport.duplicates,
            failed: conversionReport.failed,
            folderCount: collection.item.length,
            totalRequests: conversionReport.successful,
        });

        if (conversionReport.failed > 0) {
            logger.warn('Some resources failed to convert', {
                failedCount: conversionReport.failed,
                errors: conversionReport.errors,
            });
        }

        return {
            collection,
            conversionReport,
        };
    } catch (error) {
        logger.error('Failed to build Postman collection', { error: error.message });
        throw error;
    }
}
