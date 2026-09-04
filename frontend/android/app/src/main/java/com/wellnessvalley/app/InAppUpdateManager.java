package com.wellnessvalley.app;

import android.app.Activity;
import android.content.Intent;
import android.content.IntentSender;
import android.util.Log;
import android.view.View;
import com.google.android.material.snackbar.Snackbar;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallState;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.google.android.gms.tasks.Task;

/**
 * Manages Android In-App Updates using Google Play Core API
 * Supports both IMMEDIATE and FLEXIBLE update types
 * 
 * IMMEDIATE UPDATE:
 * - User must update to continue using app
 * - Used for critical bug fixes or security patches
 * - Blocking UI, no option to cancel
 * 
 * FLEXIBLE UPDATE:
 * - User can continue using app while update downloads
 * - Shows snackbar when download completes
 * - User can choose when to install
 */
public class InAppUpdateManager {
    private static final String TAG = "InAppUpdateManager";
    private static final int UPDATE_REQUEST_CODE = 1001;
    
    private final Activity activity;
    private final AppUpdateManager appUpdateManager;
    private InstallStateUpdatedListener installStateListener;
    private UpdateListener updateListener;
    private boolean mandatoryMode = false;
    
    // Priority thresholds for optional (non-mandatory) update checks
    private static final int IMMEDIATE_UPDATE_PRIORITY = 4; // Critical updates
    private static final int FLEXIBLE_UPDATE_PRIORITY = 2;  // Regular updates
    
    /**
     * Interface for update callbacks
     */
    public interface UpdateListener {
        void onUpdateAvailable(int updateType, int availableVersionCode);
        void onUpdateNotAvailable();
        void onUpdateDownloading(long bytesDownloaded, long totalBytes);
        void onUpdateDownloaded();
        void onUpdateInstalling();
        void onUpdateInstalled();
        void onUpdateFailed(int errorCode, String message);
        void onUpdateCanceled();
    }
    
    public InAppUpdateManager(Activity activity) {
        this.activity = activity;
        this.appUpdateManager = AppUpdateManagerFactory.create(activity);
        setupInstallStateListener();
    }
    
    /**
     * Set listener for update events
     */
    public void setUpdateListener(UpdateListener listener) {
        this.updateListener = listener;
    }
    
    /**
     * Setup listener for flexible update download progress
     */
    private void setupInstallStateListener() {
        installStateListener = new InstallStateUpdatedListener() {
            @Override
            public void onStateUpdate(InstallState state) {
                handleInstallState(state);
            }
        };
    }
    
    /**
     * Enable mandatory mode — cancelled immediate updates are re-triggered.
     */
    public void setMandatoryMode(boolean mandatory) {
        this.mandatoryMode = mandatory;
    }

    /**
     * Check for available updates and start appropriate flow (optional updates).
     */
    public void checkForUpdate() {
        mandatoryMode = false;
        checkForUpdateInternal(false);
    }

    /**
     * Mandatory update flow — always uses Google Play IMMEDIATE update when available.
     * Called when the server version policy returns update_required.
     */
    public void checkForMandatoryUpdate() {
        mandatoryMode = true;
        checkForUpdateInternal(true);
    }

    private void checkForUpdateInternal(boolean forceImmediate) {
        Log.d(TAG, forceImmediate
            ? "Checking for mandatory (IMMEDIATE) update..."
            : "Checking for available updates...");

        Task<AppUpdateInfo> appUpdateInfoTask = appUpdateManager.getAppUpdateInfo();

        appUpdateInfoTask.addOnSuccessListener(appUpdateInfo -> {
            int availability = appUpdateInfo.updateAvailability();

            if (availability == UpdateAvailability.UPDATE_AVAILABLE) {
                int availableVersionCode = appUpdateInfo.availableVersionCode();
                int updatePriority = appUpdateInfo.updatePriority();

                int updateType = forceImmediate
                    ? AppUpdateType.IMMEDIATE
                    : determineUpdateType(updatePriority, appUpdateInfo);

                Log.d(TAG, "Update available! Version: " + availableVersionCode
                    + ", Priority: " + updatePriority
                    + ", Type: " + (updateType == AppUpdateType.IMMEDIATE ? "IMMEDIATE" : "FLEXIBLE"));

                if (updateListener != null) {
                    updateListener.onUpdateAvailable(updateType, availableVersionCode);
                }

                startUpdate(appUpdateInfo, updateType);

            } else if (availability == UpdateAvailability.UPDATE_NOT_AVAILABLE) {
                Log.d(TAG, "No update available from Play");
                if (updateListener != null) {
                    updateListener.onUpdateNotAvailable();
                }

            } else if (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                Log.d(TAG, "Update already in progress, resuming IMMEDIATE flow...");
                if (updateListener != null) {
                    updateListener.onUpdateAvailable(AppUpdateType.IMMEDIATE, appUpdateInfo.availableVersionCode());
                }
                startUpdate(appUpdateInfo, AppUpdateType.IMMEDIATE);
            }
        });

        appUpdateInfoTask.addOnFailureListener(exception -> {
            Log.e(TAG, "Failed to check for updates", exception);
            if (updateListener != null) {
                updateListener.onUpdateFailed(-1, exception.getMessage());
            }
        });
    }
    
    /**
     * Determine update type based on priority and staleness
     */
    private int determineUpdateType(int updatePriority, AppUpdateInfo appUpdateInfo) {
        // Check if immediate update is enforced
        if (updatePriority >= IMMEDIATE_UPDATE_PRIORITY) {
            Log.d(TAG, "Critical update - using IMMEDIATE flow");
            return AppUpdateType.IMMEDIATE;
        }
        
        // Check staleness (days since update became available)
        Integer stalenessDays = appUpdateInfo.clientVersionStalenessDays();
        if (stalenessDays != null && stalenessDays >= 30) {
            Log.d(TAG, "Update is " + stalenessDays + " days old - using IMMEDIATE flow");
            return AppUpdateType.IMMEDIATE;
        }
        
        // Default to flexible for regular updates
        Log.d(TAG, "Regular update - using FLEXIBLE flow");
        return AppUpdateType.FLEXIBLE;
    }
    
    /**
     * Start update flow (immediate or flexible)
     */
    private void startUpdate(AppUpdateInfo appUpdateInfo, int updateType) {
        try {
            boolean isUpdateTypeAllowed = appUpdateInfo.isUpdateTypeAllowed(updateType);
            
            if (!isUpdateTypeAllowed) {
                Log.w(TAG, "Update type " + updateType + " is not allowed");
                if (mandatoryMode && updateType == AppUpdateType.IMMEDIATE) {
                    // IMMEDIATE not supported on this device/state — caller should fall back to store URL.
                    if (updateListener != null) {
                        updateListener.onUpdateFailed(-2, "Immediate update not allowed");
                    }
                    return;
                }
                if (updateListener != null) {
                    updateListener.onUpdateFailed(-2, "Update type not allowed");
                }
                return;
            }
            
            // Register listener for flexible updates
            if (updateType == AppUpdateType.FLEXIBLE) {
                appUpdateManager.registerListener(installStateListener);
            }
            
            // Start update
            appUpdateManager.startUpdateFlowForResult(
                appUpdateInfo,
                activity,
                AppUpdateOptions.newBuilder(updateType).build(),
                UPDATE_REQUEST_CODE
            );
            
            Log.d(TAG, "Update flow started for type: " + 
                       (updateType == AppUpdateType.IMMEDIATE ? "IMMEDIATE" : "FLEXIBLE"));
            
        } catch (IntentSender.SendIntentException e) {
            Log.e(TAG, "Failed to start update flow", e);
            if (updateListener != null) {
                updateListener.onUpdateFailed(-3, e.getMessage());
            }
        }
    }
    
    /**
     * Handle install state updates for flexible updates
     */
    private void handleInstallState(InstallState state) {
        int status = state.installStatus();
        long bytesDownloaded = state.bytesDownloaded();
        long totalBytes = state.totalBytesToDownload();
        
        switch (status) {
            case InstallStatus.PENDING:
                Log.d(TAG, "Update pending...");
                break;
                
            case InstallStatus.DOWNLOADING:
                int progress = 0;
                if (totalBytes > 0) {
                    progress = (int) ((bytesDownloaded * 100) / totalBytes);
                }
                Log.d(TAG, "Downloading: " + progress + "% (" + bytesDownloaded + "/" + totalBytes + ")");
                
                if (updateListener != null) {
                    updateListener.onUpdateDownloading(bytesDownloaded, totalBytes);
                }
                break;
                
            case InstallStatus.DOWNLOADED:
                Log.d(TAG, "Download complete! Ready to install.");
                
                if (updateListener != null) {
                    updateListener.onUpdateDownloaded();
                }
                
                // Show snackbar to prompt user to restart
                showUpdateReadySnackbar();
                break;
                
            case InstallStatus.INSTALLING:
                Log.d(TAG, "Installing update...");
                if (updateListener != null) {
                    updateListener.onUpdateInstalling();
                }
                break;
                
            case InstallStatus.INSTALLED:
                Log.d(TAG, "Update installed successfully");
                if (updateListener != null) {
                    updateListener.onUpdateInstalled();
                }
                unregisterListener();
                break;
                
            case InstallStatus.FAILED:
                Log.e(TAG, "Update failed with error code: " + state.installErrorCode());
                if (updateListener != null) {
                    updateListener.onUpdateFailed(state.installErrorCode(), "Installation failed");
                }
                unregisterListener();
                break;
                
            case InstallStatus.CANCELED:
                Log.w(TAG, "Update canceled by user");
                if (updateListener != null) {
                    updateListener.onUpdateCanceled();
                }
                unregisterListener();
                break;
                
            default:
                Log.d(TAG, "Unknown install status: " + status);
                break;
        }
    }
    
    /**
     * Show snackbar when flexible update is downloaded and ready
     */
    private void showUpdateReadySnackbar() {
        View rootView = activity.findViewById(android.R.id.content);
        if (rootView != null) {
            Snackbar snackbar = Snackbar.make(
                rootView,
                "Update downloaded! Restart to install.",
                Snackbar.LENGTH_INDEFINITE
            );
            
            snackbar.setAction("RESTART", view -> completeUpdate());
            snackbar.setActionTextColor(activity.getResources().getColor(android.R.color.holo_green_light));
            snackbar.show();
        }
    }
    
    /**
     * Complete flexible update by restarting the app
     */
    public void completeUpdate() {
        Log.d(TAG, "Completing flexible update...");
        appUpdateManager.completeUpdate();
    }
    
    /**
     * Handle activity result from update flow
     */
    public void handleActivityResult(int requestCode, int resultCode) {
        if (requestCode != UPDATE_REQUEST_CODE) {
            return;
        }

        if (resultCode == Activity.RESULT_OK) {
            Log.d(TAG, "Update flow completed successfully");
            return;
        }

        Log.w(TAG, "Update flow failed! Result code: " + resultCode);

        if (updateListener != null) {
            if (resultCode == Activity.RESULT_CANCELED) {
                updateListener.onUpdateCanceled();
            } else {
                updateListener.onUpdateFailed(resultCode, "Update flow failed");
            }
        }

        // Mandatory updates cannot be bypassed — re-check and restart IMMEDIATE flow.
        if (mandatoryMode) {
            Log.d(TAG, "Mandatory update — re-checking after user dismissal...");
            activity.runOnUiThread(() -> checkForMandatoryUpdate());
        }
    }
    
    /**
     * Resume update check on activity resume (for immediate updates)
     */
    public void onResume() {
        appUpdateManager.getAppUpdateInfo().addOnSuccessListener(appUpdateInfo -> {
            int availability = appUpdateInfo.updateAvailability();

            // Resume IMMEDIATE update if in progress (mandatory or optional).
            if (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                try {
                    appUpdateManager.startUpdateFlowForResult(
                        appUpdateInfo,
                        activity,
                        AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
                        UPDATE_REQUEST_CODE
                    );
                } catch (IntentSender.SendIntentException e) {
                    Log.e(TAG, "Failed to resume update", e);
                    if (mandatoryMode && updateListener != null) {
                        updateListener.onUpdateFailed(-3, e.getMessage());
                    }
                }
                return;
            }

            // Mandatory mode: re-check Play when app returns from background.
            if (mandatoryMode && availability == UpdateAvailability.UPDATE_AVAILABLE) {
                Log.d(TAG, "Mandatory update still required on resume — restarting IMMEDIATE flow");
                startUpdate(appUpdateInfo, AppUpdateType.IMMEDIATE);
                return;
            }

            // Flexible update downloaded — prompt restart (optional updates only).
            if (!mandatoryMode && appUpdateInfo.installStatus() == InstallStatus.DOWNLOADED) {
                showUpdateReadySnackbar();
            }
        }).addOnFailureListener(exception -> {
            Log.e(TAG, "Failed to check update state on resume", exception);
            if (mandatoryMode && updateListener != null) {
                updateListener.onUpdateFailed(-1, exception.getMessage());
            }
        });
    }
    
    /**
     * Unregister install state listener
     */
    public void unregisterListener() {
        if (installStateListener != null) {
            appUpdateManager.unregisterListener(installStateListener);
        }
    }
    
    /**
     * Check if flexible update is downloaded and ready to install
     */
    public void checkDownloadedUpdate() {
        appUpdateManager.getAppUpdateInfo().addOnSuccessListener(appUpdateInfo -> {
            if (appUpdateInfo.installStatus() == InstallStatus.DOWNLOADED) {
                showUpdateReadySnackbar();
            }
        });
    }
}
