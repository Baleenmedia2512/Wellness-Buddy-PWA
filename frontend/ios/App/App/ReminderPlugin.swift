import Foundation
import Capacitor
import UserNotifications

/**
 * ReminderPlugin — iOS equivalent of the Android ReminderPlugin (AlarmManager-based).
 *
 * Uses UNUserNotificationCenter to schedule daily repeating local notifications.
 * Notification identifiers are in the form "wellness_reminder_<activityType>"
 * so they can be individually cancelled/replaced.
 *
 * Preferences are persisted in UserDefaults so the reminder configuration
 * survives app restarts (iOS re-fires UNUserNotificationCenter schedules
 * automatically; no boot receiver is needed on iOS).
 */
@objc(ReminderPlugin)
public class ReminderPlugin: CAPPlugin, CAPBridgedPlugin {

    // MARK: - CAPBridgedPlugin
    public let identifier  = "ReminderPlugin"
    public let jsName      = "ReminderPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scheduleReminder",       returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelReminder",         returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAllReminders",     returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scheduleAll",            returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canScheduleExactAlarms", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openExactAlarmSettings", returnType: CAPPluginReturnPromise),
    ]

    private let center      = UNUserNotificationCenter.current()
    private let prefsKey    = "wellnessReminderPrefs"
    private let idPrefix    = "wellness_reminder_"

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
        let identifier   = idPrefix + activityType
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        call.resolve(["success": true])
    }

    // MARK: - cancelAllReminders
    @objc func cancelAllReminders(_ call: CAPPluginCall) {
        center.getPendingNotificationRequests { [weak self] requests in
            guard let self = self else { return }
            let ids = requests
                .map { $0.identifier }
                .filter { $0.hasPrefix(self.idPrefix) }
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

                let identifier = self.idPrefix + activityType
                self.center.removePendingNotificationRequests(withIdentifiers: [identifier])

                if masterEnabled && enabled && granted {
                    self.scheduleDaily(activityType: activityType, label: label, hour: hour, minute: minute)
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

            // Persist to UserDefaults (iOS equivalent of Android SharedPreferences)
            let defaults = UserDefaults.standard
            defaults.set(masterEnabled, forKey: "\(self.prefsKey)_masterEnabled")
            defaults.set(prefsToSave,   forKey: "\(self.prefsKey)_reminders")

            call.resolve(["success": true, "scheduledCount": scheduledCount])
        }
    }

    // MARK: - canScheduleExactAlarms
    // iOS does not have an "exact alarm" permission concept — always return true.
    @objc func canScheduleExactAlarms(_ call: CAPPluginCall) {
        call.resolve(["canScheduleExact": true])
    }

    // MARK: - openExactAlarmSettings
    // No equivalent on iOS — open general notification settings instead.
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
        let content         = UNMutableNotificationContent()
        content.title       = "Wellness Valley"
        content.body        = "Time for your \(label) activity! 💪"
        content.sound       = .default

        var dateComponents  = DateComponents()
        dateComponents.hour   = hour
        dateComponents.minute = minute

        let trigger    = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        let identifier = idPrefix + activityType
        let request    = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        center.add(request) { error in
            if let error = error {
                print("[ReminderPlugin] Failed to schedule \(activityType): \(error.localizedDescription)")
            } else {
                print("[ReminderPlugin] Scheduled \(activityType) at \(hour):\(String(format: "%02d", minute))")
            }
        }
    }
}
