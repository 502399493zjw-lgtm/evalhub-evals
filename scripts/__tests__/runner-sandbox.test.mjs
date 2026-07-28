import assert from "node:assert/strict";
import test from "node:test";

import { RUNNER_IMAGE, buildDockerArgs } from "../runner-sandbox.mjs";

test("builds a locked-down, argument-array Docker invocation", () => {
  const args = buildDockerArgs({
    evalDir: "/candidate/evals/sample-eval",
    dependencyRoot: "/trusted",
    slug: "sample-eval",
    argv: [
      "node",
      "evals/sample-eval/run.mjs",
      "evals/sample-eval/tasks/input.json",
      "--out",
      "{output}",
    ],
    outputDir: "/temporary/output",
    containerName: "evalhub-sample-test",
  });

  assert.equal(args[0], "run");
  assert.ok(args.includes("none"));
  assert.ok(args.includes("evalhub-sample-test"));
  assert.ok(args.includes("--read-only"));
  assert.ok(args.includes("ALL"));
  assert.ok(args.includes("no-new-privileges"));
  assert.ok(args.includes("1000:1000"));
  assert.ok(args.includes("HOME=/nonexistent"));
  assert.ok(args.includes("NODE_ENV=production"));
  assert.ok(args.includes(RUNNER_IMAGE));
  assert.ok(args.includes("/output/result.json"));
  assert.ok(
    args.includes(
      "type=bind,src=/candidate/evals/sample-eval,dst=/workspace/evals/sample-eval,readonly",
    ),
  );
  assert.ok(
    args.includes(
      "type=bind,src=/trusted/node_modules,dst=/workspace/node_modules,readonly",
    ),
  );
  assert.ok(
    args.includes("type=bind,src=/trusted/vendor,dst=/workspace/vendor,readonly"),
  );
  assert.equal(args.includes("sh"), false);
  assert.equal(args.includes("-c"), false);
});
