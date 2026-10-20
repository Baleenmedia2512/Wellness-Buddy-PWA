/**
 * Plans the load-test suite and, only after confirmation, asks the
 * existing runner to execute one stage at a time.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const planner = require('./planner');

const ROOT = __dirname;
const REPO = path.join(ROOT, '..');
const PLAN_DIR = path.join(ROOT, 'plans');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const PRODUCTION_HOSTS = new Set([
  'wellness-valley.vercel.app',
  'wellness-buddy-pwa.vercel.app',
  'app.wellnessvalley.app',
  'www.wellnessvalley.app',
  'wellnessvalley.app',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readSource(relativePath) {
  const fullPath = path.join(REPO, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf8');
}

function parseArgs(argv) {
  const out = { dryRun: false, confirm: false, group: 'public-read', stage: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--confirm') out.confirm = true;
    else if (arg === '--group') out.group = argv[++i] || '';
    else if (arg === '--stage') out.stage = argv[++i] || '';
    else if (arg === '--help' || arg === '-h') out.help = true;
    else {
      console.error('Unknown argument: ' + arg);
      process.exit(1);
    }
  }
  return out;
}

function selectedStages(stageId) {
  if (!stageId) return planner.STAGES.slice();
  const found = planner.STAGES.filter(function (stage) { return stage.id === stageId; });
  if (!found.length) {
    console.error('Unknown stage. Use stage-1, stage-5, or stage-10.');
    process.exit(1);
  }
  return found;
}

function restoreEnabledFalse(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  const next = raw.replace(/("enabled"\s*:\s*)true\b/, '$1false');
  if (next !== raw) fs.writeFileSync(configPath, next);
  return next !== raw;
}

function armEnabledReset(configPath) {
  const restore = function () { restoreEnabledFalse(configPath); };
  process.on('exit', restore);
  process.once('SIGINT', function () {
    restore();
    process.exit(130);
  });
  process.once('SIGTERM', function () {
    restore();
    process.exit(143);
  });
}

function stagingProblem(config) {
  let parsed;
  try {
    parsed = new URL(String(config.stagingBaseUrl || ''));
  } catch (err) {
    return 'stagingBaseUrl is not a valid URL.';
  }
  if (parsed.protocol !== 'https:') return 'The staging URL must use HTTPS.';
  const host = parsed.hostname.toLowerCase();
  const allowed = String(config.allowedHost || '').trim().toLowerCase();
  if (!allowed || host !== allowed) return 'The staging host must exactly match allowedHost.';
  if (PRODUCTION_HOSTS.has(host)) return 'Production hosts are rejected.';
  if (host === 'supabase.co' || host.endsWith('.supabase.co')) return 'Supabase hosts are rejected.';
  return '';
}

function groupProblem(plan, group) {
  const members = plan.routes.filter(function (route) { return route.group === group; });
  if (!members.length) return 'That group has no catalog routes.';
  const blocked = members.filter(function (route) { return route.status !== 'safe'; });
  if (blocked.length) return 'That group includes routes that are not safe. Blocked routes stay unapproved.';
  return '';
}

function writeReports(plan, stageResults) {
  fs.mkdirSync(PLAN_DIR, { recursive: true });
  const planPath = path.join(PLAN_DIR, 'test-plan.json');
  const safetyPath = path.join(PLAN_DIR, 'SAFETY_REPORT.md');
  const suitePath = path.join(PLAN_DIR, 'SUITE_REPORT.md');
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
  fs.writeFileSync(safetyPath, planner.renderSafetyReport(plan));
  fs.writeFileSync(suitePath, planner.renderConsolidatedReport(plan, stageResults));
  return { planPath: planPath, safetyPath: safetyPath, suitePath: suitePath };
}

function printSummary(plan, stageResults) {
  console.log('Discovered: ' + plan.counts.discovered);
  console.log('Safe: ' + plan.counts.safe);
  console.log('Needs test data: ' + plan.counts['needs-test-data']);
  console.log('Manual review: ' + plan.counts['manual-review']);
  console.log('Excluded: ' + plan.counts.excluded);
  const started = stageResults.some(function (stage) {
    return stage.decision === 'pass' || stage.decision === 'fail';
  });
  console.log('Requests sent: ' + (started ? 'only if a stage reached the runner' : 'no'));
  stageResults.forEach(function (stage) {
    console.log(stage.id + ': ' + stage.decision);
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log([
      'Usage:',
      '  node loadtest/suite.js --dry-run',
      '  node loadtest/suite.js --dry-run --group public-read --stage stage-1',
      '  node loadtest/suite.js --confirm',
      '  node loadtest/suite.js --confirm --stage stage-1',
      '',
      'With no --stage, --confirm runs stage-1, stage-5, and stage-10 in that order.',
      'A live stage also requires config.enabled true. The suite sets it back to false when that run ends or is interrupted.',
      'The suite stops after the first failed stage.',
      'VUs stay within the runner cap of 10. Duration stays within 30 seconds.',
    ].join('\n'));
    return;
  }

  const inventory = readJson(path.join(ROOT, 'api-inventory.json'));
  const approved = readJson(path.join(ROOT, 'approved-endpoints.json'));
  const config = readJson(CONFIG_PATH);
  const plan = planner.buildPlan(inventory, approved, readSource);
  const stages = selectedStages(args.stage);
  const dryRun = args.dryRun || !args.confirm;
  const liveAttempt = !dryRun && config.enabled === true;
  if (liveAttempt) armEnabledReset(CONFIG_PATH);

  let stageResults;
  try {
    stageResults = planner.executeStages(stages, function (stage) {
    if (dryRun || config.enabled !== true) {
      return {
        id: stage.id,
        vus: stage.vus,
        durationSeconds: stage.durationSeconds,
        decision: 'not-run',
        reason: dryRun
          ? 'Dry-run. No request was sent.'
          : 'config.enabled is false. The stage was not started.',
      };
    }
    if (stage.vus > planner.HARD_MAX_VUS || stage.durationSeconds > planner.HARD_MAX_DURATION_SECONDS) {
      return {
        id: stage.id,
        vus: stage.vus,
        durationSeconds: stage.durationSeconds,
        decision: 'fail',
        reason: 'Stage exceeds the runner cap of 10 VUs and 30 seconds.',
      };
    }
    const hostProblem = stagingProblem(config);
    if (hostProblem) {
      return {
        id: stage.id,
        vus: stage.vus,
        durationSeconds: stage.durationSeconds,
        decision: 'fail',
        reason: hostProblem,
      };
    }
    const blockedGroup = groupProblem(plan, args.group);
    if (blockedGroup) {
      return {
        id: stage.id,
        vus: stage.vus,
        durationSeconds: stage.durationSeconds,
        decision: 'fail',
        reason: blockedGroup,
      };
    }
    const child = spawnSync(process.execPath, [
      path.join(ROOT, 'runner.js'),
      '--confirm',
      '--group',
      args.group,
      '--vus',
      String(stage.vus),
      '--duration',
      String(stage.durationSeconds) + 's',
    ], { stdio: 'inherit', cwd: REPO });
    if (child.error || child.status !== 0) {
      return {
        id: stage.id,
        vus: stage.vus,
        durationSeconds: stage.durationSeconds,
        decision: 'fail',
        reason: 'The runner exited without a clean stage. Later stages were not started.',
      };
    }
    return {
      id: stage.id,
      vus: stage.vus,
      durationSeconds: stage.durationSeconds,
      decision: 'pass',
      reason: 'The runner exited 0. This is an HTTP-stage result, not a business-capacity pass.',
    };
    });
  } finally {
    if (liveAttempt) restoreEnabledFalse(CONFIG_PATH);
  }

  plan.stages = stageResults;
  plan.requestsSent = false;
  const written = writeReports(plan, stageResults);
  printSummary(plan, stageResults);
  console.log('Safety report: ' + written.safetyPath);
  console.log('Suite report: ' + written.suitePath);
  if (!dryRun && config.enabled === true && stageResults.some(function (stage) { return stage.decision === 'fail'; })) {
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  parseArgs: parseArgs,
  selectedStages: selectedStages,
  restoreEnabledFalse: restoreEnabledFalse,
  stagingProblem: stagingProblem,
  groupProblem: groupProblem,
};
