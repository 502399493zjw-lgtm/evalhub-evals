import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateEvalContent } from "../content-security.mjs";

async function fixture(t, parsedEval = { runner: "builtin" }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "evalhub-content-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const evalDir = path.join(root, "evals", "sample-eval");
  await mkdir(path.join(evalDir, "tasks"), { recursive: true });
  await mkdir(path.join(evalDir, "assets"));
  await Promise.all([
    writeFile(path.join(evalDir, "AUTHORS"), "@sample-author\n"),
    writeFile(path.join(evalDir, "README.md"), "# Sample\n"),
    writeFile(path.join(evalDir, "eval.yaml"), "id: sample-eval\n"),
    writeFile(path.join(evalDir, "sample-result.json"), "{}\n"),
  ]);
  return { evalDir, parsedEval };
}

function messages(problems) {
  return problems.map(({ message }) => message).join("\n");
}

test("accepts the supported text-only eval package", async (t) => {
  const { evalDir, parsedEval } = await fixture(t);
  assert.deepEqual(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
    [],
  );
});

test("rejects hidden files, unknown extensions, and symbolic links", async (t) => {
  const { evalDir, parsedEval } = await fixture(t);
  await Promise.all([
    writeFile(path.join(evalDir, ".env"), "SECRET=not-real\n"),
    writeFile(path.join(evalDir, "payload.zip"), "not really a zip\n"),
    symlink("README.md", path.join(evalDir, "linked.md")),
  ]);

  const result = messages(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
  );
  assert.match(result, /hidden files and directories are not allowed/);
  assert.match(result, /file type <none> is not allowed/);
  assert.match(result, /file type \.zip is not allowed/);
  assert.match(result, /symbolic links are not allowed/);
});

test("rejects disguised executable, archive, and invalid UTF-8 content", async (t) => {
  const { evalDir, parsedEval } = await fixture(t);
  await Promise.all([
    writeFile(path.join(evalDir, "archive.txt"), Buffer.from("504b03040000", "hex")),
    writeFile(path.join(evalDir, "binary.txt"), Buffer.from([0xc3, 0x28])),
  ]);

  const result = messages(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
  );
  assert.match(result, /executable, archive, or WebAssembly content is not allowed/);
  assert.match(result, /valid UTF-8 text/);
});

test("parses every JSON, JSONL, and YAML file", async (t) => {
  const { evalDir, parsedEval } = await fixture(t);
  await Promise.all([
    writeFile(path.join(evalDir, "broken.json"), "{\n"),
    writeFile(path.join(evalDir, "broken.jsonl"), '{"ok":true}\n{\n'),
    writeFile(path.join(evalDir, "broken.yaml"), "same: 1\nsame: 2\n"),
  ]);

  const result = messages(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
  );
  assert.match(result, /invalid JSON:/);
  assert.match(result, /invalid JSONL:/);
  assert.match(result, /invalid YAML:/);
});

test("rejects active SVG and recognizable credentials without printing values", async (t) => {
  const { evalDir, parsedEval } = await fixture(t);
  await Promise.all([
    writeFile(path.join(evalDir, "assets", "active.svg"), '<svg><script>alert(1)</script></svg>\n'),
    writeFile(path.join(evalDir, "tasks", "credential.txt"), "github_pat_abcdefghijklmnopqrstuvwxyz123456\n"),
  ]);

  const result = messages(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
  );
  assert.match(result, /SVG must not contain/);
  assert.match(result, /possible GitHub token detected/);
  assert.doesNotMatch(result, /github_pat_abcdefghijklmnopqrstuvwxyz123456/);
});

test("rejects custom runner network, environment, and unsafe argv access", async (t) => {
  const parsedEval = {
    runner: "custom",
    command_template: {
      argv: [
        "node",
        "evals/sample-eval/run.mjs",
        "evals/other-eval/input.json",
        "--out",
        "{output}",
      ],
      output: "result.json",
    },
  };
  const { evalDir } = await fixture(t, parsedEval);
  await writeFile(
    path.join(evalDir, "run.mjs"),
    'import https from "node:https";\nimport module from "node:module";\nfetch(process.env.URL);\nprocess.getBuiltinModule("child_process");\n',
  );

  const result = messages(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
  );
  assert.match(result, /cannot import network\/process module "node:https"/);
  assert.match(result, /cannot import network\/process module "node:module"/);
  assert.match(result, /cannot use process\.env/);
  assert.match(result, /cannot use fetch/);
  assert.match(result, /cannot use Node internal module access/);
  assert.match(result, /can only read files inside evals\/sample-eval\//);
});
