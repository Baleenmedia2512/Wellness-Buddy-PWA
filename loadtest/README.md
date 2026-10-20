# Staging load-test runner

This folder is a safety gate in front of [k6](https://grafana.com/docs/k6/latest/). It can call one approved read-only API, or one small approved group. It does not call every endpoint by default.

No performance test has been run. A file in `results/` appears only after you confirm a real run.

## What you need

- Node.js, which you already use for this project
- k6 installed and available as `k6` in PowerShell
- The staging API address, using HTTPS
- Permission to send test traffic to that staging host

Install k6, then check it:

```powershell
k6 version
```

## Configuration

Open `loadtest/config.json`.

1. Set `stagingBaseUrl` to the staging API origin, for example `https://your-staging-host`.
2. Set `allowedHost` to that same hostname, with no `https://` and no path.
3. Leave `enabled` as `false` until you have reviewed the host and want to send traffic.
4. Leave `testData` blank until you have real staging ids. The runner does not invent user ids, tokens, dates, or request bodies.

Known production hosts are rejected even if you paste them into the config. HTTP addresses are rejected. The host in `stagingBaseUrl` must match `allowedHost` exactly.

Do not put API keys, database passwords, or authorization tokens in this folder.

## Approved endpoints

`loadtest/approved-endpoints.json` lists the read-only candidates from the API inventory. Only rows with `approved: true` can be called.

Three routes are approved today, in the group `public-read`:

- `GET /api/misc/server-time`
- `GET /api/misc/time-windows`
- `GET /api/nutrition-centers/check-name`

`server-time` returns the clock. `time-windows` reads activity windows from the staging database. `check-name` is called with no name, which the handler answers without looking up a club.

Every other candidate is `blocked`. Many need a member id, club id, or token that is not configured. Routes that can redirect to image storage stay blocked because this runner refuses a redirect to another host.

Writes, OTP, SMS, email, Gemini, cron, and security-sensitive routes are not in this file.

## Dry-run

From the project folder, list one endpoint and send nothing:

```powershell
cd C:\xampp\htdocs\Wellness-Buddy-PWA
node loadtest/runner.js --dry-run --endpoint /api/misc/server-time
```

List the approved group and send nothing:

```powershell
node loadtest/runner.js --dry-run --group public-read
```

See the group names without choosing one:

```powershell
node loadtest/runner.js --dry-run
```

The dry-run prints the path, approval, and why a route is blocked. It does not print `testData` values.

## One live endpoint

After the dry-run looks right, set `enabled` to `true` and keep the staging host filled in. Then:

```powershell
node loadtest/runner.js --confirm --endpoint /api/misc/server-time
```

Optional limits, still capped at 5 virtual users and 30 seconds:

```powershell
node loadtest/runner.js --confirm --endpoint /api/misc/server-time --vus 1 --duration 30s
```

`--confirm` is required. Without it, the runner stops before any request. `--dry-run` always wins if you pass both flags.

To test the three approved reads together:

```powershell
node loadtest/runner.js --confirm --group public-read --vus 1 --duration 30s
```

## How to read the result

A confirmed run writes two files in `loadtest/results/`:

- `*.summary.json` — k6 timing numbers
- `*.md` — a short report in plain language

Look at these fields:

- **Iterations** — how many requests the virtual users completed
- **Failed request rate** — network failures and HTTP 5xx
- **p95 latency** — 95 percent of requests finished at or under this time
- **Check pass rate** — how often the status, and a few known JSON fields, matched

Each virtual user waits 1 second after a completed request before starting the next one. The runner rejects a cap above 10 virtual users or 30 seconds. With one virtual user, a 30-second run therefore sends about 30 requests, not a continuous burst.

`config.maxFailureRate` is sent to k6 as the `http_req_failed` threshold. The run fails when the failed-request rate goes above that configured value. k6 treats network failures and HTTP 5xx as failed requests. Crossing that rate stops the run, and the runner prints that the run failed.

The runner also stops the test if it sees a redirect, if server errors reach the configured count (default 5), or if one virtual user sees too many unexpected statuses (default 10).

A status of 200, or a passed check, only means the HTTP response looked like the expected shape. It does not prove the meal, weight, score, or team data is correct.

## Suite

`node loadtest/suite.js` plans all 144 inventory routes and can run the eligible group through the existing runner. A dry-run sends nothing:

```powershell
node loadtest/suite.js --dry-run
node loadtest/suite.js --dry-run --group public-read --stage stage-1
```

A live stage also needs `config.enabled` set to `true` and stops after the first failed stage:

```powershell
node loadtest/suite.js --confirm
```

Stages are 1, 5, and 10 virtual users for 30 seconds. The reports are `loadtest/plans/SAFETY_REPORT.md` and `loadtest/plans/SUITE_REPORT.md`.

## Safety limits

- Maximum 10 virtual users and 30 seconds
- 1 second pause after each completed request
- Failed-request rate must stay at or below `config.maxFailureRate`
- HTTPS only, and only the configured staging host
- No redirect is followed
- No request body is sent
- Blocked endpoints are not called
- Secrets and tokens are not printed
