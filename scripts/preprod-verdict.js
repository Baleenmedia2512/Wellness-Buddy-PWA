#!/usr/bin/env node
/**
 * preprod-verdict.js — emits final pre-prod GO/NO-GO decision.
 */
const fs = require('fs');
const glob = process.argv[2];
const files = require('child_process').execSync(`bash -c "ls ${glob} 2>/dev/null || true"`).toString().trim().split('\n').filter(Boolean);
if (!files.length) { console.error('No QA bot reports found.'); process.exit(1); }
let go = true;
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log(`${f}: ${r.recommendation} (score ${r.productionConfidenceScore})`);
  if (r.recommendation !== 'GO') go = false;
}
console.log('\nFINAL VERDICT:', go ? 'GO' : 'NO-GO');
process.exit(go ? 0 : 1);
