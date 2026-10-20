# Wellness Valley API inventory for load testing

Source: `backend/pages/api` (Next.js routes). No request was sent. No endpoint has a performance result.

Authentication: there is no global session middleware. Most routes take `userId` or `email` from the client and enforce team rules only where that feature has a permissions check. Cron routes use `CRON_SECRET`. `/api/ai/worker` uses `CRON_SECRET` or `WORKER_SECRET`. No shared rate limiter was found.

Database: feature APIs use the Supabase REST client. `GET /api/dashboard` is the route identified on the direct Postgres pool (`DATABASE_URL`). Photos may also be read from Cloudflare R2.

Counts: 57 read-only candidates, 52 controlled writes, 18 external or paid, 17 manual review. Every discovered route is classified. None were performance-tested. Five former read candidates were reclassified after their helpers were traced: `GET /api/ai-credits/status`, `GET /api/food-corrections/meal-image`, `GET /api/leaderboard/get-wellness-score-leaderboard`, `GET /api/wellness-score/daily`, and `GET /api/wellness-score/history` write through a called helper.

Full fields are in `loadtest/api-inventory.json`.

## 1. Safe read-only candidate

| Method | Route | Notes |
|---|---|---|
| GET | `/api/activity/report` | Coach/upline activity report. Database-heavy hierarchy read. |
| GET | `/api/activity/time-report` | Activity time report. Database-heavy. |
| GET | `/api/activity/watch-calories` | Reads watch calorie data. |
| GET | `/api/ai/job-status` | Reads in-memory enrichment job status. Does not call Gemini. |
| GET | `/api/app/version-policy` | Public version policy. Query version, platform, versionCode. No user row required. |
| GET | `/api/background-analysis/captures/image` | GET image bytes or R2/storage redirect. Storage egress, no write. |
| GET | `/api/background-analysis/captures/resolve` | Resolves a public capture. |
| GET | `/api/background-analysis/captures/unknown-share` | Resolves an unknown-capture share. |
| GET | `/api/background-analysis/public/:token` | Public capture by share token. |
| GET | `/api/body-parameters-card/history` | Card history for a member. |
| GET | `/api/body-parameters-card/list` | Lists cards visible to the caller. |
| GET | `/api/body-parameters-card/member-prefill` | Prefill for a team member. Permission in card.policy. |
| GET | `/api/coach/team-hierarchy` | Full downline tree. Database-heavy. No rate limit in the route. |
| GET | `/api/counselling/get-assessments` | Lists assessments. |
| GET | `/api/counselling/hierarchical-assessments` | Hierarchy assessment list. Database-heavy. |
| GET | `/api/counselling/my-assessment` | Reads the caller assessment. |
| GET | `/api/diary/list` | Diary list. Can be large. Supabase reads across food and captures. |
| GET | `/api/dry-salad/search` | Dry-salad search. |
| GET | `/api/dry-salad/suggestions` | Dry-salad suggestions. |
| GET | `/api/education/log-image` | GET education image. Storage egress. |
| GET | `/api/education/summary` | Education summary. |
| GET | `/api/food-corrections/global` | Global correction list. Unscoped read of every correction row. Stays blocked. |
| GET | `/api/food-corrections/meal` | One meal correction. |
| GET | `/api/food-corrections/meals` | Meal correction list. |
| GET | `/api/food-corrections/search` | Search corrections. |
| GET | `/api/food-corrections/stats` | Correction stats. |
| GET | `/api/food-suggestions` | Food suggestion search. |
| GET | `/api/leaderboard/get-global-leaderboard` | Leaderboard read. Database-heavy. Publishes a Supabase Realtime invalidate only on writes elsewhere, not on this GET. |
| GET | `/api/misc/club-attendance` | Club attendance read. |
| GET | `/api/misc/server-time` | Returns server time. No database required for the response path reviewed. |
| GET | `/api/misc/time-windows` | Reads activity time windows. |
| GET | `/api/nav-access/for-me` | Reads nav ACL for the caller. |
| GET | `/api/nutrition-centers/attendees` | Attendance rows for one center and date range. Query centerId, startDate, endDate. |
| GET | `/api/nutrition-centers/check-name` | Checks whether a club name is free. Read. |
| GET | `/api/nutrition-knowledge/custom-food-export` | Exports custom foods. Read. |
| GET | `/api/nutrition-knowledge/resolve` | Resolves a food name against the nutrition master. Read. |
| GET | `/api/nutrition-knowledge/search` | Searches nutrition knowledge. Read. |
| GET | `/api/reports/downline-weight-status` | Downline weight report. Database-heavy. Route comment says session middleware is not wired yet. |
| GET | `/api/reports/wellness-score-report` | Wellness score report. Database-heavy. |
| GET | `/api/share/og-image/:token` | Public OG image by token. Storage read. |
| GET | `/api/team/check-availability` | Checks team id availability. Read. |
| GET | `/api/team/has-members` | Whether a team has members. Read. |
| GET | `/api/testimonials/detail` | One testimonial. Signs photo URLs. Read. |
| GET | `/api/testimonials/list-for-coach` | Coach list. Hierarchy check in the service. Can be heavy for Full Team. |
| GET | `/api/testimonials/my-testimonial` | Caller testimonial. Read. |
| GET | `/api/testimonials/my-video` | Caller video testimonial. Read. |
| GET | `/api/testimonials/team-report` | Team testimonial report. Read. |
| GET | `/api/testimonials/video-report` | Video report. Read. |
| GET | `/api/user/context` | Reads caller context. |
| GET | `/api/user/get-active-coach` | Reads the active coach link. |
| GET | `/api/user/status` | Reads account status. |
| GET | `/api/water/intake` | Reads inferred water intake. Does not send reminders. |
| GET | `/api/weight-progress-tips/check` | Reads whether a tip review is due. |
| POST, GET | `/api/weight/history` | GET or POST both call getHistory. Read of weight_records_table. POST is not a write. |
| GET | `/api/weight/image` | Weight photo. Storage or R2 egress. |
| GET | `/api/weight/marathon-comparison` | Weight comparison read. |
| GET | `/api/wellness-university/get-enrollments` | Lists enrollments. Read. |

## 2. Controlled test with synthetic data required

| Method | Route | Notes |
|---|---|---|
| GET | `/api/ai-credits/status` | GET calls ensureUsageRow, which inserts a usage row. Not a safe read. |
| GET | `/api/food-corrections/meal-image` | GET can call updateFoodImageKey and redirect to R2. |
| GET | `/api/leaderboard/get-wellness-score-leaderboard` | The traced score path calls upsertDailyScore. |
| GET | `/api/wellness-score/daily` | getDailyScore calls upsertDailyScore. |
| GET | `/api/wellness-score/history` | The traced history path calls upsertDailyScore. |
| GET, POST | `/api/activity` | GET reads daily activity. POST writes steps/calories. Table daily activity via Supabase. |
| GET, POST, DELETE | `/api/activity/report/hidden-users` | GET lists hidden members. POST hides. DELETE unhides. |
| POST | `/api/ai-credits/confirm` | Confirms a reservation and increments usage. No Gemini call. |
| POST | `/api/ai-credits/release` | Releases a pending reservation. No Gemini call. |
| POST | `/api/ai-credits/reserve` | Inserts a pending AI credit reservation. No Gemini call. |
| POST, PATCH | `/api/background-analysis/captures` | POST creates a pending capture. PATCH sets the capture type. Body limit 10mb. |
| POST | `/api/background-analysis/captures/retry-promotion` | Promotes an unknown capture toward a food record. Writes. |
| POST, GET, DELETE | `/api/background-analysis` | GET lists analyses. POST saves an analysis (large body, possible image). DELETE removes one. |
| POST | `/api/background-analysis/undo` | Restores a deleted analysis. |
| GET, POST | `/api/body-parameters-card/public/:token` | GET views a card by share token. POST saves that card onto a profile and writes. Load-test GET only if POST is excluded. |
| POST | `/api/body-parameters-card/create` | Coach creates a body-parameters card. Permission checked in card.policy. |
| DELETE | `/api/body-parameters-card/delete` | DELETE removes a card. Permission checked in card.policy. |
| PATCH | `/api/body-parameters-card/update` | PATCH updates a card. |
| DELETE | `/api/captures/delete` | Deletes a capture. |
| POST | `/api/captures/undo` | Restores a capture. |
| POST | `/api/counselling/save-assessment` | Writes a counselling assessment. |
| POST, GET, DELETE | `/api/education/logs` | GET lists education logs. POST saves one, possibly with an image. DELETE removes one. |
| POST | `/api/education/undo` | Restores a deleted education log. |
| GET, POST | `/api/food-corrections` | GET lists corrections. POST saves one. |
| PUT | `/api/food-corrections/nutrition` | PUT updates nutrition fields on a correction. |
| POST, GET, DELETE | `/api/good-habits` | GET returns an image. POST saves a habit photo. DELETE removes one. Flag ff.good-habit. Body limit 10mb. May write R2. |
| GET, POST, PATCH | `/api/nutrition-centers` | GET lists clubs. POST registers. PATCH updates. Writes are synthetic-data only. |
| POST | `/api/nutrition-centers/unregister` | Soft-deletes a club owned by the caller. |
| POST | `/api/nutrition-knowledge/custom-food-nutrition` | Writes custom-food nutrition. |
| POST | `/api/nutrition-knowledge/custom-food` | Creates a custom-food submission. |
| POST | `/api/team/claim-id` | Claims a team id. Writes team membership. |
| POST | `/api/testimonials/cancel-unified-otp` | Cancels a pending OTP and may restore prior fields. |
| POST | `/api/testimonials/prepare-video-upload` | Prepares a video upload slot. |
| POST | `/api/testimonials/sync-profile-photos` | Copies profile photos into the testimonial. Writes. |
| POST | `/api/testimonials/update-health-issues` | Always returns 403. Coaches cannot edit member health issues. No email. |
| POST | `/api/testimonials/upload-video-chunk` | Uploads a video chunk. File upload. |
| POST | `/api/testimonials/verify-otp` | Checks a coach OTP and updates status. Does not send mail. |
| POST | `/api/testimonials/verify-unified-otp` | Checks the unified OTP. Does not send mail. |
| POST | `/api/testimonials/verify-video-otp` | Checks a video OTP. Does not send mail. |
| POST | `/api/upline/cancel-request` | Cancels an upline request. |
| POST | `/api/upline/validate-otp` | Validates an upline OTP and writes the request status. No outbound mail. |
| GET | `/api/user/avatar` | GET /api/user/avatar?userId=. Usually a 302 to R2 or Google. If the profile image is still a data URI, the handler can upload it to R2. Not a pure read. |
| POST | `/api/user/community-id/verify-otp` | Verifies the sponsor OTP and writes the Community ID. No outbound mail on this route. |
| POST | `/api/user/height/verify-otp` | Verifies the height OTP and writes height. No outbound mail on this route. |
| GET, POST, PUT | `/api/user/profile` | GET reads team_table profile. POST/PUT updates profile, including optional avatar payload (10mb). |
| POST | `/api/user/save-email` | Writes an email onto the user. |
| POST | `/api/user/skip-setup` | Marks setup skipped. |
| POST | `/api/user/snooze-pic` | Writes a picture-snooze timestamp. |
| POST | `/api/user/verify-onboarding-email` | Verifies an email OTP and may adopt or update the account. The OTP itself was sent earlier. |
| POST | `/api/weight-progress-tips/submit-review` | Writes a weight-progress review. |
| DELETE | `/api/weight/delete` | Deletes a weight row. |
| POST | `/api/weight/undo` | Restores a weight row. |

## 3. External side effects or paid service — exclude until explicitly approved

| Method | Route | Notes |
|---|---|---|
| POST | `/api/ai/orchestrate` | Calls Gemini (GEMINI_API_KEY) and enqueues a micronutrient job. Optional AI monitor POST if AI_MONITOR_SDK_KEY is set. |
| GET, POST | `/api/ai/worker` | Vercel cron every minute. When AI Mode is on, drains up to 3 Gemini enrichment jobs. Auth: CRON_SECRET or WORKER_SECRET. |
| POST | `/api/auth/send-otp` | Phone uses MDT SMS (MDT_SMS_*). Email uses SMTP_USER/SMTP_PASS. Demo recipient skips delivery. |
| POST | `/api/misc/detect-face` | Calls Gemini for face detection. GEMINI_API_KEY. |
| POST | `/api/nutrition-knowledge/enrich` | Calls Gemini for text nutrition. GEMINI_API_KEY. Uses an AI credit reservation. |
| POST | `/api/testimonials/edit` | Updates a testimonial and can email the coach. |
| POST | `/api/testimonials/resend-unified-otp` | Sends another coach OTP email. |
| POST | `/api/testimonials/submit-all-edits` | Writes edits and emails a unified OTP to the coach. |
| POST | `/api/testimonials/submit-video` | Saves video metadata and can email the coach. |
| POST | `/api/testimonials/submit` | Writes testimonials and emails the coach. SMTP_USER/SMTP_PASS. May upload a share card to Supabase Storage. |
| POST | `/api/upline/request` | Emails an upline OTP. SMTP_USER/SMTP_PASS. |
| POST | `/api/user/check-onboarding-email` | Reads team_table. If body sendOtp is true, sends an email OTP through the same path as /api/auth/send-otp. |
| POST | `/api/user/community-id/request` | Emails a sponsor OTP. SMTP_USER/SMTP_PASS. Writes community_id_requests_table. |
| POST | `/api/user/height/request-otp` | Sends a height-change OTP email. SMTP_USER/SMTP_PASS. |
| GET, POST | `/api/user/lookup` | Can email the coach when an active user returns after 7 idle days, and can set Status back to Active. SMTP_USER/SMTP_PASS. |
| POST | `/api/weight/save` | Inserts a weight row and can email uplines on the first BMI 19–23 milestone. May store a photo in R2 or the database. |
| POST | `/api/wellness-university/enroll` | Writes an enrollment and emails the coach. SMTP_USER/SMTP_PASS. |
| POST | `/api/wellness-university/update-enrollment` | Updates an enrollment and emails the coach. |

## 4. Security-sensitive or unclear — manual review required

| Method | Route | Notes |
|---|---|---|
| GET, POST | `/api/admin/time-windows` | Admin/developer time windows. GET reads, POST versions windows. No rate limit in the route. |
| GET, PUT | `/api/ai-credits/admin-config` | Admin AI Mode and daily credit limit. GET reads, PUT inserts a new config row. |
| POST | `/api/auth/verify-otp` | Creates or loads the account and returns the session payload. Does not send SMS or email. Security-sensitive. |
| GET | `/api/body-parameters-card/phone-search` | Team phone search. PII. |
| GET | `/api/body-parameters-card/phone-status` | Phone status lookup. PII. |
| GET | `/api/counselling/lead-by-phone` | Looks up a person by phone. PII. Manual review. |
| see file | `/api/cron/deactivate-idle-users` | Bearer CRON_SECRET. Current code does not change Status and does not send mail. Still an ops endpoint. |
| see file | `/api/cron/reactivate-user` | Bearer CRON_SECRET. Sets a user Status to Active. No SMS, email, or Gemini. |
| GET | `/api/dashboard` | GET reads request_log through the direct Postgres pool (DATABASE_URL). Query takes userId from the query string with no session check in the route. |
| GET, PUT | `/api/nav-access/admin-config` | Admin page-access configuration. |
| POST | `/api/nutrition-knowledge/approve` | Admin approve of a nutrition master profile. |
| DELETE | `/api/user/account` | DELETE removes an account. Destructive. |
| GET, DELETE, POST | `/api/user/consent` | GET reads consent. POST records consent. DELETE can discard an unconsented account. |
| POST | `/api/user/google` | Google sign-in provisioning. Security-sensitive. Confirm token verification before any automated run. |
| GET, POST | `/api/user/verify-session` | Session check. Security-sensitive. |
| GET | `/api/users/search` | User search. Authorization depends on the service; treat as manual review before a broad run. |
| GET, PUT | `/api/wellness-score/admin-config` | Admin wellness-score configuration. |

## Not a route

`backend/pages/api/ai/workerGate.js` is a helper imported by `/api/ai/worker`. It is not its own URL.

`backend/pages/api/ai/__tests__/worker.ai-mode.test.js` is a unit test, not a route.
