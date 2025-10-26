import { AppError } from '../utils/errors.js';

/**
 * Global error handling middleware
 * @param {Error} err - The error object
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const errorHandler = (err, req, res, next) => {
    // Log error for debugging
    console.error('Error occurred:', {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
    });

    // Handle operational errors (AppError instances)
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.message,
            ...(err.originalError && process.env.NODE_ENV === 'development'
                ? { details: err.originalError.message }
                : {}),
        });
    }

    // Handle validation errors from Zod or other libraries
    if (err.name === 'ZodError') {
        return res.status(400).json({
            error: 'Validation failed',
            details: err.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message,
            })),
        });
    }

    // Handle unexpected errors (programming errors, etc.)
    console.error('Unexpected error:', err);
    return res.status(500).json({
        error: 'An unexpected error occurred',
        ...(process.env.NODE_ENV === 'development' ? { message: err.message } : {}),
    });
};

/**
 * Middleware to handle 404 errors
 */
export const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path,
    });
};

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function that catches errors
 */
export const asyncHandler = fn => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
