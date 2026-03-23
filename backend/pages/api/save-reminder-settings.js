import { getSupabaseClient } from '../../utils/supabaseClient.js';

const VALID_ACTIVITIES = ['weight', 'education', 'breakfast', 'lunch', 'dinner'];

// Default times used as fallback for any missing activity
const DEFAULT_TIMES = {
  weight:    { reminder_hour: 6,  reminder_minute: 45 },
  education: { reminder_hour: 8,  reminder_minute: 45 },
  breakfast: { reminder_hour: 7,  reminder_minute: 45 },
  lunch:     { reminder_hour: 11, reminder_minute: 45 },
  dinner:    { reminder_hour: 18, reminder_minute: 45 },
};

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, cache-control, pragma');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const { userId, reminders } = req.body;

  // --- Validation ---
  if (!userId) {
    res.status(400).json({ success: false, message: 'userId is required' });
    return;
  }

  if (!Array.isArray(reminders) || reminders.length === 0) {
    res.status(400).json({ success: false, message: 'reminders array is required' });
    return;
  }

  for (const r of reminders) {
    if (!VALID_ACTIVITIES.includes(r.activity_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity_type: ' + r.activity_type + '. Must be one of ' + VALID_ACTIVITIES.join(', '),
      });
    }
    if (typeof r.reminder_hour !== 'number' || r.reminder_hour < 0 || r.reminder_hour > 23) {
      return res.status(400).json({ success: false, message: 'reminder_hour must be 0-23' });
    }
    if (typeof r.reminder_minute !== 'number' || r.reminder_minute < 0 || r.reminder_minute > 59) {
      return res.status(400).json({ success: false, message: 'reminder_minute must be 0-59' });
    }
    if (typeof r.is_enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_enabled must be a boolean' });
    }
  }

  try {
    const supabase = getSupabaseClient();

    // Build incoming map
    const incomingMap = {};
    reminders.forEach(r => { incomingMap[r.activity_type] = r; });

    // Pack all 5 activities into a single JSONB object -> 1 row per user
    const remindersJson = {};
    VALID_ACTIVITIES.forEach(activity => {
      const incoming = incomingMap[activity];
      const defaults = DEFAULT_TIMES[activity];
      remindersJson[activity] = {
        hour:    incoming ? incoming.reminder_hour   : defaults.reminder_hour,
        minute:  incoming ? incoming.reminder_minute : defaults.reminder_minute,
        enabled: incoming ? incoming.is_enabled      : true,
      };
    });

    // Upsert single row — INSERT on first save, UPDATE on subsequent saves
    // PascalCase columns require quoted identifiers in Supabase
    const { error } = await supabase
      .from('user_reminders')
      .upsert(
        { UserId: userId, RemindersJson: remindersJson },
        { onConflict: '"UserId"', returning: 'minimal' }
      );

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Saved 1 row (all 5 reminders) for user ' + userId,
      saved: remindersJson,
    });

  } catch (err) {
    console.error('[save-reminder-settings] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to save reminder settings',
      error: err.message,
    });
  }
}
