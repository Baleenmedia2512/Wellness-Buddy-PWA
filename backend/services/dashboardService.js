import { getPrisma } from '../shared/lib/prisma.js';

export async function getDashboard(userId) {
  const requestLogs = await getPrisma().$queryRaw`
    SELECT
      model,
      input_tokens,
      output_tokens,
      api_total_tokens,
      estimated_cost,
      latency_ms,
      created_at
    FROM request_log
    WHERE user_id = ${userId == null ? '' : String(userId)}
      AND status = 'SUCCESS'
    ORDER BY created_at DESC
    LIMIT 10
  `;

  const aiAnalytics = (requestLogs || []).map((log) => ({
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
    totalInputTokens: aiAnalytics.reduce((sum, item) => sum + item.inputTokens, 0),
    totalOutputTokens: aiAnalytics.reduce((sum, item) => sum + item.outputTokens, 0),
    totalEstimatedCost: aiAnalytics.reduce((sum, item) => sum + item.estimatedCost, 0),
    aiAnalytics,
  };
}
