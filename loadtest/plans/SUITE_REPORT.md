# Consolidated load-test report

This suite run did not send HTTP requests.
Stage decisions below are not a capacity pass.

## Totals

- Discovered: 144
- Eligible: 4
- Tested stages: 0
- Skipped routes: 144
- Failed stages: 0

## Stages

- stage-1: 1 VUs for 30s — not-run. Dry-run. No request was sent.
- stage-5: 5 VUs for 30s — not-run. Dry-run. No request was sent.
- stage-10: 10 VUs for 30s — not-run. Dry-run. No request was sent.

## Eligible endpoints

Request counts, error rates, latency, and status breakdown are not available because this run did not call k6.

- `/api/dry-salad/search`: requests 0, error rate n/a, p50 n/a, p95 n/a, p99 n/a, statuses n/a
- `/api/misc/server-time`: requests 0, error rate n/a, p50 n/a, p95 n/a, p99 n/a, statuses n/a
- `/api/misc/time-windows`: requests 0, error rate n/a, p50 n/a, p95 n/a, p99 n/a, statuses n/a
- `/api/nutrition-centers/check-name`: requests 0, error rate n/a, p50 n/a, p95 n/a, p99 n/a, statuses n/a

## Platform observations

Vercel and Supabase metrics were not queried. This suite does not use platform credentials.

## Skipped routes

- `/api/activity` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/activity/report` (manual-review) — Call graph is incomplete (luxon#now, trace-limit, trace-limit). Observed query: activityType, dateRange, startDate, userId. Stays blocked.
- `/api/activity/report/hidden-users` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/activity/time-report` (manual-review) — Call graph is incomplete (luxon#now, luxon#now, luxon#fromISO). Observed query: startDate, userId. Stays blocked.
- `/api/activity/watch-calories` (manual-review) — Call graph is incomplete (../../shared/lib/datetime/index.js#test, ../../shared/lib/datetime/index.js#test, ../../shared/lib/datetime/index.js#test). Observed query: userId. Stays blocked.
- `/api/admin/time-windows` (excluded) — Called helper writes. backend/features/activity/time-windows.service.js#updateAdminTimeWindow uses .update(). Not approved.
- `/api/ai-credits/admin-config` (excluded) — Called helper writes. backend/features/ai-credits/data/ai-credits.repo.js#insertConfig uses .insert(). Not approved.
- `/api/ai-credits/confirm` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/ai-credits/release` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/ai-credits/reserve` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/ai-credits/status` (excluded) — Called helper writes. backend/features/ai-credits/data/ai-credits.repo.js#ensureUsageRow uses .insert(). Not approved.
- `/api/ai/job-status` (needs-test-data) — Required query is known (jobId) but staging values are not configured. The route stays unapproved.
- `/api/ai/orchestrate` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/ai/worker` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/app/version-policy` (needs-test-data) — Required query is known (version) but staging values are not configured. The route stays unapproved.
- `/api/auth/send-otp` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/auth/verify-otp` (excluded) — Called helper writes. backend/features/auth/auth.repository.js#markOtpVerified uses .update(). Not approved.
- `/api/background-analysis/captures` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/background-analysis/captures/image` (manual-review) — Response can redirect. Automated runs refuse cross-host redirects. Stays blocked.
- `/api/background-analysis/captures/resolve` (manual-review) — Call graph is incomplete (luxon#now, luxon#fromISO, luxon#fromISO). Observed query: token, viewerUserId. Stays blocked.
- `/api/background-analysis/captures/retry-promotion` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/background-analysis/captures/unknown-share` (manual-review) — Response can redirect. Automated runs refuse cross-host redirects. Stays blocked.
- `/api/background-analysis` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/background-analysis/public/:token` (manual-review) — Response can redirect. Automated runs refuse cross-host redirects. Stays blocked.
- `/api/background-analysis/undo` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/body-parameters-card/create` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/body-parameters-card/delete` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/body-parameters-card/history` (needs-test-data) — Read-only call graph. Required query: userId. Staging values are empty, so the route stays unapproved.
- `/api/body-parameters-card/list` (needs-test-data) — Read-only call graph. Required query: coachId. Staging values are empty, so the route stays unapproved.
- `/api/body-parameters-card/member-prefill` (needs-test-data) — Read-only call graph. Required query: coachId, userId. Staging values are empty, so the route stays unapproved.
- `/api/body-parameters-card/phone-search` (manual-review) — Security-sensitive route. Traced call graph has no database write, and it stays blocked until a separate safe test design exists.
- `/api/body-parameters-card/phone-status` (manual-review) — Security-sensitive route. Traced call graph has no database write, and it stays blocked until a separate safe test design exists.
- `/api/body-parameters-card/public/:token` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/body-parameters-card/update` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/captures/delete` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/captures/undo` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/coach/team-hierarchy` (needs-test-data) — Read-only call graph. Required query: coachId. Staging values are empty, so the route stays unapproved.
- `/api/counselling/get-assessments` (needs-test-data) — Read-only call graph. Required query: userId. Staging values are empty, so the route stays unapproved.
- `/api/counselling/hierarchical-assessments` (needs-test-data) — Read-only call graph. Required query: userId. Staging values are empty, so the route stays unapproved.
- `/api/counselling/lead-by-phone` (manual-review) — Security-sensitive route. Traced call graph has no database write, and it stays blocked until a separate safe test design exists.
- `/api/counselling/my-assessment` (needs-test-data) — Read-only call graph. Required query: userId. Staging values are empty, so the route stays unapproved.
- `/api/counselling/save-assessment` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/cron/deactivate-idle-users` (manual-review) — Security-sensitive route. Traced call graph has no database write, and it stays blocked until a separate safe test design exists.
- `/api/cron/reactivate-user` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/dashboard` (manual-review) — Security-sensitive route. Traced call graph has no database write, and it stays blocked until a separate safe test design exists.
- `/api/diary/list` (manual-review) — Call graph is incomplete (../../shared/lib/datetime/index.js#test, luxon#now, luxon#now). Observed query: date, ownerUserId, viewerUserId. Stays blocked.
- `/api/dry-salad/search` (safe) — Eligible, but this invocation did not start a stage.
- `/api/dry-salad/suggestions` (manual-review) — Call graph is incomplete (luxon#fromISO, luxon#now, luxon#fromISO). Observed query: userId. Stays blocked.
- `/api/education/log-image` (manual-review) — Response can redirect via backend/shared/lib/r2/sendImageRedirect.js#sendImageRedirect. Automated runs refuse cross-host redirects. Stays blocked.
- `/api/education/logs` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/education/summary` (manual-review) — Call graph is incomplete (../../utils/cache.js#educationSummary, ../../utils/cache.js#get, ../../utils/cache.js#set). Observed query: userId. Stays blocked.
- `/api/education/undo` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/food-corrections/global` (manual-review) — Read-only but unscoped. food-corrections.repository.js#listAllCorrections selects every food_corrections_table row, including UserId. Stays blocked.
- `/api/food-corrections` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/food-corrections/meal-image` (excluded) — Called helper writes. backend/features/food-corrections/food-corrections.repository.js#updateFoodImageKey uses .update(). Not approved.
- `/api/food-corrections/meal` (needs-test-data) — Read-only call graph. Required query: id, userId. Staging values are empty, so the route stays unapproved.
- `/api/food-corrections/meals` (needs-test-data) — Read-only call graph. Required query: ids, userId. Staging values are empty, so the route stays unapproved.
- `/api/food-corrections/nutrition` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/food-corrections/search` (needs-test-data) — Read-only call graph. Required query: query, userId. Staging values are empty, so the route stays unapproved.
- `/api/food-corrections/stats` (manual-review) — Call graph is incomplete (../../shared/lib/datetime/index.js#test, ../../shared/lib/datetime/index.js#test, luxon#now). Observed query: userId. Stays blocked.
- `/api/food-suggestions` (manual-review) — Call graph is incomplete (backend/features/food-suggestions/data/food-suggestions.repo.js#listGlobalPairsForAnchor). Observed query: userId. Stays blocked.
- `/api/good-habits` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/leaderboard/get-global-leaderboard` (manual-review) — Call graph is incomplete (luxon#now, luxon#fromISO, luxon#utc). Observed query: userId. Stays blocked.
- `/api/leaderboard/get-wellness-score-leaderboard` (excluded) — Called helper writes. backend/features/wellness-score/data/wellness-score.repo.js#upsertDailyScore uses .upsert(). Not approved.
- `/api/misc/club-attendance` (manual-review) — Call graph is incomplete (luxon#now, luxon#now, luxon#fromISO). Observed query: userId. Stays blocked.
- `/api/misc/detect-face` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/misc/server-time` (safe) — Eligible, but this invocation did not start a stage.
- `/api/misc/time-windows` (safe) — Eligible, but this invocation did not start a stage.
- `/api/nav-access/admin-config` (excluded) — Called helper writes. backend/features/nav-page-access/data/navAccess.repo.js#insertConfig uses .insert(). Not approved.
- `/api/nav-access/for-me` (needs-test-data) — Read-only call graph. Required query: userId. Staging values are empty, so the route stays unapproved.
- `/api/nutrition-centers/attendees` (needs-test-data) — Required query is known (centerId) but staging values are not configured. The route stays unapproved.
- `/api/nutrition-centers/check-name` (safe) — Eligible, but this invocation did not start a stage.
- `/api/nutrition-centers` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/nutrition-centers/unregister` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/nutrition-knowledge/approve` (excluded) — Called helper writes. backend/features/nutrition-knowledge/data/nutrition-knowledge.repo.js#approveProfile uses .update(). Not approved.
- `/api/nutrition-knowledge/custom-food-export` (manual-review) — Call graph is incomplete (./nutrition.rules.js#map). Observed query: userId. Stays blocked.
- `/api/nutrition-knowledge/custom-food-nutrition` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/nutrition-knowledge/custom-food` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/nutrition-knowledge/enrich` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/nutrition-knowledge/resolve` (needs-test-data) — Read-only call graph. Required query: name. Staging values are empty, so the route stays unapproved.
- `/api/nutrition-knowledge/search` (needs-test-data) — Read-only call graph. Required query: query. Staging values are empty, so the route stays unapproved.
- `/api/reports/downline-weight-status` (manual-review) — Call graph is incomplete (../../utils/cache.js#get, ../../utils/cache.js#set). Stays blocked.
- `/api/reports/wellness-score-report` (manual-review) — Call graph is incomplete (../../utils/cache.js#get, ../../utils/cache.js#set, luxon#now). Stays blocked.
- `/api/share/og-image/:token` (manual-review) — Response can redirect via backend/pages/api/share/og-image/[token].js#handler. Automated runs refuse cross-host redirects. Stays blocked.
- `/api/team/check-availability` (manual-review) — Requires teamId plus email or userId and can return another coach name and email. backend/pages/api/team/check-availability.js#handler. Stays blocked.
- `/api/team/claim-id` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/team/has-members` (needs-test-data) — Required query is known (userId) but staging values are not configured. The route stays unapproved.
- `/api/testimonials/cancel-unified-otp` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/testimonials/detail` (needs-test-data) — Read-only call graph. Required query: userId. Staging values are empty, so the route stays unapproved.
- `/api/testimonials/edit` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/testimonials/list-for-coach` (needs-test-data) — Read-only call graph. Required query: coachId. Staging values are empty, so the route stays unapproved.
- `/api/testimonials/my-testimonial` (needs-test-data) — Read-only call graph. Required query: userId. Staging values are empty, so the route stays unapproved.
- `/api/testimonials/my-video` (needs-test-data) — Read-only call graph. Required query: userId. Staging values are empty, so the route stays unapproved.
- `/api/testimonials/prepare-video-upload` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/testimonials/resend-unified-otp` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/testimonials/submit-all-edits` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/testimonials/submit-video` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/testimonials/submit` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/testimonials/sync-profile-photos` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/testimonials/team-report` (needs-test-data) — Read-only call graph. Required query: coachId. Staging values are empty, so the route stays unapproved.
- `/api/testimonials/update-health-issues` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/testimonials/upload-video-chunk` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/testimonials/verify-otp` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/testimonials/verify-unified-otp` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/testimonials/verify-video-otp` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/testimonials/video-report` (needs-test-data) — Read-only call graph. Required query: coachId. Staging values are empty, so the route stays unapproved.
- `/api/upline/cancel-request` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/upline/request` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/upline/validate-otp` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/user/account` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/user/avatar` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/user/check-onboarding-email` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/user/community-id/request` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/user/community-id/verify-otp` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/user/consent` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/user/context` (needs-test-data) — Read-only call graph. Required query: userId. Staging values are empty, so the route stays unapproved.
- `/api/user/get-active-coach` (needs-test-data) — Read-only call graph. Required query: userId. Staging values are empty, so the route stays unapproved.
- `/api/user/google` (excluded) — Called helper writes. backend/features/user/user.repository.js#updateUserByEmail uses .update(). Not approved.
- `/api/user/height/request-otp` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/user/height/verify-otp` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/user/lookup` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/user/profile` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/user/save-email` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/user/skip-setup` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/user/snooze-pic` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/user/status` (needs-test-data) — Read-only call graph. Required query: userId. Staging values are empty, so the route stays unapproved.
- `/api/user/verify-onboarding-email` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/user/verify-session` (excluded) — Called helper writes. backend/features/user/user.repository.js#updateUserById uses .update(). Not approved.
- `/api/users/search` (manual-review) — Security-sensitive route. Traced call graph has no database write, and it stays blocked until a separate safe test design exists.
- `/api/water/intake` (manual-review) — Call graph is incomplete (../../../shared/lib/datetime/index.js#test, ../../../shared/lib/datetime/index.js#test, luxon#now). Observed query: userId. Stays blocked.
- `/api/weight-progress-tips/check` (manual-review) — Call graph is incomplete (luxon#now, luxon#fromISO, luxon#now). Observed query: userId. Stays blocked.
- `/api/weight-progress-tips/submit-review` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/weight/delete` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/weight/history` (needs-test-data) — Required query is known (userId) but staging values are not configured. The route stays unapproved.
- `/api/weight/image` (manual-review) — Response can redirect via backend/shared/lib/r2/sendImageRedirect.js#sendImageRedirect. Automated runs refuse cross-host redirects. Stays blocked.
- `/api/weight/marathon-comparison` (manual-review) — Call graph is incomplete (luxon#now, luxon#now, luxon#fromISO). Observed query: userId. Stays blocked.
- `/api/weight/save` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/weight/undo` (excluded) — Excluded because the route is a controlled write or the handler shows a database write.
- `/api/wellness-score/admin-config` (excluded) — Called helper writes. backend/features/wellness-score/data/wellness-score.repo.js#insertConfig uses .insert(). Not approved.
- `/api/wellness-score/daily` (excluded) — Called helper writes. backend/features/wellness-score/data/wellness-score.repo.js#upsertDailyScore uses .upsert(). Not approved.
- `/api/wellness-score/history` (excluded) — Called helper writes. backend/features/wellness-score/data/wellness-score.repo.js#upsertDailyScore uses .upsert(). Not approved.
- `/api/wellness-university/enroll` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
- `/api/wellness-university/get-enrollments` (needs-test-data) — Read-only call graph. Required query: email. Staging values are empty, so the route stays unapproved.
- `/api/wellness-university/update-enrollment` (excluded) — Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.
