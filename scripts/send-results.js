const fs = require("fs");
const path = require("path");

const RESULTS_FILE = path.join(
  process.cwd(),
  "test-results",
  "results.json"
);

const API_URL =
  process.env.DASHBOARD_API_URL ||
  "http://localhost:3001/api/test-runs";

function collectTests(suites, results = []) {
  for (const suite of suites || []) {
    const fileName = suite.file || null;

    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        for (const result of test.results || []) {
          results.push({
            testName: spec.title || test.title,
            fileName,
            status: result.status,
            durationMs: result.duration || 0,
            error:
              result.error?.message ||
              result.errors?.[0]?.message ||
              null,
          });
        }
      }
    }

    collectTests(suite.suites, results);
  }

  return results;
}

async function getGitHubRun() {
  const token = process.env.GITHUB_TOKEN;
  const runId = process.env.GITHUB_RUN_ID;

  if (!token) {
    throw new Error("GITHUB_TOKEN is not set");
  }

  if (!runId) {
    throw new Error("GITHUB_RUN_ID is not set");
  }

  const owner = "Baleenmedia2512";
  const repo = "Wellness-Buddy-PWA";

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `GitHub API failed (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function main() {
  console.log("Reading Playwright results...");

  if (!fs.existsSync(RESULTS_FILE)) {
    throw new Error(
      `Results file not found: ${RESULTS_FILE}`
    );
  }

  const report = JSON.parse(
    fs.readFileSync(RESULTS_FILE, "utf8")
  );

  const testResults = collectTests(report.suites);

  console.log(
    `Found ${testResults.length} test results.`
  );

  console.log("Getting GitHub Actions run information...");

  const githubRun = await getGitHubRun();

  console.log(
    `GitHub Run: ${githubRun.id}`
  );

  console.log(
    `Commit: ${githubRun.head_sha}`
  );

  console.log(
    `Branch: ${githubRun.head_branch || "unknown"}`
  );

  console.log(
    `Developer: ${
      githubRun.actor?.login ||
      githubRun.triggering_actor?.login ||
      "Unknown"
    }`
  );

  const failedTests = testResults.filter(
    (test) =>
      test.status === "failed" ||
      test.status === "interrupted"
  );

  const runStatus =
    failedTests.length > 0
      ? "FAILED"
      : "PASSED";

  const payload = {
    githubRunId: String(githubRun.id),

    commitSha:
      githubRun.head_sha,

    developer:
      githubRun.actor?.login ||
      githubRun.triggering_actor?.login ||
      "Unknown",

    branch:
      githubRun.head_branch ||
      null,

    status: runStatus,

    event:
      githubRun.event ||
      null,

    repository:
      githubRun.repository?.full_name ||
      "Baleenmedia2512/Wellness-Buddy-PWA",

    prNumber:
      githubRun.pull_requests?.[0]?.number ||
      null,

    testResults,
  };

  console.log(
    `Sending ${testResults.length} results to dashboard...`
  );

  const response = await fetch(API_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `API failed (${response.status}): ${JSON.stringify(data)}`
    );
  }

  console.log("");
  console.log("================================");
  console.log("✅ Results successfully sent!");
  console.log("================================");
  console.log(`Run ID: ${data.githubRunId}`);
  console.log(`Status: ${data.status}`);
  console.log(`Tests: ${testResults.length}`);
}

main().catch((error) => {
  console.error("");
  console.error("❌ Failed to send results:");
  console.error(error);

  process.exit(1);
});