/**
 * Base error class for application-specific errors
 */
export class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error for validation failures (400)
 */
export class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}

/**
 * Error for resource not found (404)
 */
export class NotFoundError extends AppError {
    constructor(resource, identifier) {
        super(`${resource} not found: ${identifier}`, 404);
    }
}

/**
 * Error for browser automation failures
 */
export class BrowserError extends AppError {
    constructor(message, originalError = null) {
        super(`Browser automation failed: ${message}`, 500);
        this.originalError = originalError;
    }
}

/**
 * Error for database operations
 */
export class DatabaseError extends AppError {
    constructor(message, originalError = null) {
        super(`Database operation failed: ${message}`, 500);
        this.originalError = originalError;
    }
}

/**
 * Error for external API calls
 */
export class ExternalAPIError extends AppError {
    constructor(service, message, originalError = null) {
        super(`${service} API error: ${message}`, 502);
        this.service = service;
        this.originalError = originalError;
    }
}

/**
 * Error for embedding generation failures
 */
export class EmbeddingError extends AppError {
    constructor(message, originalError = null) {
        super(`Embedding generation failed: ${message}`, 500);
        this.originalError = originalError;
    }
}
