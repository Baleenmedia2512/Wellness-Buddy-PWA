import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const getSupabaseClient = () => {
  return createClient(
    process.env.SUPABASE_URL || 'https://lnvvaeudhtazvxtmifeg.supabase.co',
    process.env.SUPABASE_ANON_KEY
  );
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseClient();
    const results = [];

    // Reset weight_records_table sequence
    const { data: maxWeight, error: weightError } = await supabase
      .from('weight_records_table')
      .select('ID')
      .order('ID', { ascending: false })
      .limit(1);

    if (weightError) {
      results.push({ table: 'weight_records_table', status: 'error', error: weightError.message });
    } else {
      const maxId = maxWeight && maxWeight.length > 0 ? maxWeight[0].ID : 0;
      results.push({ table: 'weight_records_table', maxId, status: 'needs_manual_reset', 
        sql: `SELECT setval(pg_get_serial_sequence('weight_records_table', 'ID'), ${maxId});` });
    }

    // Reset ai_token_usage_table sequence
    const { data: maxToken, error: tokenError } = await supabase
      .from('ai_token_usage_table')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    if (tokenError) {
      results.push({ table: 'ai_token_usage_table', status: 'error', error: tokenError.message });
    } else {
      const maxId = maxToken && maxToken.length > 0 ? maxToken[0].id : 0;
      results.push({ table: 'ai_token_usage_table', maxId, status: 'needs_manual_reset',
        sql: `SELECT setval(pg_get_serial_sequence('ai_token_usage_table', 'id'), ${maxId});` });
    }

    // Reset food_nutrition_data_table sequence
    const { data: maxFood, error: foodError } = await supabase
      .from('food_nutrition_data_table')
      .select('ID')
      .order('ID', { ascending: false })
      .limit(1);

    if (foodError) {
      results.push({ table: 'food_nutrition_data_table', status: 'error', error: foodError.message });
    } else {
      const maxId = maxFood && maxFood.length > 0 ? maxFood[0].ID : 0;
      results.push({ table: 'food_nutrition_data_table', maxId, status: 'needs_manual_reset',
        sql: `SELECT setval(pg_get_serial_sequence('food_nutrition_data_table', 'ID'), ${maxId});` });
    }

    return res.status(200).json({
      success: true,
      message: 'Sequence reset information generated',
      instructions: 'Execute these SQL commands in Supabase SQL Editor to reset sequences',
      results
    });

  } catch (error) {
    console.error('Error checking sequences:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check sequences',
      error: error.message
    });
  }
}
