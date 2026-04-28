#import <Capacitor/Capacitor.h>

// Registers ReminderPlugin (Swift) with the Capacitor Objective-C bridge.
// This file is required so Capacitor can discover the plugin at runtime via
// the CAP_PLUGIN macro — the Swift class alone is not enough.
CAP_PLUGIN(ReminderPlugin, "ReminderPlugin",
    CAP_PLUGIN_METHOD(scheduleReminder,       CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(cancelReminder,         CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(cancelAllReminders,     CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(scheduleAll,            CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(canScheduleExactAlarms, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(openExactAlarmSettings, CAPPluginReturnPromise);
)
