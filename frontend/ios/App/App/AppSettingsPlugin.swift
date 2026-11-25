import Foundation
import UIKit
import Capacitor

/**
 * Opens this app's page in iOS Settings.
 * Needed because @capacitor/app v8 removed App.openUrl(), so
 * `app-settings:` via JS no longer works.
 */
@objc(AppSettingsPlugin)
public class AppSettingsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppSettingsPlugin"
    public let jsName = "AppSettings"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc public func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("Invalid settings URL")
                return
            }
            guard UIApplication.shared.canOpenURL(url) else {
                call.reject("Cannot open Settings URL")
                return
            }
            UIApplication.shared.open(url, options: [:]) { success in
                if success {
                    call.resolve(["opened": true])
                } else {
                    call.reject("Unable to open Settings")
                }
            }
        }
    }
}
