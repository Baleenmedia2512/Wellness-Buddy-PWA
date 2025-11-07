# Camera Photo Detection - Visual Flow Diagram

## 📱 User Experience Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                              │
└─────────────────────────────────────────────────────────────────┘

Step 1: User opens phone's Camera app 📷
        │
        ↓
Step 2: Takes photo of food 🍕
        │
        ↓
Step 3: Photo saved to DCIM/Camera folder 💾
        │
        ↓
Step 4: Wait 1-2 seconds ⏱️
        │
        ↓
Step 5: Notification appears 🔔
        │
        ↓
┌───────────────────────────────────────────────────────────────┐
│  📷 New Photo Detected                                        │
│                                                               │
│  This particular food is taken from your personal camera.    │
│  Do you want me to take this in the Wellness app?           │
│                                                               │
│  [Preview Image]                                             │
│                                                               │
│  ┌───────────┐  ┌───────────┐                               │
│  │   Admit   │  │    No     │                               │
│  └───────────┘  └───────────┘                               │
└───────────────────────────────────────────────────────────────┘
        │
        ├─────────────┬──────────────┐
        │             │              │
        ↓             ↓              ↓
   [Admit]         [No]       [Swipe Away]
        │             │              │
        ↓             ↓              ↓
   Opens App    Dismisses      Dismisses
        │        Notification   Notification
        ↓
   Wellness Buddy launches 🚀
        │
        ↓
   Photo added to analysis queue 📋
        │
        ↓
   AI analyzes photo 🤖
        │
        ↓
   Results saved to database 💾
        │
        ↓
   Success notification shown ✅
        │
        ↓
   User views results 📊
```

---

## 🏗️ Technical Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     SYSTEM ARCHITECTURE                          │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  APP LAUNCH / DEVICE BOOT                                       │
│                                                                 │
│  MainActivity.onCreate() or BootCompletedReceiver.onReceive()  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  START CAMERA MONITOR SERVICE                                   │
│                                                                 │
│  CameraMonitorService.onCreate()                                │
│  • Create notification channels                                 │
│  • Start as foreground service                                  │
│  • Initialize FileObserver                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  FILE OBSERVER MONITORING                                       │
│                                                                 │
│  FileObserver watches: /storage/emulated/0/DCIM/Camera/        │
│  • Events: CLOSE_WRITE, MOVED_TO                               │
│  • Filter: .jpg, .jpeg, .png files only                        │
│  • Debounce: 2 second delay for duplicates                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓ NEW PHOTO DETECTED
┌─────────────────────────────────────────────────────────────────┐
│  CREATE NOTIFICATION                                            │
│                                                                 │
│  showFoodDetectionNotification()                                │
│  • Title: "📷 New Photo Detected"                              │
│  • Text: Custom message                                        │
│  • Style: BigPicture (with photo preview)                      │
│  • Actions: [Admit] [No]                                       │
│  • Channel: High priority                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓ USER TAPS "ADMIT"
┌─────────────────────────────────────────────────────────────────┐
│  BROADCAST RECEIVER                                             │
│                                                                 │
│  FoodDetectionNotificationReceiver.onReceive()                  │
│  • Action: ACTION_ADMIT_PHOTO                                  │
│  • Extract: imagePath from intent                              │
│  • Dismiss notification                                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  ADD TO QUEUE                                                   │
│                                                                 │
│  FoodImageQueue.add(imagePath)                                  │
│  • Queue stored in SharedPreferences                           │
│  • Persistent across app restarts                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  OPEN WELLNESS APP                                              │
│                                                                 │
│  Intent to MainActivity                                         │
│  • Flags: NEW_TASK | CLEAR_TOP                                 │
│  • Extra: photoAdmitted = true                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  PROCESS QUEUE                                                  │
│                                                                 │
│  GalleryMonitorService.processQueuedImages()                    │
│  • Read image from path                                        │
│  • Encode to base64                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  AI ANALYSIS                                                    │
│                                                                 │
│  GeminiApiClient.analyzeImage()                                 │
│  • Send to Gemini API                                          │
│  • Extract nutrition data                                      │
│  • Return JSON response                                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  SAVE TO DATABASE                                               │
│                                                                 │
│  DatabaseSyncClient.saveAnalysis()                              │
│  • User ID from SharedPreferences                              │
│  • Analysis JSON from Gemini                                   │
│  • Image base64                                                │
│  • Timestamp                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  SHOW RESULT NOTIFICATION                                       │
│                                                                 │
│  showAnalysisNotification()                                     │
│  • Title: "🍽️ Food Analysis Complete"                         │
│  • Text: Food name + nutrition facts                           │
│  • Action: Opens background history                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
                          ✅ DONE
```

---

## 🔄 Service Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                    SERVICE LIFECYCLE                             │
└──────────────────────────────────────────────────────────────────┘

┌─────────────┐
│ App Launch  │
└──────┬──────┘
       │
       ↓
┌─────────────────────┐
│ CameraMonitorService│
│     onCreate()      │
│                     │
│ • Create channels   │
│ • Start foreground  │
│ • Init FileObserver │
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│  Service Running    │
│  (Foreground)       │
│                     │
│  FileObserver       │
│  watching folder... │
└──────┬──────────────┘
       │
       ├─────→ New Photo → Notification → Process
       │
       ├─────→ No Photos → Idle (0% CPU)
       │
       ↓
┌─────────────────────┐
│  Service Stopped    │
│  (User action or    │
│   system kill)      │
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│  Auto-Restart       │
│  (via WorkManager)  │
│                     │
│  • 15-min heartbeat │
│  • Detects death    │
│  • Restarts service │
└─────────────────────┘
```

---

## 🔔 Notification Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                   NOTIFICATION SYSTEM                            │
└──────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  NOTIFICATION CHANNELS                                         │
└────────────────────────────────────────────────────────────────┘

Channel 1: "CameraMonitorChannel"
  • Name: "Camera Monitor Service"
  • Importance: LOW
  • Purpose: Foreground service notification
  • Ongoing: Yes (can't dismiss)
  • Shows: "Camera Monitor Active"

Channel 2: "FoodDetectionChannel"
  • Name: "Food Photo Detected"
  • Importance: HIGH
  • Purpose: User action notifications
  • Ongoing: No (dismissible)
  • Shows: "📷 New Photo Detected"

┌────────────────────────────────────────────────────────────────┐
│  NOTIFICATION ACTIONS                                          │
└────────────────────────────────────────────────────────────────┘

Action 1: "Admit"
  • Action: ACTION_ADMIT_PHOTO
  • Handler: FoodDetectionNotificationReceiver
  • Result: Opens app + adds to queue

Action 2: "No"
  • Action: ACTION_DISMISS_PHOTO
  • Handler: FoodDetectionNotificationReceiver
  • Result: Dismisses notification
```

---

## 📊 Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      DATA FLOW                                   │
└──────────────────────────────────────────────────────────────────┘

Camera App
    ↓
    ↓ Saves JPEG/PNG
    ↓
/storage/emulated/0/DCIM/Camera/IMG_xxx.jpg
    ↓
    ↓ inotify event
    ↓
FileObserver.onEvent()
    ↓
    ↓ Validates file
    ↓
Notification with imagePath
    ↓
    ↓ User taps "Admit"
    ↓
BroadcastReceiver
    ↓
    ↓ Extracts imagePath
    ↓
FoodImageQueue
    ↓
    ↓ SharedPreferences
    ↓
{
  "queued_images": [
    "/storage/.../IMG_xxx.jpg"
  ]
}
    ↓
    ↓ Read from disk
    ↓
File bytes → Base64 string
    ↓
    ↓ HTTP POST
    ↓
Gemini API
    ↓
    ↓ JSON response
    ↓
{
  "foods": [{
    "name": "Pizza",
    "nutrition": {
      "calories": 285,
      "protein": 12,
      "carbs": 36,
      "fat": 10
    }
  }]
}
    ↓
    ↓ HTTP POST
    ↓
MariaDB Database
    ↓
    ↓ Stored
    ↓
✅ Success Notification
```

---

## 🔋 Battery Optimization Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│              BATTERY EFFICIENCY DESIGN                           │
└──────────────────────────────────────────────────────────────────┘

❌ BAD APPROACH (Polling):
    while (true) {
        checkForNewPhotos();  // 🔴 CPU constantly running
        sleep(5000);          // 🔴 Wakes up every 5s
    }
    Battery Impact: 5-8% per hour

✅ GOOD APPROACH (FileObserver):
    fileObserver.startWatching();  // ✅ Set up once
    // ... waits for inotify events ... (0% CPU)
    onEvent() {                     // ✅ Only runs when photo taken
        processPhoto();
    }
    Battery Impact: < 0.5% per hour

┌────────────────────────────────────────────────────────────────┐
│  WHY FILEOBSERVER IS BETTER                                    │
└────────────────────────────────────────────────────────────────┘

Polling Approach:
  • CPU active 100% of monitoring time
  • Wakes device periodically
  • Battery drain even when no photos
  • 5-30 second detection delay

FileObserver Approach:
  • CPU idle until event occurs
  • Kernel-level notification (inotify)
  • Zero battery when no photos
  • < 1 second detection latency
```

---

## 🎯 Integration Points

```
┌──────────────────────────────────────────────────────────────────┐
│         INTEGRATION WITH EXISTING FEATURES                       │
└──────────────────────────────────────────────────────────────────┘

New Feature: CameraMonitorService
                    │
                    ↓ (Admitted photo)
                    ↓
Existing Feature: FoodImageQueue ✅
                    │
                    ↓
Existing Feature: GalleryMonitorService ✅
                    │
                    ↓
Existing Feature: GeminiApiClient ✅
                    │
                    ↓
Existing Feature: DatabaseSyncClient ✅
                    │
                    ↓
Existing Feature: Background History ✅

✅ No modifications needed to existing code
✅ Seamless integration via shared queue
✅ Same AI analysis pipeline
✅ Same database schema
```

---

**Diagrams Created**: January 7, 2025  
**Version**: 1.0.0  
**Status**: Complete ✅
