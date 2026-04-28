import Foundation
import Capacitor
import UserNotifications
import UIKit

/**
 * ReminderPlugin — iOS Capacitor plugin for daily reminders.
 *
 * Key design decision: scheduleAll() is fully SYNCHRONOUS (no async completion handler).
 * Notification permission is requested at login via PushNotifications.requestPermissions().
 * Here we just schedule — iOS will silently skip if permission is denied.
 * This avoids all call.keepAlive / Promise-rejection issues with Capacitor 8.
 */
@objc(ReminderPlugin)
public class ReminderPlugin: CAPPlugin {

    private let center   = UNUserNotificationCenter.current()
    private let prefsKey = "wellnessReminderPrefs"
    private let idPrefix = "wellness_reminder_"

    // MARK: - scheduleReminder (sync resolve)
    @objc func scheduleReminder(_ call: CAPPluginCall) {
        let activityType = call.getString("activityType") ?? ""
        let label        = call.getString("label")        ?? activityType.capitalized
        let hour         = call.getInt("hour")            ?? 7
        let minute       = call.getInt("minute")          ?? 0

        scheduleDaily(activityType: activityType, label: label, hour: hour, minute: minute)
        call.resolve(["success": true])
    }

    // MARK: - cancelReminder (sync resolve)
    @objc func cancelReminder(_ call: CAPPluginCall) {
        let activityType = call.getString("activityType") ?? ""
        center.removePendingNotificationRequests(withIdentifiers: [idPrefix + activityType])
        call.resolve(["success": true])
    }

    // MARK: - cancelAllReminders (sync resolve via dispatch group)
    @objc func cancelAllReminders(_ call: CAPPluginCall) {
        // getPendingNotificationRequests is async but we can fire-and-forget the cancel
        center.getPendingNotificationRequests { [weak self] requests in
            guard let self = self else { return }
            let ids = requests.map { $0.identifier }.filter { $0.hasPrefix(self.idPrefix) }
            self.center.removePendingNotificationRequests(withIdentifiers: ids)
        }
        // Resolve immediately — cancel is best-effort
        call.resolve(["success": true])
    }

    // MARK: - scheduleAll (fully synchronous — NO async permission check)
    // Permission is handled at login by PushNotifications.requestPermissions().
    // We just schedule here; iOS silently skips requests if permission is denied.
    @objc func scheduleAll(_ call: CAPPluginCall) {
        let masterEnabled = call.getBool("masterEnabled") ?? true
        let reminders     = call.getArray("reminders")   ?? []

        var scheduledCount = 0
        var prefsToSave: [[String: Any]] = []

        for item in reminders {
            guard let reminder = item as? [String: Any] else { continue }

            let activityType = reminder["activityType"] as? String ?? ""
            let label        = reminder["label"]        as? String ?? activityType.capitalized
            // JS numbers arrive as NSNumber on iOS — must NOT cast directly to Int/Bool
            let hour         = (reminder["hour"]    as? NSNumber)?.intValue  ?? 7
            let minute       = (reminder["minute"]  as? NSNumber)?.intValue  ?? 0
            let enabled      = (reminder["enabled"] as? NSNumber)?.boolValue ?? false

            // Cancel existing to avoid duplicate notifications
            center.removePendingNotificationRequests(withIdentifiers: [idPrefix + activityType])

            if masterEnabled && enabled {
                scheduleDaily(activityType: activityType, label: label, hour: hour, minute: minute)
                scheduledCount += 1
            }

            prefsToSave.append([
                "activityType": activityType,
                "label":        label,
                "hour":         hour,
                "minute":       minute,
                "enabled":      enabled,
            ])
        }

        // Persist to UserDefaults
        UserDefaults.standard.set(masterEnabled, forKey: "\(prefsKey)_masterEnabled")
        UserDefaults.standard.set(prefsToSave,   forKey: "\(prefsKey)_reminders")

        print("[ReminderPlugin] scheduleAll — masterEnabled:\(masterEnabled) scheduled:\(scheduledCount)/\(reminders.count)")

        // Resolve synchronously — no async work here, Promise will never reject
        call.resolve(["success": true, "scheduledCount": scheduledCount])
    }

    // MARK: - canScheduleExactAlarms
    @objc func canScheduleExactAlarms(_ call: CAPPluginCall) {
        call.resolve(["canScheduleExact": true])
    }

    // MARK: - openExactAlarmSettings
    @objc func openExactAlarmSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        }
        call.resolve(["success": true])
    }

    // MARK: - Private helpers

    private func scheduleDaily(activityType: String, label: String, hour: Int, minute: Int) {
        let content   = UNMutableNotificationContent()
        content.title = "Wellness Valley"
        content.body  = "Time for your \(label) activity! 💪"
        content.sound = .default

        var dc        = DateComponents()
        dc.hour       = hour
        dc.minute     = minute

        let trigger    = UNCalendarNotificationTrigger(dateMatching: dc, repeats: true)
        let identifier = idPrefix + activityType
        let request    = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        center.add(request) { error in
            if let error = error {
                print("[ReminderPlugin] ❌ Failed \(activityType): \(error.localizedDescription)")
            } else {
                print("[ReminderPlugin] ✅ Scheduled \(activityType) at \(hour):\(String(format: "%02d", minute))")
            }
        }
    }
}
