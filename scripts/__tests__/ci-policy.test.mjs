import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflowsDir = path.join(repositoryRoot, ".github", "workflows");

const APPROVED_ACTIONS = new Set([
  "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
]);
const APPROVED_RUN_LINES = new Set([
  "node trusted/scripts/pr-policy.mjs",
  "node trusted/scripts/validate.mjs candidate",
  "npm ci --ignore-scripts",
  "npm run test:maintenance",
  "npm run validate",
]);
const MAINTENANCE_PATHS = [
  ".github/workflows/**",
  "package-lock.json",
  "package.json",
  "scripts/**",
  "vendor/**",
];

async function workflowFileNames() {
  return (await readdir(workflowsDir)).filter((name) => /\.ya?ml$/u.test(name));
}

async function parseWorkflow(fileName) {
  const source = await readFile(path.join(workflowsDir, fileName), "utf8");
  const document = parseDocument(source, { uniqueKeys: true });
  assert.deepEqual(document.errors, [], `${fileName} must be valid YAML`);
  return { source, workflow: document.toJS() };
}

async function workflowCommands(fileName) {
  const { workflow } = await parseWorkflow(fileName);
  return Object.values(workflow.jobs ?? {}).flatMap((job) =>
    (job.steps ?? [])
      .map((step) => step.run)
      .filter((command) => typeof command === "string"),
  );
}

test("PR and main workflows never execute third-party runners", async () => {
  const workflowFiles = await workflowFileNames();
  const workflowSources = await Promise.all(
    workflowFiles.map((name) => readFile(path.join(workflowsDir, name), "utf8")),
  );
  const allWorkflowText = workflowSources.join("\n");

  assert.doesNotMatch(allWorkflowText, /validate:runner/u);
  assert.doesNotMatch(allWorkflowText, /runner-sandbox/u);
  assert.doesNotMatch(allWorkflowText, /\bdocker\b/iu);
});

test("every workflow step is limited to approved repository gates", async () => {
  for (const fileName of await workflowFileNames()) {
    const { workflow } = await parseWorkflow(fileName);
    assert.equal(workflow.defaults, undefined, `${fileName} must not override workflow run defaults`);
    for (const job of Object.values(workflow.jobs ?? {})) {
      assert.equal(job.uses, undefined, `${fileName} must not call a reusable workflow`);
      assert.equal(job.container, undefined, `${fileName} must not run in a job container`);
      assert.equal(job.services, undefined, `${fileName} must not start job services`);
      assert.equal(job.defaults, undefined, `${fileName} must not override job run defaults`);
      for (const step of job.steps ?? []) {
        assert.equal(step.shell, undefined, `${fileName} must not use a custom shell`);
        if (typeof step.uses === "string") {
          assert.ok(
            APPROVED_ACTIONS.has(step.uses),
            `${fileName} uses unapproved action or local code: ${step.uses}`,
          );
        }
        if (typeof step.run === "string") {
          const lines = step.run
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
          assert.ok(lines.length > 0, `${fileName} contains an empty run step`);
          for (const line of lines) {
            assert.ok(
              APPROVED_RUN_LINES.has(line),
              `${fileName} invokes an unapproved command: ${line}`,
            );
            if (line === "npm run test:maintenance") {
              assert.equal(
                fileName,
                "maintenance-tests.yml",
                "maintenance tests must not run from an ordinary validation workflow",
              );
            }
          }
        }
      }
    }
  }
});

test("maintenance tests remain limited to maintainer infrastructure changes", async () => {
  const { workflow } = await parseWorkflow("maintenance-tests.yml");
  assert.deepEqual(
    [...workflow.on.pull_request.paths].sort(),
    [...MAINTENANCE_PATHS].sort(),
  );
  assert.deepEqual(
    [...workflow.on.push.paths].sort(),
    [...MAINTENANCE_PATHS].sort(),
  );
  assert.deepEqual(workflow.on.pull_request.branches, ["main"]);
  assert.deepEqual(workflow.on.push.branches, ["main"]);
  assert.equal(
    workflow.jobs["maintenance-tests"].if,
    "github.event_name == 'push' || github.event.pull_request.user.login == '502399493zjw-lgtm'",
  );
});

test("ordinary candidate and main validation omit maintenance tests", async () => {
  const candidateCommands = await workflowCommands("candidate-validation.yml");
  const mainCommands = await workflowCommands("main-integrity.yml");

  for (const command of [...candidateCommands, ...mainCommands]) {
    assert.doesNotMatch(command, /\bnpm\s+test(?:\s|$)/u);
    assert.doesNotMatch(command, /npm\s+run\s+test:maintenance/u);
  }
  assert.ok(candidateCommands.some((command) => /npm\s+run\s+validate/u.test(command)));
  assert.ok(mainCommands.some((command) => /npm\s+run\s+validate/u.test(command)));
});

test("validator tests are isolated behind the maintenance-only command", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  const maintenanceCommands = await workflowCommands("maintenance-tests.yml");

  assert.equal(packageJson.scripts.test, undefined);
  assert.equal(packageJson.scripts["validate:runner"], undefined);
  assert.equal(packageJson.scripts.validate, "node scripts/validate.mjs");
  assert.equal(
    packageJson.scripts["test:maintenance"],
    "node --test scripts/__tests__/*.test.mjs",
  );
  assert.ok(
    maintenanceCommands.some((command) => /npm\s+run\s+test:maintenance/u.test(command)),
  );
});
