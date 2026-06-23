package com.wellnessvalley.app.services;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.wellnessvalley.app.R;
import com.wellnessvalley.app.plugins.ReminderPlugin;

/**
 * AlarmFullScreenActivity
 *
 * A full-screen Activity that pops up ON TOP of the lock screen when an activity reminder fires.
 * - Turns on the screen automatically (even when locked)
 * - Shows the alarm title, message, Snooze and Dismiss buttons
 * - Closes itself when:
 *     (a) user taps Snooze or Dismiss
 *     (b) receives the ACTION_CLOSE_ALARM broadcast (sent by AlarmSoundService on stop/snooze)
 *
 * Declared in AndroidManifest with showWhenLocked + turnScreenOn.
 */
public class AlarmFullScreenActivity extends AppCompatActivity {

    private static final String TAG = "AlarmFullScreenActivity";

    /** Broadcast action sent by AlarmSoundService to close this activity */
    public static final String ACTION_CLOSE_ALARM = "com.wellnessvalley.app.CLOSE_ALARM_SCREEN";

    private BroadcastReceiver mCloseReceiver;

    // ─────────────────────────────────────────────────────────────────────
    // Activity lifecycle
    // ─────────────────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Turn on screen and show over lock screen
        enableShowOverLockScreen();

        setContentView(R.layout.activity_alarm_fullscreen);

        // Populate UI with title/message from intent
        String title        = getIntent().getStringExtra(AlarmSoundService.EXTRA_TITLE);
        String message      = getIntent().getStringExtra(AlarmSoundService.EXTRA_MESSAGE);
        String activityType = getIntent().getStringExtra(AlarmSoundService.EXTRA_ACTIVITY_TYPE);
        String taskId       = getIntent().getStringExtra(AlarmSoundService.EXTRA_TASK_ID);
        if (title   == null) title   = "Wellness Reminder";
        if (message == null) message = "Time for your activity!";

        TextView tvTitle   = findViewById(R.id.tvAlarmTitle);
        TextView tvMessage = findViewById(R.id.tvAlarmMessage);
        if (tvTitle   != null) tvTitle.setText(title);
        if (tvMessage != null) tvMessage.setText(message);

        // Upload Now — open task panel and launch capture flow
        final String finalActivityType = activityType;
        final String finalTaskId       = taskId;
        Button btnUploadNow = findViewById(R.id.btnUploadNow);
        if (btnUploadNow != null) {
            btnUploadNow.setOnClickListener(v -> {
                Log.d(TAG, "📸 Upload Now tapped");
                sendToService(AlarmSoundService.ACTION_DISMISS, null, null);
                Intent open = ReminderPlugin.buildTaskPanelIntent(
                        this, finalActivityType, finalTaskId, true);
                startActivity(open);
                finish();
            });
        }

        // Snooze button
        final String finalTitle   = title;
        final String finalMessage = message;
        Button btnSnooze = findViewById(R.id.btnSnooze);
        if (btnSnooze != null) {
            btnSnooze.setOnClickListener(v -> {
                Log.d(TAG, "💤 Snooze tapped");
                sendToService(AlarmSoundService.ACTION_SNOOZE, finalTitle, finalMessage);
                finish();
            });
        }

        // Dismiss button
        Button btnDismiss = findViewById(R.id.btnDismiss);
        if (btnDismiss != null) {
            btnDismiss.setOnClickListener(v -> {
                Log.d(TAG, "🔕 Dismiss tapped");
                sendToService(AlarmSoundService.ACTION_DISMISS, null, null);
                finish();
            });
        }

        // Register broadcast receiver so AlarmSoundService can close this screen
        registerCloseReceiver();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterCloseReceiver();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Screen-over-lock-screen setup
    // ─────────────────────────────────────────────────────────────────────

    private void enableShowOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            // API 27+: use Activity flags
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            // Below API 27: use window flags
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        // Keep screen on while alarm is displayed
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Broadcast receiver — listens for AlarmSoundService telling us to close
    // ─────────────────────────────────────────────────────────────────────

    private void registerCloseReceiver() {
        mCloseReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                Log.d(TAG, "📩 ACTION_CLOSE_ALARM received — finishing activity");
                finish();
            }
        };

        IntentFilter filter = new IntentFilter(ACTION_CLOSE_ALARM);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(mCloseReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(mCloseReceiver, filter);
        }
    }

    private void unregisterCloseReceiver() {
        if (mCloseReceiver != null) {
            try {
                unregisterReceiver(mCloseReceiver);
            } catch (Exception e) {
                Log.e(TAG, "Error unregistering close receiver", e);
            }
            mCloseReceiver = null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Forward action to AlarmSoundService
    // ─────────────────────────────────────────────────────────────────────

    private void sendToService(String action, String title, String message) {
        Intent intent = new Intent(this, AlarmSoundService.class);
        intent.setAction(action);
        if (title   != null) intent.putExtra(AlarmSoundService.EXTRA_TITLE,   title);
        if (message != null) intent.putExtra(AlarmSoundService.EXTRA_MESSAGE, message);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
    }
}
