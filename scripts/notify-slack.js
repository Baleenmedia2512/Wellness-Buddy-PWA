#!/usr/bin/env node
/**
 * notify-slack.js — posts deploy/rollback status to a Slack webhook.
 */
const https = require('https');
const url = process.env.SLACK_WEBHOOK;
if (!url) { console.log('No SLACK_WEBHOOK — skip.'); process.exit(0); }
const payload = JSON.stringify({
  text: `*Deploy ${process.env.STATUS || 'unknown'}* — sha \`${(process.env.SHA || '').slice(0, 12)}\` by ${process.env.GITHUB_ACTOR || 'ci'}`
});
const u = new URL(url);
const req = https.request({ method: 'POST', hostname: u.hostname, path: u.pathname + u.search,
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, r => { r.on('data', () => {}); r.on('end', () => process.exit(0)); });
req.on('error', e => { console.error(e); process.exit(0); });
req.write(payload); req.end();
