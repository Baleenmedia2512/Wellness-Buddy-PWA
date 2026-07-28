import { query } from "../utils/dbPool.js";

export async function getDashboard(userId) {

    const [requestLogs] = await query(
        `
        SELECT
            model,
            input_tokens,
            output_tokens,
            api_total_tokens,
            estimated_cost,
            latency_ms,
            created_at
        FROM request_log
        WHERE user_id = ?
          AND status = 'SUCCESS'
        ORDER BY created_at DESC
        LIMIT 10
        `,
        [userId]
    );

    const aiAnalytics = (requestLogs || []).map(log => ({
        model: log.model,
        inputTokens: Number(log.input_tokens || 0),
        outputTokens: Number(log.output_tokens || 0),
        totalTokens: Number(log.api_total_tokens || 0),
        estimatedCost: Number(log.estimated_cost || 0),
        latencyMs: Number(log.latency_ms || 0),
        createdAt: log.created_at,
    }));

    return {
        totalRequests: aiAnalytics.length,
        totalInputTokens: aiAnalytics.reduce((s, i) => s + i.inputTokens, 0),
        totalOutputTokens: aiAnalytics.reduce((s, i) => s + i.outputTokens, 0),
        totalEstimatedCost: aiAnalytics.reduce((s, i) => s + i.estimatedCost, 0),
        aiAnalytics,
    };
}