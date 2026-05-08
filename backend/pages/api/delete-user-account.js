import { getSupabaseClient } from '../../utils/supabaseClient.js';

export default async function handler(req, res) {
  console.log('🔴 [delete-user-account] Request received:', { method: req.method });

  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Missing required field: email' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  console.log('🗑️ [delete-user-account] Deleting account for:', normalizedEmail);

  try {
    const supabase = getSupabaseClient();

    // Step 1: Resolve UserId from email
    const { data: user, error: userError } = await supabase
      .from('team_table')
      .select('"UserId"')
      .ilike('Email', normalizedEmail)
      .maybeSingle();

    if (userError) {
      console.error('❌ [delete-user-account] Failed to find user:', userError);
      throw new Error(userError.message);
    }

    if (!user) {
      console.log('⚠️ [delete-user-account] User not found:', normalizedEmail);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userId = user.UserId;
    console.log('✅ [delete-user-account] Found userId:', userId);

    const deletions = [];

    // Step 2: Delete all user data in parallel (non-critical tables first)
    const [
      foodResult,
      weightResult,
      educationResult,
      stepResult,
      tokenResult,
      universityResult,
      counsellingResult,
      otpResult,
    ] = await Promise.allSettled([
      supabase.from('food_nutrition_data_table').delete().eq('UserId', userId),
      supabase.from('weight_records_table').delete().eq('UserId', userId),
      supabase.from('education_logs_table').delete().eq('UserId', userId),
      supabase.from('daily_step_activity').delete().eq('UserId', userId),
      supabase.from('ai_token_usage_table').delete().eq('UserId', userId),
      supabase.from('wellness_university_enrollments_table').delete().eq('UserId', userId),
      supabase.from('wellness_counselling_assessments').delete().eq('UserId', userId),
      supabase.from('otp_tokens_table').delete().ilike('recipient', normalizedEmail),
    ]);

    // Log results
    const tableResults = {
      food_nutrition_data_table: foodResult,
      weight_records_table: weightResult,
      education_logs_table: educationResult,
      daily_step_activity: stepResult,
      ai_token_usage_table: tokenResult,
      wellness_university_enrollments_table: universityResult,
      wellness_counselling_assessments: counsellingResult,
      otp_tokens_table: otpResult,
    };

    for (const [table, result] of Object.entries(tableResults)) {
      if (result.status === 'rejected' || result.value?.error) {
        console.warn(`⚠️ [delete-user-account] Non-critical deletion failed for ${table}:`, result.value?.error || result.reason);
      } else {
        console.log(`✅ [delete-user-account] Deleted from ${table}`);
      }
    }

    // Step 3: Delete the user from team_table (primary record — must succeed)
    const { error: teamDeleteError } = await supabase
      .from('team_table')
      .delete()
      .eq('UserId', userId);

    if (teamDeleteError) {
      console.error('❌ [delete-user-account] Failed to delete from team_table:', teamDeleteError);
      throw new Error('Failed to delete user account: ' + teamDeleteError.message);
    }

    console.log('✅ [delete-user-account] Successfully deleted user account:', normalizedEmail);

    return res.status(200).json({
      success: true,
      message: 'Account and all associated data have been permanently deleted.',
    });

  } catch (err) {
    console.error('❌ [delete-user-account] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting the account. Please try again.',
    });
  }
}
