import { EventEmitter } from 'events';
import { logger } from './logger.js';

/**
 * Progress event emitter for Server-Sent Events
 * Manages multiple concurrent sessions and broadcasts progress updates
 */
class ProgressEmitter extends EventEmitter {
    constructor() {
        super();
        this.sessions = new Map(); // sessionId -> { response, startTime }
    }

    /**
     * Register a new SSE session
     */
    registerSession(sessionId, response) {
        this.sessions.set(sessionId, {
            response,
            startTime: Date.now(),
        });
        logger.debug('SSE session registered', { sessionId });
    }

    /**
     * Remove a session when client disconnects or process completes
     */
    unregisterSession(sessionId) {
        this.sessions.delete(sessionId);
        logger.debug('SSE session unregistered', { sessionId });
    }

    /**
     * Send event to a specific session
     */
    sendEvent(sessionId, type, data) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            logger.warn('Attempted to send event to non-existent session', { sessionId, type });
            return;
        }

        const event = {
            type,
            timestamp: new Date().toISOString(),
            data,
        };

        try {
            // SSE format: data: {json}\n\n
            session.response.write(`data: ${JSON.stringify(event)}\n\n`);
            logger.debug('SSE event sent', { sessionId, type });
        } catch (error) {
            logger.error('Failed to send SSE event', {
                sessionId,
                type,
                error: error.message,
            });
            this.unregisterSession(sessionId);
        }
    }

    /**
     * Send reasoning event
     */
    sendReasoning(sessionId, summary) {
        this.sendEvent(sessionId, 'reasoning', {
            summary,
        });
    }

    /**
     * Send browser action event
     */
    sendAction(sessionId, action, data) {
        this.sendEvent(sessionId, 'action', {
            action: data.details,
            count: data.actionNumber,
        });
    }

    /**
     * Send completion event
     */
    sendComplete(sessionId, result) {
        this.sendEvent(sessionId, 'complete', result);

        // Close the connection after a short delay
        setTimeout(() => {
            const session = this.sessions.get(sessionId);
            if (session) {
                session.response.end();
                this.unregisterSession(sessionId);
            }
        }, 100);
    }

    /**
     * Send error event
     */
    sendError(sessionId, error) {
        this.sendEvent(sessionId, 'error', {
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });

        // Close the connection after a short delay
        setTimeout(() => {
            const session = this.sessions.get(sessionId);
            if (session) {
                session.response.end();
                this.unregisterSession(sessionId);
            }
        }, 100);
    }

    /**
     * Check if a session exists
     */
    hasSession(sessionId) {
        return this.sessions.has(sessionId);
    }
}

// Singleton instance
const progressEmitter = new ProgressEmitter();

export { progressEmitter };
