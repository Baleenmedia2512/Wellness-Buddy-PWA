package com.wellnessvalley.app.services;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * AlarmDismissReceiver
 *
 * Handles two actions from the alarm notification:
 *   ACTION_DISMISS → stops AlarmSoundService completely
 *   ACTION_SNOOZE  → stops AlarmSoundService and reschedules it in 5 minutes
 *
 * Registered in AndroidManifest.xml (exported=false).
 */
public class AlarmDismissReceiver extends BroadcastReceiver {

    private static final String TAG = "AlarmDismissReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;

        Intent serviceIntent = new Intent(context, AlarmSoundService.class);

        if (AlarmSoundService.ACTION_SNOOZE.equals(action)) {
            Log.d(TAG, "� Snooze tapped — forwarding to AlarmSoundService");
            serviceIntent.setAction(AlarmSoundService.ACTION_SNOOZE);
            // Pass title/message so the snoozed alarm notification shows the same text
            String title   = intent.getStringExtra(AlarmSoundService.EXTRA_TITLE);
            String message = intent.getStringExtra(AlarmSoundService.EXTRA_MESSAGE);
            if (title   != null) serviceIntent.putExtra(AlarmSoundService.EXTRA_TITLE,   title);
            if (message != null) serviceIntent.putExtra(AlarmSoundService.EXTRA_MESSAGE, message);
        } else {
            // Default: dismiss
            Log.d(TAG, "🔕 Dismiss tapped — stopping AlarmSoundService");
            serviceIntent.setAction(AlarmSoundService.ACTION_DISMISS);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}
