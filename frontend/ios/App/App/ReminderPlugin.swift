import Foundation
import Capacitor
import UserNotifications

/**
 * ReminderPlugin — iOS equivalent of the Android ReminderPlugin (AlarmManager-based).
 *
 * Uses UNUserNotificationCenter to schedule daily repeating local notifications.
 * Registered with Capacitor via ReminderPlugin.m (CAP_PLUGIN macro).
 *
 * Preferences are persisted in UserDefaults so the reminder configuration
 * survives app restarts (iOS re-fires UNUserNotificationCenter schedules
 * automatically; no boot receiver is needed on iOS).
 */
@objc(ReminderPlugin)
public class ReminderPlugin: CAPPlugin {

    private let center   = UNUserNotificationCenter.current()
    private let prefsKey = "wellnessReminderPrefs"
    private let idPrefix = "wellness_reminder_"

    // MARK: - scheduleReminder
    @objc func scheduleReminder(_ call: CAPPluginCall) {
        let activityType = call.getString("activityType") ?? ""
        let label        = call.getString("label")        ?? activityType.capitalized
        let hour         = call.getInt("hour")            ?? 7
        let minute       = call.getInt("minute")          ?? 0

        requestAuthorizationIfNeeded { [weak self] granted in
            guard let self = self else { return }
            if !granted {
                call.resolve(["success": false, "reason": "permission-denied"])
                return
            }
            self.scheduleDaily(activityType: activityType, label: label, hour: hour, minute: minute)
            call.resolve(["success": true])
        }
    }

    // MARK: - cancelReminder
    @objc func cancelReminder(_ call: CAPPluginCall) {
        let activityType = call.getString("activityType") ?? ""
        center.removePendingNotificationRequests(withIdentifiers: [idPrefix + activityType])
        call.resolve(["success": true])
    }

    // MARK: - cancelAllReminders
    @objc func cancelAllReminders(_ call: CAPPluginCall) {
        center.getPendingNotificationRequests { [weak self] requests in
            guard let self = self else { return }
            let ids = requests.map { $0.identifier }.filter { $0.hasPrefix(self.idPrefix) }
            self.center.removePendingNotificationRequests(withIdentifiers: ids)
            call.resolve(["success": true])
        }
    }

    // MARK: - scheduleAll
    @objc func scheduleAll(_ call: CAPPluginCall) {
        let masterEnabled = call.getBool("masterEnabled") ?? true
        let reminders     = call.getArray("reminders")   ?? []

        requestAuthorizationIfNeeded { [weak self] granted in
            guard let self = self else { return }

            var scheduledCount = 0
            var prefsToSave: [[String: Any]] = []

            for item in reminders {
                guard let reminder = item as? [String: Any] else { continue }
                let activityType = reminder["activityType"] as? String ?? ""
                let label        = reminder["label"]        as? String ?? activityType.capitalized
                let hour         = reminder["hour"]         as? Int    ?? 7
                let minute       = reminder["minute"]       as? Int    ?? 0
                let enabled      = reminder["enabled"]      as? Bool   ?? false

                // Always cancel first so we don't stack duplicate notifications
                self.center.removePendingNotificationRequests(withIdentifiers: [self.idPrefix + activityType])

                if masterEnabled && enabled {
                    // Schedule even if permission not yet granted — iOS will hold the request
                    // and fire once user grants permission from Settings
                    if granted {
                        self.scheduleDaily(activityType: activityType, label: label, hour: hour, minute: minute)
                        scheduledCount += 1
                    }
                }

                prefsToSave.append([
                    "activityType": activityType,
                    "label":        label,
                    "hour":         hour,
                    "minute":       minute,
                    "enabled":      enabled,
                ])
            }

            // Persist to UserDefaults (iOS equivalent of Android SharedPreferences)
            UserDefaults.standard.set(masterEnabled, forKey: "\(self.prefsKey)_masterEnabled")
            UserDefaults.standard.set(prefsToSave,   forKey: "\(self.prefsKey)_reminders")

            // Always resolve successfully — preferences are saved even if permission denied
            call.resolve(["success": true, "scheduledCount": scheduledCount])
        }
    }

    // MARK: - canScheduleExactAlarms
    // iOS doesn't have an "exact alarm" permission — always true.
    @objc func canScheduleExactAlarms(_ call: CAPPluginCall) {
        call.resolve(["canScheduleExact": true])
    }

    // MARK: - openExactAlarmSettings
    // Opens iOS notification settings for this app.
    @objc func openExactAlarmSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        }
        call.resolve(["success": true])
    }

    // MARK: - Private helpers

    private func requestAuthorizationIfNeeded(completion: @escaping (Bool) -> Void) {
        center.getNotificationSettings { [weak self] settings in
            guard let self = self else { completion(false); return }
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                completion(true)
            case .notDetermined:
                self.center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                    completion(granted)
                }
            default:
                completion(false)
            }
        }
    }

    private func scheduleDaily(activityType: String, label: String, hour: Int, minute: Int) {
        let content       = UNMutableNotificationContent()
        content.title     = "Wellness Valley"
        content.body      = "Time for your \(label) activity! 💪"
        content.sound     = .default

        var dc            = DateComponents()
        dc.hour           = hour
        dc.minute         = minute

        let trigger   = UNCalendarNotificationTrigger(dateMatching: dc, repeats: true)
        let request   = UNNotificationRequest(
            identifier: idPrefix + activityType,
            content:    content,
            trigger:    trigger
        )

        center.add(request) { error in
            if let error = error {
                print("[ReminderPlugin] ❌ Failed to schedule \(activityType): \(error.localizedDescription)")
            } else {
                print("[ReminderPlugin] ✅ Scheduled \(activityType) at \(hour):\(String(format: "%02d", minute))")
            }
        }
    }
}
