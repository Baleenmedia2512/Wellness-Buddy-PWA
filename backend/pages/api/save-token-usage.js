import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const { 
      userId, 
      email, 
      operationType, 
      modelName,
      inputTokens,
      outputTokens,
      totalTokens,
      inputTokenCost,
      outputTokenCost,
      totalTokenCost
    } = req.body;

    // Validate required fields
    if (!userId || !email) {
      res.status(400).json({ 
        success: false, 
        message: 'userId and email are required' 
      });
      return;
    }

    if (!operationType || !modelName) {
      res.status(400).json({ 
        success: false, 
        message: 'operationType and modelName are required' 
      });
      return;
    }

    if (inputTokens === undefined || outputTokens === undefined || totalTokens === undefined) {
      res.status(400).json({ 
        success: false, 
        message: 'Token counts (inputTokens, outputTokens, totalTokens) are required' 
      });
      return;
    }

    // Use Supabase REST API (bypasses blocked PostgreSQL ports)
    const supabase = getSupabaseClient();

    // Insert token usage record using Supabase
    // Use exact PascalCase column names as shown in Supabase UI
    const currentTime = getISTTimestamp();
    const { data, error } = await supabase
      .from('ai_token_usage_table')
      .insert({
        UserId: userId.toString(),
        Email: email,
        OperationType: operationType,
        ModelName: modelName,
        InputTokens: inputTokens || 0,
        OutputTokens: outputTokens || 0,
        TotalTokens: totalTokens || 0,
        InputTokenCost: inputTokenCost || 0,
        OutputTokenCost: outputTokenCost || 0,
        TotalTokenCost: totalTokenCost || 0
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving token usage:', error);
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Token usage saved successfully',
      id: data?.ID || data?.id,
      tokenData: {
        inputTokens: data?.InputTokens || inputTokens || 0,
        outputTokens: data?.OutputTokens || outputTokens || 0,
        totalTokens: data?.TotalTokens || totalTokens || 0,
        inputTokenCost: data?.InputTokenCost || inputTokenCost || 0,
        outputTokenCost: data?.OutputTokenCost || outputTokenCost || 0,
        totalTokenCost: data?.TotalTokenCost || totalTokenCost || 0,
        operationType: data?.OperationType || operationType,
        modelName: data?.ModelName || modelName,
        userId: data?.UserId || userId,
        email: data?.Email || email
      }
    });
    return;

  } catch (error) {
    console.error('❌ Error saving token usage:', error);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);

    // Enhanced error messages for different error types
    let errorMessage = 'Failed to save token usage';
    
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Database connection timeout. Please try again.';
    } else if (error.message?.includes('Connection terminated')) {
      errorMessage = 'Database connection was terminated. Retrying...';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Database connection refused. Please check if database is accessible.';
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
    return;
  }
}
