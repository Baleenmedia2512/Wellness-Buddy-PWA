import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
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

    // Reset approval_requests_table sequence
    const { data: maxApproval, error: approvalError } = await supabase
      .from('approval_requests_table')
      .select('Id')
      .order('Id', { ascending: false })
      .limit(1);

    if (approvalError) {
      results.push({ table: 'approval_requests_table', status: 'error', error: approvalError.message });
    } else {
      const maxId = maxApproval && maxApproval.length > 0 ? maxApproval[0].Id : 0;
      results.push({ table: 'approval_requests_table', maxId, status: 'needs_manual_reset',
        sql: `SELECT setval('approval_requests_table_id_seq', ${maxId});` });
    }

    res.status(200).json({
      success: true,
      message: 'Sequence reset information generated',
      instructions: 'Execute these SQL commands in Supabase SQL Editor to reset sequences',
      results
    });
    return;

  } catch (error) {
    console.error('Error checking sequences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check sequences',
      error: error.message
    });
    return;
  }
}
