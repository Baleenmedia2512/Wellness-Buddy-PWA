import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (uses REST API via HTTPS - not blocked)
const getSupabaseClient = () => {
  return createClient(
    process.env.SUPABASE_URL || 'https://lnvvaeudhtazvxtmifeg.supabase.co',
    process.env.SUPABASE_ANON_KEY
  );
};

export default async function handler(req, res) {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
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
      return res.status(400).json({ 
        success: false, 
        message: 'userId and email are required' 
      });
    }

    if (!operationType || !modelName) {
      return res.status(400).json({ 
        success: false, 
        message: 'operationType and modelName are required' 
      });
    }

    if (inputTokens === undefined || outputTokens === undefined || totalTokens === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Token counts (inputTokens, outputTokens, totalTokens) are required' 
      });
    }

    // Use Supabase REST API (bypasses blocked PostgreSQL ports)
    const supabase = getSupabaseClient();

    // Insert token usage record using Supabase
    // Use exact PascalCase column names as shown in Supabase UI
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

    return res.status(200).json({
      success: true,
      message: 'Token usage saved successfully',
      id: data?.ID || data?.id
    });

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

    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
