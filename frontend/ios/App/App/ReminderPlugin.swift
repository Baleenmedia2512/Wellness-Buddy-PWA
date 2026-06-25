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
 *
 * Smart water messages: because iOS cannot read UserDefaults inside a scheduled
 * UNNotificationRequest at delivery time (without a Notification Service Extension),
 * updateWaterIntake() saves the latest totals AND immediately re-schedules all
 * future water notifications with the smart message baked in.
 */
@objc(ReminderPlugin)
public class ReminderPlugin: CAPPlugin {

    private let center      = UNUserNotificationCenter.current()
    private let prefsKey    = "wellnessReminderPrefs"
    private let waterKey    = "wellnessWaterToday"
    private let idPrefix    = "wellness_reminder_"
    private static let pendingStorageKey = "wellnessPendingTaskNotification"

    static let actionOpenTaskPanel = "openTaskPanel"
    static let categoryTaskReminder = "TASK_REMINDER"
    static let actionUploadNow      = "UPLOAD_NOW"
    static let actionDismiss        = "DISMISS"

    private static weak var sharedInstance: ReminderPlugin?

    public override func load() {
        super.load()
        ReminderPlugin.sharedInstance = self
        registerNotificationCategories()
    }

    // MARK: - Notification categories (Upload Now / Dismiss)

    private func registerNotificationCategories() {
        let upload = UNNotificationAction(
            identifier: ReminderPlugin.actionUploadNow,
            title: "Upload Now",
            options: [.foreground]
        )
        let dismiss = UNNotificationAction(
            identifier: ReminderPlugin.actionDismiss,
            title: "Dismiss",
            options: []
        )
        let category = UNNotificationCategory(
            identifier: ReminderPlugin.categoryTaskReminder,
            actions: [upload, dismiss],
            intentIdentifiers: [],
            options: []
        )
        center.setNotificationCategories([category])
    }

    /** Persist pending action for cold-start delivery to JS. */
    @objc public static func storePendingAction(_ userInfo: [AnyHashable: Any], uploadNow: Bool) {
        var payload = userInfo
        payload["action"] = actionOpenTaskPanel
        payload["uploadNow"] = uploadNow
        UserDefaults.standard.set(payload, forKey: pendingStorageKey)
        if let instance = sharedInstance {
            instance.notifyTaskReminderListeners(payload, uploadNow: uploadNow)
        }
    }

    private func notifyTaskReminderListeners(_ userInfo: [AnyHashable: Any], uploadNow: Bool) {
        var data: [String: Any] = ["action": ReminderPlugin.actionOpenTaskPanel, "uploadNow": uploadNow]
        if let taskType = userInfo["taskType"] as? String { data["taskType"] = taskType }
        if let taskId = userInfo["taskId"] as? String { data["taskId"] = taskId }
        else if let taskId = userInfo["taskId"] as? Int { data["taskId"] = String(taskId) }
        notifyListeners("taskReminderAction", data: data)
    }

    // MARK: - consumePendingTaskNotification

    @objc func consumePendingTaskNotification(_ call: CAPPluginCall) {
        guard let payload = UserDefaults.standard.dictionary(forKey: ReminderPlugin.pendingStorageKey) else {
            call.resolve([:])
            return
        }
        UserDefaults.standard.removeObject(forKey: ReminderPlugin.pendingStorageKey)
        var data: [String: Any] = ["action": ReminderPlugin.actionOpenTaskPanel]
        if let taskType = payload["taskType"] as? String { data["taskType"] = taskType }
        if let taskId = payload["taskId"] as? String { data["taskId"] = taskId }
        if let uploadNow = payload["uploadNow"] as? Bool { data["uploadNow"] = uploadNow }
        call.resolve(data)
    }

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
                // Use personalised body from reminderService.js if available (learned average)
                let personalizedBody = reminder["personalizedBody"] as? String
                if let pb = personalizedBody, !pb.isEmpty {
                    scheduleDailyWithMessage(activityType: activityType, label: label,
                                             hour: hour, minute: minute, body: pb)
                } else {
                    scheduleDaily(activityType: activityType, label: label,
                                  hour: hour, minute: minute)
                }
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

    // MARK: - scheduleSnooze
    /**
     * Schedule a one-shot local notification that fires after <snoozeMinutes>.
     *
     * JS call: await ReminderPlugin.scheduleSnooze({ taskId, taskType, label, snoozeMinutes })
     *
     * Identifier: "wellness_snooze_<taskId>" — allows cancellation.
     */
    @objc func scheduleSnooze(_ call: CAPPluginCall) {
        guard let taskId       = call.getInt("taskId"),
              let snoozeMinutes = call.getInt("snoozeMinutes"),
              snoozeMinutes > 0, snoozeMinutes <= 120
        else {
            call.reject("Invalid parameters: taskId and snoozeMinutes (1–120) are required")
            return
        }

        let taskType = call.getString("taskType") ?? "task"
        let label    = call.getString("label")    ?? taskType.capitalized
        let body     = call.getString("body")

        let content       = UNMutableNotificationContent()
        content.title     = "🔔 \(label) — Snoozed Reminder"
        if let customBody = body, !customBody.isEmpty {
            content.body = customBody
        } else {
            content.body = buildActivityMessage(activityType: taskType, label: label)
        }
        content.sound     = .default
        content.categoryIdentifier = ReminderPlugin.categoryTaskReminder
        content.userInfo  = [
            "action":   ReminderPlugin.actionOpenTaskPanel,
            "taskType": taskType,
            "taskId":   String(taskId),
        ]

        let trigger    = UNTimeIntervalNotificationTrigger(
                            timeInterval: TimeInterval(snoozeMinutes * 60),
                            repeats: false)
        let identifier = "wellness_snooze_\(taskId)"
        let request    = UNNotificationRequest(identifier: identifier,
                                               content: content,
                                               trigger: trigger)

        // Cancel any previous snooze for this task first
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        center.add(request) { error in
            if let error = error {
                print("[ReminderPlugin] ❌ scheduleSnooze \(taskId): \(error.localizedDescription)")
            } else {
                print("[ReminderPlugin] ✅ scheduleSnooze taskId=\(taskId) in \(snoozeMinutes) min")
            }
        }
        call.resolve(["success": true, "taskId": taskId, "snoozeMinutes": snoozeMinutes])
    }

    // MARK: - cancelSnooze
    /**
     * Cancel a previously scheduled snooze notification.
     *
     * JS call: await ReminderPlugin.cancelSnooze({ taskId })
     */
    @objc func cancelSnooze(_ call: CAPPluginCall) {
        guard let taskId = call.getInt("taskId") else {
            call.reject("Missing required parameter: taskId")
            return
        }
        let identifier = "wellness_snooze_\(taskId)"
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        print("[ReminderPlugin] 🛑 cancelSnooze taskId=\(taskId)")
        call.resolve(["success": true, "taskId": taskId])
    }

    // MARK: - updateWaterIntake
    /**
     * Cache today's water intake totals and re-schedule all pending water
     * notifications with a smart remaining-balance message.
     *
     * iOS cannot read UserDefaults inside a scheduled UNNotificationRequest at
     * delivery time (no Notification Service Extension), so we bake the updated
     * message into each future water notification right now.
     *
     * JS usage:
     *   await ReminderPlugin.updateWaterIntake({ drunkMl: 500, goalMl: 3000 });
     */
    @objc func updateWaterIntake(_ call: CAPPluginCall) {
        let drunkMl = call.getInt("drunkMl") ?? 0
        let goalMl  = call.getInt("goalMl")  ?? 2500

        // 1. Persist to UserDefaults
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let today = formatter.string(from: Date())

        let cache: [String: Any] = ["date": today, "drunkMl": drunkMl, "goalMl": goalMl]
        UserDefaults.standard.set(cache, forKey: waterKey)

        // 2. Build the smart message
        let smartMessage = buildSmartWaterMessage(drunkMl: drunkMl, goalMl: goalMl)

        // 3. Re-schedule all saved water reminder slots with the updated message
        let savedReminders = UserDefaults.standard.array(forKey: "\(prefsKey)_reminders")
                               as? [[String: Any]] ?? []
        let masterEnabled  = UserDefaults.standard.bool(forKey: "\(prefsKey)_masterEnabled")

        for reminder in savedReminders {
            guard let type = reminder["activityType"] as? String,
                  type.hasPrefix("water_"),
                  let enabled = (reminder["enabled"] as? NSNumber)?.boolValue,
                  masterEnabled && enabled
            else { continue }

            let label  = reminder["label"]  as? String ?? "Drink Water 💧"
            let hour   = (reminder["hour"]   as? NSNumber)?.intValue ?? 7
            let minute = (reminder["minute"] as? NSNumber)?.intValue ?? 0

            // Cancel existing slot then reschedule with fresh message
            center.removePendingNotificationRequests(withIdentifiers: [idPrefix + type])
            scheduleDailyWithMessage(activityType: type, label: label,
                                     hour: hour, minute: minute, body: smartMessage)
        }

        print("[ReminderPlugin] 💧 updateWaterIntake — \(drunkMl)/\(goalMl) ml on \(today)")
        call.resolve(["success": true])
    }

    // MARK: - Private helpers

    private func buildSmartWaterMessage(drunkMl: Int, goalMl: Int) -> String {
        let remaining = goalMl - drunkMl
        if drunkMl == 0 {
            let goalL = String(format: "%.1f", Double(goalMl) / 1000.0)
            return "💧 Drink water! Your goal today is \(goalL) L. Start now!"
        } else if remaining <= 0 {
            return "🎉 You've reached your water goal today! Great work staying hydrated!"
        } else {
            let drunkL  = String(format: "%.1f", Double(drunkMl)  / 1000.0)
            let remainL = String(format: "%.1f", Double(remaining) / 1000.0)
            return "💧 You've had \(drunkL) L. Still need \(remainL) L today — keep it up!"
        }
    }

    private func scheduleDaily(activityType: String, label: String, hour: Int, minute: Int) {
        let body: String
        if activityType.hasPrefix("water_") {
            // Use cached smart message if available and fresh; otherwise use generic
            if let cache   = UserDefaults.standard.dictionary(forKey: waterKey),
               let date    = cache["date"]    as? String,
               let drunkMl = cache["drunkMl"] as? Int,
               let goalMl  = cache["goalMl"]  as? Int {
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd"
                let today = formatter.string(from: Date())
                body = (date == today)
                    ? buildSmartWaterMessage(drunkMl: drunkMl, goalMl: goalMl)
                    : "💧 Time to drink water! Stay hydrated throughout the day."
            } else {
                body = "💧 Time to drink water! Stay hydrated throughout the day."
            }
        } else {
            body = buildActivityMessage(activityType: activityType, label: label)
        }
        scheduleDailyWithMessage(activityType: activityType, label: label,
                                 hour: hour, minute: minute, body: body)
    }

    private func scheduleDailyWithMessage(activityType: String, label: String,
                                          hour: Int, minute: Int, body: String) {
        let content   = UNMutableNotificationContent()
        content.title = "� \(label) Reminder"
        content.body  = body
        content.sound = .default
        content.categoryIdentifier = ReminderPlugin.categoryTaskReminder
        content.userInfo = [
            "action":   ReminderPlugin.actionOpenTaskPanel,
            "taskType": activityType,
        ]

        var dc        = DateComponents()
        dc.hour       = hour
        dc.minute     = minute

        let trigger    = UNCalendarNotificationTrigger(dateMatching: dc, repeats: true)
        let identifier = idPrefix + activityType
        let request    = UNNotificationRequest(identifier: identifier,
                                               content: content,
                                               trigger: trigger)
        center.add(request) { error in
            if let error = error {
                print("[ReminderPlugin] ❌ Failed \(activityType): \(error.localizedDescription)")
            } else {
                print("[ReminderPlugin] ✅ Scheduled \(activityType) at \(hour):\(String(format: "%02d", minute))")
            }
        }
    }

    private func buildActivityMessage(activityType: String, label: String) -> String {
        switch activityType.lowercased() {
        case "weight":
            return "⚖️ Time to log your weight and stay on track!"
        case "education":
            return "📚 Your education session is starting soon. Get ready to learn!"
        case "breakfast":
            return "🥗 Breakfast time! Prepare your meal and log it."
        case "lunch":
            return "🍱 Lunch time! Don't forget to log your meal."
        case "dinner":
            return "🌙 Dinner time! Plan your evening meal."
        case "sleep":
            return "🌙 Bedtime in 15 minutes! Wind down and prepare for a good night's sleep."
        default:
            return "Time for your \(label) activity! 💪"
        }
    }
}
