import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
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

test("rejects hidden files and symbolic links without imposing a source-language whitelist", async (t) => {
  const { evalDir, parsedEval } = await fixture(t);
  await Promise.all([
    writeFile(path.join(evalDir, ".env"), "SECRET=not-real\n"),
    writeFile(path.join(evalDir, "payload.zip"), "not really a zip\n"),
    writeFile(path.join(evalDir, "runner.rb"), "puts 'user-side runner'\n"),
    writeFile(path.join(evalDir, "runner.custom"), "text configuration\n"),
    symlink("README.md", path.join(evalDir, "linked.md")),
  ]);

  const result = messages(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
  );
  assert.match(result, /hidden files and directories are not allowed/);
  assert.match(result, /symbolic links are not allowed/);
  assert.doesNotMatch(result, /file type/u);
});

test("rejects disguised executable, archive, and invalid UTF-8 content", async (t) => {
  const { evalDir, parsedEval } = await fixture(t);
  await Promise.all([
    writeFile(path.join(evalDir, "executable.txt"), Buffer.from("7f454c4602010100", "hex")),
    writeFile(path.join(evalDir, "archive.txt"), Buffer.from("504b03040000", "hex")),
    writeFile(path.join(evalDir, "binary.txt"), Buffer.from([0xc3, 0x28])),
  ]);

  const result = messages(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
  );
  assert.equal(
    result.match(/executable, archive, or WebAssembly content is not allowed/gu)?.length,
    2,
  );
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

test("accepts custom runner runtime capabilities without source behavior auditing", async (t) => {
  const parsedEval = {
    runner: "custom",
    command_template: {
      argv: [
        "node",
        "evals/sample-eval/run.mjs",
        "{input}",
        "--endpoint",
        "https://runner.example.test/api?a=1&b=2",
        "--out",
        "{output}",
      ],
      output: "result.json",
    },
  };
  const { evalDir } = await fixture(t, parsedEval);
  await writeFile(
    path.join(evalDir, "run.mjs"),
    'import https from "node:https";\nimport { spawn } from "node:child_process";\nfetch(process.env.URL);\nspawn(process.env.TOOL);\nvoid https;\n',
  );
  await chmod(path.join(evalDir, "run.mjs"), 0o755);

  assert.deepEqual(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
    [],
  );
});

test("accepts language-neutral runner commands with valid checked-in references", async (t) => {
  const parsedEval = {
    runner: "custom",
    command_template: {
      argv: [
        "/opt/third-party/bin/python3",
        "evals/sample-eval/run.py",
        "{input}",
        "--out",
        "{output}",
      ],
      output: "result.json",
    },
  };
  const { evalDir } = await fixture(t, parsedEval);
  await writeFile(
    path.join(evalDir, "run.py"),
    "import os, subprocess, urllib.request\nprint(os.environ.get('TOKEN'))\n",
  );

  assert.deepEqual(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
    [],
  );
});

test("rejects missing and cross-eval runner repository references", async (t) => {
  const parsedEval = {
    runner: "custom",
    command_template: {
      argv: [
        "python3",
        "./evals/sample-eval/missing.py",
        "evals/other-eval/input.json",
        "nested/../../outside-config.json",
        "--config=../outside-option.json",
        "--windows-config=..\\outside-option.json",
        "--out",
        "{output}",
      ],
      output: "result.json",
    },
  };
  const { evalDir } = await fixture(t, parsedEval);

  const result = messages(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
  );
  assert.match(result, /references a missing repository path: \.\/evals\/sample-eval\/missing\.py/);
  assert.match(result, /repository paths must stay inside evals\/sample-eval\//);
  assert.equal(
    result.match(/repository path references cannot traverse a parent directory/gu)?.length,
    3,
  );
});

test("checks repository references embedded in option assignments", async (t) => {
  const parsedEval = {
    runner: "custom",
    command_template: {
      argv: [
        "ruby",
        "--script=./evals/sample-eval/missing.rb",
        "--endpoint=https://runner.example.test/a/../b",
        "--out",
        "{output}",
      ],
      output: "result.json",
    },
  };
  const { evalDir } = await fixture(t, parsedEval);

  const result = messages(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
  );
  assert.match(
    result,
    /references a missing repository path: --script=\.\/evals\/sample-eval\/missing\.rb/,
  );
  assert.doesNotMatch(result, /--endpoint=/u);
});

test("allows documented absolute tools and external resource URIs", async (t) => {
  const parsedEval = {
    runner: "custom",
    command_template: {
      argv: [
        "C:\\Tools\\runner.exe",
        "--resource=file:///var/lib/runner/input.json",
        "--source=s3://runner-bucket/object.json",
        "evals/sample-eval/run.py",
        "--out",
        "{output}",
      ],
      output: "result.json",
    },
  };
  const { evalDir } = await fixture(t, parsedEval);
  await writeFile(path.join(evalDir, "run.py"), "print('user-side runner')\n");

  assert.deepEqual(
    await validateEvalContent({ evalDir, slug: "sample-eval", parsedEval }),
    [],
  );
});
