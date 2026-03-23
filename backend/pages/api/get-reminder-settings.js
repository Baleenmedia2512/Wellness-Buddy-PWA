import { getSupabaseClient } from '../../utils/supabaseClient.js';

// Default reminder settings — returned if user has no record yet
const DEFAULT_REMINDERS = [
  { activity_type: 'weight',    reminder_hour: 6,  reminder_minute: 45, is_enabled: true },
  { activity_type: 'education', reminder_hour: 8,  reminder_minute: 45, is_enabled: true },
  { activity_type: 'breakfast', reminder_hour: 7,  reminder_minute: 45, is_enabled: true },
  { activity_type: 'lunch',     reminder_hour: 11, reminder_minute: 45, is_enabled: true },
  { activity_type: 'dinner',    reminder_hour: 18, reminder_minute: 45, is_enabled: true },
];

// Build default JSON object for first-time users
const buildDefaultJson = () => {
  const json = {};
  DEFAULT_REMINDERS.forEach(r => {
    json[r.activity_type] = {
      hour:    r.reminder_hour,
      minute:  r.reminder_minute,
      enabled: r.is_enabled,
    };
  });
  return json;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const { userId } = req.query;
  if (!userId) {
    res.status(400).json({ success: false, message: 'userId is required' });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    // Fetch single row for this user (PascalCase columns — quoted in Supabase)
    const { data: row, error } = await supabase
      .from('user_reminders')
      .select('"RemindersJson", "UpdatedAt"')
      .eq('"UserId"', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = row not found

    // First-time user — insert 1 default row and return defaults
    if (!row) {
      const defaultJson = buildDefaultJson();

      await supabase
        .from('user_reminders')
        .upsert(
          { UserId: userId, RemindersJson: defaultJson },
          { onConflict: '"UserId"', returning: 'minimal' }
        );

      console.log('[get-reminder-settings] Created 1 default row for new user: ' + userId);

      return res.status(200).json({
        success: true,
        reminders: DEFAULT_REMINDERS,
        isDefault: true,
      });
    }

    // Existing user — parse JSONB back into array format for frontend
    const json = row.RemindersJson || {};
    const reminders = DEFAULT_REMINDERS.map(def => ({
      activity_type:   def.activity_type,
      reminder_hour:   json[def.activity_type]?.hour    ?? def.reminder_hour,
      reminder_minute: json[def.activity_type]?.minute  ?? def.reminder_minute,
      is_enabled:      json[def.activity_type]?.enabled ?? def.is_enabled,
    }));

    return res.status(200).json({
      success: true,
      reminders,
      isDefault: false,
    });

  } catch (err) {
    console.error('[get-reminder-settings] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reminder settings',
      error: err.message,
    });
  }
}
