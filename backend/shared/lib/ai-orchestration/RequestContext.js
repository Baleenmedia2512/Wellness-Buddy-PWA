import crypto from "crypto";

export function createRequestContext({
    userId = null,
    endpoint = null,
    operation = null,
} = {}) {
    return {
        requestId: crypto.randomUUID(),
        userId,
        endpoint,
        operation,
        startedAt: Date.now(),
    };
}