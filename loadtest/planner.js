/**
 * Classifies inventory routes for the load-test suite.
 * A GET route is not marked safe unless the approved catalog already
 * inspected it and the route file does not show a write or external call.
 */

const HARD_MAX_VUS = 10;
const HARD_MAX_DURATION_SECONDS = 30;

const STAGES = [
  { id: 'stage-1', vus: 1, durationSeconds: 30 },
  { id: 'stage-5', vus: 5, durationSeconds: 30 },
  { id: 'stage-10', vus: 10, durationSeconds: 30 },
];

const CAPACITY_ASSUMPTIONS = {
  registeredUsers: 3000,
  dailyActiveFraction: 0.25,
  dailyActiveUsers: 750,
  peakWindowMinutes: 15,
  peakConcurrentFractionOfDailyActive: 0.08,
  peakConcurrentUsers: 60,
  readsPerActiveUserPerMinute: 4,
  diaryReadsPerSession: 3,
  imageUploadsPerSession: 0,
  note: 'Planning assumptions only. They are not a measured capacity result. Image uploads stay excluded until a read-only representative exists.',
};

const EXTERNAL_RE = /sendMdtSms|sendTransactionalMail|createTransport\s*\(|getGenAI|GoogleGenerativeAI/;
const WRITE_RE = /\.(insert|update|upsert|delete)\s*\(/;
const REDIRECT_RE = /res\.redirect\s*\(|httpStatus:\s*302|\.status\(\s*302\s*\)/;

function scanSource(text) {
  if (typeof text !== 'string') {
    return { found: false, external: false, writes: false, redirects: false };
  }
  return {
    found: true,
    external: EXTERNAL_RE.test(text),
    writes: WRITE_RE.test(text),
    redirects: REDIRECT_RE.test(text),
  };
}

function finishRoute(route, inventoryEntry) {
  const trace = inventoryEntry && inventoryEntry.loadTrace;
  if (!trace) return route;
  if (trace.reason) route.reason = trace.reason;
  if (Array.isArray(trace.sources) && trace.sources.length) {
    route.evidenceNeeded = trace.sources.join('; ');
  }
  return route;
}

function classifyRoute(inventoryEntry, approvedEntry, sourceText) {
  const scan = scanSource(sourceText);
  const effects = inventoryEntry.effects || {};
  const approved = approvedEntry || null;
  const route = {
    route: inventoryEntry.route,
    methods: inventoryEntry.methods || [],
    sourceFile: inventoryEntry.sourceFile || '',
    sourceFound: scan.found,
    inventoryClass: inventoryEntry.classification,
    purpose: inventoryEntry.purpose || '',
    authentication: inventoryEntry.authentication || '',
    readsDatabase: effects.reads === true,
    writesDatabase: effects.modifiesData === true || scan.writes || (inventoryEntry.loadTrace && inventoryEntry.loadTrace.databaseWrite === true),
    uploadsFiles: effects.uploadsFiles === true,
    sendsSms: effects.sendsSms === true,
    sendsEmail: effects.sendsEmail === true,
    callsGeminiOrPaidService: effects.callsGeminiOrPaidService === true || scan.external,
    triggersBackgroundWork: effects.triggersBackgroundWork === true,
    mayRedirect: (approved && approved.mayRedirect === true) || scan.redirects || /redirect/i.test(inventoryEntry.purpose || ''),
    parametersKnown: approved ? approved.parametersKnown === true : false,
    requiredQuery: approved && Array.isArray(approved.requiredQuery) ? approved.requiredQuery : [],
    group: approved && approved.group ? approved.group : '',
    catalogApproved: approved ? approved.approved === true : false,
    inspected: approved ? approved.inspected === true : false,
    testDataRequirements: approved ? approved.testDataRequirements || '' : '',
  };

  const external = route.sendsSms || route.sendsEmail || route.callsGeminiOrPaidService || route.triggersBackgroundWork;
  if (route.inventoryClass === 2 || route.inventoryClass === 3 || route.writesDatabase || route.uploadsFiles || external) {
    route.status = 'excluded';
    route.reason = route.inventoryClass === 3 || external
      ? 'Excluded because the route can write data, upload a file, or call SMS, email, Gemini, or background work.'
      : 'Excluded because the route is a controlled write or the handler shows a database write.';
    return finishRoute(route, inventoryEntry);
  }

  if (route.inventoryClass === 4) {
    route.status = 'manual-review';
    route.reason = 'Security-sensitive route. Trace the handler and record an explicit human decision before any automated call.';
    route.evidenceNeeded = 'Handler trace, authorization rule, and confirmation that the call does not change accounts, sessions, or admin config.';
    return finishRoute(route, inventoryEntry);
  }

  if (!scan.found) {
    route.status = 'manual-review';
    route.reason = 'The handler source file was not found, so the route cannot be reconciled.';
    route.evidenceNeeded = 'The route file at ' + route.sourceFile + ' must be readable and traced.';
    return finishRoute(route, inventoryEntry);
  }

  if (route.mayRedirect) {
    route.status = 'manual-review';
    route.reason = 'The response may redirect to another host. Automated runs refuse cross-host redirects.';
    route.evidenceNeeded = 'Show that the staging response stays on the configured host, or keep the route out of the suite.';
    return finishRoute(route, inventoryEntry);
  }

  if (route.catalogApproved && route.inspected && route.inventoryClass === 1) {
    route.status = 'safe';
    route.reason = 'Kept from the inspected approved catalog. The route file shows no write, message, or paid-service call. GET alone was not treated as approval.';
    return finishRoute(route, inventoryEntry);
  }

  if (route.parametersKnown && route.requiredQuery.length > 0) {
    route.status = 'needs-test-data';
    route.reason = 'Required query is known (' + route.requiredQuery.join(', ') + ') but staging values are not configured. The route stays unapproved.';
    route.evidenceNeeded = 'Real staging values for ' + route.requiredQuery.join(', ') + ' in config.testData, then a separate approval review.';
    return finishRoute(route, inventoryEntry);
  }

  route.status = 'manual-review';
  route.reason = 'Required parameters or authorization behavior are not fully traced. The route stays blocked.';
  route.evidenceNeeded = 'Trace the handler, name every required query parameter, and confirm the call only reads staging data.';
  return finishRoute(route, inventoryEntry);
}

function countStatuses(routes) {
  const counts = {
    discovered: routes.length,
    safe: 0,
    'needs-test-data': 0,
    'manual-review': 0,
    excluded: 0,
  };
  routes.forEach(function (route) {
    counts[route.status] += 1;
  });
  return counts;
}

function buildPlan(inventory, approved, readSource) {
  const catalog = new Map((approved.endpoints || []).map(function (entry) {
    return [entry.path, entry];
  }));
  const routes = (inventory.endpoints || []).map(function (entry) {
    let sourceText = null;
    if (typeof readSource === 'function' && entry.sourceFile) {
      sourceText = readSource(entry.sourceFile);
    }
    return classifyRoute(entry, catalog.get(entry.route), sourceText);
  });
  const testDataKeys = {};
  routes.forEach(function (route) {
    if (route.status !== 'needs-test-data') return;
    route.requiredQuery.forEach(function (name) {
      testDataKeys[name] = 'Empty. Supply a real staging value. Do not invent an id.';
    });
  });
  return {
    performanceTested: false,
    requestsSent: false,
    hardMaxVus: HARD_MAX_VUS,
    hardMaxDurationSeconds: HARD_MAX_DURATION_SECONDS,
    counts: countStatuses(routes),
    stages: STAGES.map(function (stage) {
      return {
        id: stage.id,
        vus: stage.vus,
        durationSeconds: stage.durationSeconds,
        decision: 'not-run',
        reason: 'No live stage has been started.',
      };
    }),
    assumptions: CAPACITY_ASSUMPTIONS,
    minimumTestData: {
      accounts: [
        'One synthetic staging member, used only after its id is placed in config.testData.userId.',
        'One synthetic staging coach whose downline contains that member, only if a coach route is later approved.',
        'One synthetic staging club id, only if a center route is later approved.',
      ],
      doNotUse: 'Production user ids, tokens, phone numbers, or payment records.',
      doNotCall: 'SMS, email, payment, Gemini, cron, and account-mutation routes.',
      missingKeys: testDataKeys,
    },
    routes: routes,
  };
}

function executeStages(stages, runStage) {
  const results = [];
  let stopped = false;
  for (let i = 0; i < stages.length; i += 1) {
    if (stopped) {
      results.push({
        id: stages[i].id,
        vus: stages[i].vus,
        durationSeconds: stages[i].durationSeconds,
        decision: 'not-run',
        reason: 'Not started because a previous stage failed.',
      });
      continue;
    }
    const result = runStage(stages[i]);
    results.push(result);
    if (result.decision === 'fail') stopped = true;
  }
  return results;
}

function evidenceSuffix(route) {
  if (!route.evidenceNeeded) return '';
  return ' Evidence: ' + route.evidenceNeeded;
}

function renderSafetyReport(plan) {
  const lines = [
    '# Route safety and test-data report',
    '',
    'This report reconciles the API inventory with route files and the approved catalog.',
    'No HTTP request was sent. A route is not safe merely because it uses GET.',
    'Blocked routes were not approved by this report.',
    '',
    '## Counts',
    '',
    '- Discovered: ' + plan.counts.discovered,
    '- Safe for the current suite: ' + plan.counts.safe,
    '- Needs staging test data: ' + plan.counts['needs-test-data'],
    '- Manual review: ' + plan.counts['manual-review'],
    '- Excluded: ' + plan.counts.excluded,
    '',
    '## Capacity assumptions for 3,000 registered users',
    '',
    '- Registered users: ' + plan.assumptions.registeredUsers,
    '- Assumed daily active fraction: ' + plan.assumptions.dailyActiveFraction + ' (' + plan.assumptions.dailyActiveUsers + ' people)',
    '- Assumed peak window: ' + plan.assumptions.peakWindowMinutes + ' minutes',
    '- Assumed peak concurrency: ' + plan.assumptions.peakConcurrentFractionOfDailyActive + ' of daily active users (' + plan.assumptions.peakConcurrentUsers + ' people)',
    '- Assumed reads per active user per minute: ' + plan.assumptions.readsPerActiveUserPerMinute,
    '- Assumed diary reads per session: ' + plan.assumptions.diaryReadsPerSession,
    '- Image uploads in this suite: ' + plan.assumptions.imageUploadsPerSession + ' (uploads stay excluded)',
    '- ' + plan.assumptions.note,
    '',
    '## Minimum staging data',
    '',
  ];
  plan.minimumTestData.accounts.forEach(function (item) {
    lines.push('- ' + item);
  });
  lines.push('- Do not use: ' + plan.minimumTestData.doNotUse);
  lines.push('- Do not call: ' + plan.minimumTestData.doNotCall);
  lines.push('');
  lines.push('## Safe routes');
  lines.push('');
  plan.routes.filter(function (route) { return route.status === 'safe'; }).forEach(function (route) {
    lines.push('- `' + route.methods.join(',') + ' ' + route.route + '` — ' + route.reason + evidenceSuffix(route));
  });
  lines.push('');
  lines.push('## Needs test data');
  lines.push('');
  plan.routes.filter(function (route) { return route.status === 'needs-test-data'; }).forEach(function (route) {
    lines.push('- `' + route.route + '` — ' + route.reason + evidenceSuffix(route));
  });
  lines.push('');
  lines.push('## Manual review');
  lines.push('');
  plan.routes.filter(function (route) { return route.status === 'manual-review'; }).forEach(function (route) {
    lines.push('- `' + route.route + '` — ' + route.reason + evidenceSuffix(route));
  });
  lines.push('');
  lines.push('## Excluded');
  lines.push('');
  plan.routes.filter(function (route) { return route.status === 'excluded'; }).forEach(function (route) {
    lines.push('- `' + route.methods.join(',') + ' ' + route.route + '` — ' + route.reason + evidenceSuffix(route));
  });
  lines.push('');
  return lines.join('\n');
}

function renderConsolidatedReport(plan, stageResults) {
  const started = stageResults.filter(function (stage) {
    return stage.decision === 'pass' || stage.decision === 'fail';
  }).length;
  const failed = stageResults.filter(function (stage) { return stage.decision === 'fail'; }).length;
  const lines = [
    '# Consolidated load-test report',
    '',
    started === 0
      ? 'This suite run did not send HTTP requests.'
      : 'Stage decisions record runner exits. They are not a business-capacity pass.',
    'Stage decisions below are not a capacity pass.',
    '',
    '## Totals',
    '',
    '- Discovered: ' + plan.counts.discovered,
    '- Eligible: ' + plan.counts.safe,
    '- Tested stages: ' + started,
    '- Skipped routes: ' + (started === 0 ? plan.counts.discovered : plan.counts.discovered - plan.counts.safe),
    '- Failed stages: ' + failed,
    '',
    '## Stages',
    '',
  ];
  stageResults.forEach(function (stage) {
    lines.push('- ' + stage.id + ': ' + stage.vus + ' VUs for ' + stage.durationSeconds + 's — ' + stage.decision + '. ' + stage.reason);
  });
  lines.push('');
  lines.push('## Eligible endpoints');
  lines.push('');
  lines.push('Request counts, error rates, latency, and status breakdown are not available because this run did not call k6.');
  lines.push('');
  plan.routes.filter(function (route) { return route.status === 'safe'; }).forEach(function (route) {
    lines.push('- `' + route.route + '`: requests 0, error rate n/a, p50 n/a, p95 n/a, p99 n/a, statuses n/a');
  });
  lines.push('');
  lines.push('## Platform observations');
  lines.push('');
  lines.push('Vercel and Supabase metrics were not queried. This suite does not use platform credentials.');
  lines.push('');
  lines.push('## Skipped routes');
  lines.push('');
  plan.routes.forEach(function (route) {
    const reason = route.status !== 'safe'
      ? route.reason
      : (started === 0
        ? 'Eligible, but this invocation did not start a stage.'
        : 'Eligible for the stages that started. Per-endpoint counts stay in the runner result files.');
    lines.push('- `' + route.route + '` (' + route.status + ') — ' + reason);
  });
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  HARD_MAX_VUS: HARD_MAX_VUS,
  HARD_MAX_DURATION_SECONDS: HARD_MAX_DURATION_SECONDS,
  STAGES: STAGES,
  CAPACITY_ASSUMPTIONS: CAPACITY_ASSUMPTIONS,
  scanSource: scanSource,
  classifyRoute: classifyRoute,
  buildPlan: buildPlan,
  executeStages: executeStages,
  renderSafetyReport: renderSafetyReport,
  renderConsolidatedReport: renderConsolidatedReport,
};
