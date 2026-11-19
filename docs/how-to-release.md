# How to test, go live, and release

This is the step-by-step for Wellness Valley on this computer and on MilesWeb.

Do not put passwords, API keys, or the Android keystore password in this file or in chat.

The old Vercel sites are off. Do not turn these lines back on:

- `https://wellness-valley.vercel.app`
- `https://wellness-valley-pwa-backend-test.vercel.app`

---

## 1. The three places

| Place | What people open | Which env file the app build reads | Address inside the app |
|---|---|---|---|
| This computer | `http://localhost:3001` (the page `npm start` prints) | `frontend/.env` | `http://localhost:3000` |
| Live website | `http://wellnessvalley.in` | The address baked in when the website zip was built | `http://wellnessvalley.in` today |
| Play Store and App Store | The installed app | `frontend/.env.production` | `https://wellnessvalley.in` |

There is no second MilesWeb test website. Vercel had a test site and a live site. Here, testing means this computer. Live means `wellnessvalley.in`.

`localhost:3000` is only the API on this computer. The phone does not use it. `backend/.env` does not use it.

The database is the same for this computer and the live site:

| Item | Value |
|---|---|
| Type | MySQL on MilesWeb |
| Host | `spectrum.herosite.pro` |
| Database | `yvyunomg_wellness_valley` |
| User | `yvyunomg_wellnessvalley` |

A food photo saved on this computer is saved in that same database. It shows on the live website.

---

## 2. How to switch the address

Only one `REACT_APP_API_BASE_URL` line may be without a `#`.

A `#` at the start of a line turns that line off.

### This computer — `frontend/.env`

On now:

```
REACT_APP_API_BASE_URL=http://localhost:3000
```

Off:

```
# REACT_APP_API_BASE_URL=https://wellnessvalley.in
# REACT_APP_PRODUCTION_HOSTS=wellnessvalley.in
```

Use this file when you run `npm start`. Do not point this file at the live site unless you mean to test against the live API from this computer.

### Store build — `frontend/.env.production`

On now:

```
REACT_APP_API_BASE_URL=https://wellnessvalley.in
REACT_APP_PRODUCTION_HOSTS=wellnessvalley.in
```

Do not add `/api` at the end. The app adds `/api` itself. `https://wellnessvalley.in/api` makes the app call `/api/api/...` and those calls fail.

`npm start` does not read `.env.production`. A store build does.

---

## 3. Check on this computer

1. Open a terminal in the `backend` folder.
2. Run `npm run dev:local`.
3. Wait until it says the server is ready on port **3000**.
4. Open a second terminal in the `frontend` folder.
5. Run `npm start`.
6. If it says port 3000 is already used, let it open on **3001**.
7. Open the page it prints. Log in. Open Diary.

Stop both terminals when you are done. Closing the terminal stops that server.

---

## 4. Server folders (do not mix these up)

| What | Folder on MilesWeb |
|---|---|
| Website | `/home/yvyunomg/wellnessvalley` |
| API (Node) | `/home/yvyunomg/wellness-api` |
| Photos | `wellnessvalley/uploads` |

The website is `http://wellnessvalley.in`. The API is `http://wellnessvalley.in/api`.

cPanel **Extract** does not replace a file that is already there. Delete the old file first, then upload the new one.

Never delete these:

- `uploads`
- `cgi-bin`
- `php.ini`
- `api`
- `emoji`
- `flags`
- photo files

The FTP user cannot see `wellness-api`. Upload API files with cPanel **File Manager**.

---

## 5. You changed a backend file

Examples: a file under `backend/`, an API route, `foodTimestamp.js`.

The running site keeps the old code until you build and then restart. Copying the file alone is not enough.

1. On your computer, change the file in the `backend` folder.
2. In cPanel File Manager, open `/home/yvyunomg/wellness-api` and the same folder path.
3. Delete the old copy of that file.
4. Upload the new file into that same folder.
5. Open cPanel **Terminal** for the Node app (Node 20).
6. Run this. Wait until the route list prints. Do not restart if the build stops with an error.

```
cd /home/yvyunomg/wellness-api
NODE_ENV=production /opt/alt/alt-nodejs20/root/usr/bin/node node_modules/next/dist/bin/next build --webpack
```

7. cPanel → **Setup Node.js App** → the `wellness-api` app → **Restart**.

Do not use Turbopack. `GLIBC` lines are warnings. A failed build can leave a half-written `.next` folder. The old process still serves the previous code until Restart, so do not restart after a failed build.

You do **not** upload a new website zip for a backend-only change. You do **not** build a new APK for a backend-only change.

---

## 6. You changed a frontend file for the website

Examples: a screen, a button, Diary list code in `frontend/src`.

The live website is a built copy. Saving the source file on your computer does not change `wellnessvalley.in`.

1. On your computer, change the file in the `frontend` folder.
2. Build the website. For the site that is online today, the address is still `http://wellnessvalley.in` until HTTPS works (see section 8).

```
cd frontend
REACT_APP_API_BASE_URL=http://wellnessvalley.in npm run build
```

After HTTPS works, use `https://wellnessvalley.in` with no `/api` on the end.

3. Zip the **contents** of `frontend/build` (the files inside `build`, not the `build` folder itself). Include `.htaccess`.
4. In File Manager, open `/home/yvyunomg/wellnessvalley`.
5. Delete the old website files only: `index.html`, the `static` folder, the manifest files, the service worker files, and the old zip.
6. Leave `uploads`, `cgi-bin`, `php.ini`, `api`, `emoji`, `flags`, and photos in place.
7. Upload the new zip and extract it.
8. Open `http://wellnessvalley.in` and confirm the new page loads.

You do **not** rebuild the Node API for a website-only change.

---

## 7. You changed something the phone app must contain

The phone app does not read your computer files. It contains a copy made at build time.

Build a new Android file when the change is in `frontend/src` and you want the phone to have it. A backend-only change needs section 5, not a new APK.

The file `WellnessValley.apk` on the Desktop is a test install. It uses `http://wellnessvalley.in`. Do not upload that file to the Play Store.

Test install on your own phone:

1. Raise `versionCode` in `frontend/android/app/build.gradle` by 1. The test file already uses **77**. The next test file must be **78** or higher. Never go backwards.
2. Build with the test address (no `/api` on the end):

```
cd frontend
REACT_APP_API_BASE_URL=http://wellnessvalley.in npm run build
npx cap sync android
```

3. Build the release APK with JDK 21 and the Gradle that is already on this Mac (`gradle-8.14.3`). `./gradlew` re-downloads and can time out.
4. Copy the new `app-release.apk` to the phone and install it. It replaces the previous test app with the same signature.
5. If the Play Store copy of the app is on the phone, uninstall that copy first. The Play copy is signed by Google and will not update from this test file.

---

## 8. Before a Play Store or App Store release

Do these first. The store apps must call `https://wellnessvalley.in`.

1. In MilesWeb, turn on **AutoSSL** for `wellnessvalley.in`.
2. Open `https://wellnessvalley.in` in a browser. The lock icon must be for the name `wellnessvalley.in`.
3. If the lock is wrong, do not build the store files yet. The site that is online can stay on `http://wellnessvalley.in` until the lock is correct.
4. `frontend/.env.production` already says `https://wellnessvalley.in`. Leave the Vercel lines off.

Then set one new version in all of these. The numbers must match, and the Android code must be **higher** than the version already shown in Play Console:

| File | What to change |
|---|---|
| `frontend/src/config/version.js` | `VERSION`, `VERSION_CODE`, `IOS_BUILD_NUMBER`, `PLATFORMS` |
| `frontend/android/app/build.gradle` | `versionCode` and `versionName` |
| `frontend/ios/App/App.xcodeproj/project.pbxproj` | `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` |
| `frontend/ios/App/App/Info.plist` | short version and build number |
| `frontend/package.json` | `version` |

Today these are not all the same. `version.js` still says Android code **74** and iOS build **76**. The Android project says code **77**. The iPhone project says build **77**. For the store, pick the next number above whatever Play Console and App Store Connect already show, then put that same pair in every file in the table.

`versionName` is the name people see, such as `3.5.3`. `versionCode` is the Android number and must go up by at least 1 on every Play upload. Do not confuse the two.

---

## 9. Play Store

1. Build from the `frontend` folder. `.env.production` supplies `https://wellnessvalley.in`. Do not pass the `http://` test address for this build.

```
cd frontend
npm run build
npx cap sync android
```

2. Build an **Android App Bundle** (`.aab`), not the Desktop test APK. Sign it with the same upload keystore already used for this app on Play.
3. Open Play Console → **Production** → create a release → upload the `.aab` → send it for review.

Play review can take time. Old phones keep the previous app until Google rolls the new one out. The API must keep working for the old app. Do not remove an old API behaviour while those phones are still allowed.

---

## 10. App Store

1. The iPhone file on the Desktop cannot be submitted. It is a development install only. It installs from Xcode onto a registered phone, not from the App Store.
2. Sign the archive with **Apple Distribution**.
3. In Xcode: Product → Archive → Distribute App → App Store Connect.
4. In App Store Connect, submit that build for review.

You need an Apple Distribution certificate for this. A development certificate is not enough.

---

## 11. What to do for each kind of change

| You changed | Do this | Do not do this |
|---|---|---|
| Backend / API file only | Section 5: upload that file, webpack build, Restart | Do not upload a website zip. Do not build an APK. |
| Website screen only | Section 6: `npm run build`, new zip, extract on the website folder | Do not restart Node unless the API also changed. |
| Phone behaviour | Section 7 for your own phone. Sections 8–10 for the stores | Do not upload the Desktop test APK to Play. |
| `frontend/.env` only | Restart `npm start` on this computer | The live site and the phone do not read this file. |
| `frontend/.env.production` only | Build a new store app (sections 9 and 10) | `npm start` ignores this file. |
| Database password or `backend/.env` on the server | Change it in the Node app env in cPanel, then Restart | Do not commit `.env`. |

---

## 12. Quick checks after a change

1. Open `http://wellnessvalley.in/api/misc/server-time`. It should answer, not show the website HTML.
2. Log in on the website and open Diary.
3. On the phone, only after you install a new build: save one photo and confirm Diary shows it without leaving the screen.
4. If login calls `/api/api/...`, the address was built with `/api` on the end. Rebuild with the origin only: `https://wellnessvalley.in` or `http://wellnessvalley.in`.
