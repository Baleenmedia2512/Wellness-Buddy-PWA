# How to deploy the backend with a zip

This is a **separate** guide. Use only this file for a backend zip deploy.

Use this when many backend files changed, or more than one person on the team changed files.

Pushing to GitHub does **not** update the live API. You still do these steps on MilesWeb.

Do not put passwords, API keys, or `.env` contents in this file.

| What | Where |
|---|---|
| Live API | `/home/yvyunomg/wellness-api` |
| Live website | `/home/yvyunomg/wellnessvalley` — do **not** use that folder here |

FTP cannot see `wellness-api`. Use cPanel **File Manager**.

---

## 0. Team rule

Do not have four people upload separately.

1. Merge all work into **one branch**.
2. Push to GitHub.
3. Wait for GitHub Actions tests to pass.
4. **One person** deploys once.

---

## 1. Make the zip on this computer

Open a terminal. Paste this. Press Enter. Wait until the prompt comes back.

```bash
cd "/home/rameshbalaeasy2work/Documents/Easy2work Project Folder/Wellness-Buddy-PWA/backend"

zip -r "$HOME/Desktop/wellness-api-update.zip" . \
  -x "node_modules/*" \
  -x "node_modules/**" \
  -x ".env" \
  -x ".env.*" \
  -x ".next/*" \
  -x ".next/**"
```

Check Desktop. You must see `wellness-api-update.zip`.

Zip the **contents** of `backend`, not the `backend` folder itself. After extract, the server must show `features` and `pages` inside `wellness-api`, not `wellness-api/backend/features`.

Do not put these in the zip:

- `.env`
- `node_modules`
- `.next`

---

## 2. Upload the zip

1. Open cPanel **File Manager**.
2. Open `/home/yvyunomg/wellness-api`.
3. Do **not** open `wellnessvalley`.
4. Click **Upload**.
5. Do **not** tick **Overwrite existing files**.
6. Click **Select File**.
7. Choose Desktop → `wellness-api-update.zip`.
8. Wait until the bar says **100%**.
9. Click **Go Back to "/home/yvyunomg/wellness-api"**.
10. Confirm `wellness-api-update.zip` is in the list.

If an old `wellness-api.zip` is also there, leave it. Do **not** extract that one.

---

## 3. Show hidden files

1. Top right → **Settings**.
2. Tick **Show Hidden Files (dotfiles)**.
3. **Save**.
4. Confirm `.env` is in the list.
5. **Never delete `.env`.** That is the live password file.

---

## 4. Delete old code first

cPanel **Extract** does not replace a file that is already there. Delete the old copy, then extract.

Delete **one item at a time**: click it → right-click **Delete** → **Yes**.

### Delete these folders

- `features`
- `pages`
- `shared`
- `utils`
- `scripts`
- `prisma`
- `routes`
- `controllers`
- `models`
- `services`
- `migrations`
- `public`

### Delete these files

- `package.json`
- `package-lock.json`
- `next.config.js`
- `server.js`
- `jsconfig.json`
- `vercel.json`
- `force_prod.js`
- `capacitor.config.json`
- `deployment-report.json`
- `AGENTS.md`
- `backend.md`
- `CLAUDE.md`

### Do not delete these

- `.env`
- `node_modules`
- `.next`
- `tmp`
- `android`
- `coverage`
- `stderr.log`
- `wellness-api-update.zip`
- `wellness-api.zip` (old zip, if present)

When this step is done, the folder should look almost empty except the keep list above.

---

## 5. Extract

1. Click **`wellness-api-update.zip`** only. Not `wellness-api.zip`.
2. Top bar → **Extract**.
3. Path must be `/wellness-api` (that is `/home/yvyunomg/wellness-api`).
4. Do not change the path.
5. Click **Extract** in the popup. Not Cancel.
6. Wait until it finishes.

### Check

Correct:

- `features`
- `pages`
- `shared`
- `package.json`

are inside `/home/yvyunomg/wellness-api`.

Wrong: a new folder named `backend` appears (`wellness-api/backend/features`). Stop. Do not Restart.

You may delete `wellness-api-update.zip` after a correct extract. You do not have to.

---

## 6. Build on the server

Copying files is not enough. The live app still runs the old build until you build and then Restart.

1. cPanel search → **Terminal**.
2. Paste. Enter.

```bash
cd /home/yvyunomg/wellness-api
```

3. Paste. Enter.

```bash
NODE_ENV=production /opt/alt/alt-nodejs20/root/usr/bin/node node_modules/next/dist/bin/next build --webpack
```

4. Wait. Do not close the tab.

Success: a route list prints (`/api/weight/history`, `/api/share`, …) and the prompt comes back with no `Error`.

Fail: red `Error` or `Build failed`. **Do not Restart.**

`GLIBC` lines are warnings. Ignore them. Do not use Turbopack.

---

## 7. Restart — success only

1. cPanel search → **Setup Node.js App**.
2. Row `wellnessvalley.in/api` → Actions → the **round arrows** (Restart).
3. Do not click Stop (square), Edit (pencil), or Delete (trash).
4. Wait until Status is green **started**.

---

## 8. Check it worked

1. Open:

```
http://wellnessvalley.in/api/misc/server-time
```

It must return JSON, for example a `date` and `timezone`. It must not show the website HTML.

2. Open `http://wellnessvalley.in`, log in, open **Diary**.

If login calls `/api/api/...`, the website address was built with `/api` on the end. Rebuild the website with `http://wellnessvalley.in` or `https://wellnessvalley.in` only. No `/api` at the end.

---

## 9. What you do not do for a backend-only deploy

- Do not upload a website zip to `wellnessvalley`.
- Do not build a new APK.
- Do not extract into `wellnessvalley`.
- Do not Restart after a failed build.
- Do not turn the old Vercel sites back on.
