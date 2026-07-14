#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { rename, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DatedModelIdSchema,
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";
import { parse as parseYaml } from "yaml";
import { buildWolfSeatSchedule } from "./role-schedule.mjs";

const RUNNER_VERSION = "werewolf-simulator-1.0.0";
const MAX_INPUT_BYTES = 64 * 1024;
const MIN_PARTICIPANTS = 5;
const MAX_PARTICIPANTS = 8;
const MAX_TRIALS = 100;
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/u;

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  let inputPath;
  let outputPath;
  let evalCommit;
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--out" || token === "--eval-commit") {
      if (seen.has(token)) fail(`duplicate argument: ${token}`);
      seen.add(token);
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) fail(`missing value for ${token}`);
      index += 1;
      if (token === "--out") outputPath = value;
      else evalCommit = value;
      continue;
    }
    if (token.startsWith("-")) fail(`unknown argument: ${token}`);
    if (inputPath !== undefined) fail(`unexpected positional argument: ${token}`);
    inputPath = token;
  }

  if (!inputPath || !outputPath) {
    fail(
      "Usage: node evals/werewolf-night/run.mjs participants.json --out output.json [--eval-commit <git-sha>]",
    );
  }
  if (evalCommit !== undefined && !COMMIT_PATTERN.test(evalCommit)) {
    fail("--eval-commit must be a 7-40 character lowercase hexadecimal Git commit");
  }
  return { inputPath, outputPath, evalCommit };
}

function assertExactKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${label} has unknown field: ${key}`);
  }
}

function validateInput(parsed) {
  assertExactKeys(parsed, ["participants", "trials"], "input");
  if (!Number.isInteger(parsed.trials) || parsed.trials < 1 || parsed.trials > MAX_TRIALS) {
    fail(`trials must be an integer from 1 through ${MAX_TRIALS}`);
  }
  if (
    !Array.isArray(parsed.participants) ||
    parsed.participants.length < MIN_PARTICIPANTS ||
    parsed.participants.length > MAX_PARTICIPANTS
  ) {
    fail(`participants must contain ${MIN_PARTICIPANTS}-${MAX_PARTICIPANTS} entries`);
  }

  const identities = new Set();
  for (const [index, participant] of parsed.participants.entries()) {
    assertExactKeys(participant, ["model", "config"], `participants[${index}]`);
    const modelValidation = DatedModelIdSchema.safeParse(participant.model);
    if (!modelValidation.success) {
      fail(`participants[${index}].model: ${modelValidation.error.issues[0]?.message}`);
    }
    if (identities.has(participant.model)) fail("participant model identities must be unique");
    identities.add(participant.model);
    if (
      participant.config !== undefined &&
      (!participant.config || typeof participant.config !== "object" || Array.isArray(participant.config))
    ) {
      fail(`participants[${index}].config must be an object`);
    }
  }
  return parsed;
}

function assignRoles(participants, wolfSeatIndexes) {
  const wolfSeats = new Set(wolfSeatIndexes);
  let seerAssigned = false;
  let guardAssigned = false;
  return participants.map((participant, index) => {
    let role = "villager";
    if (wolfSeats.has(index)) role = "werewolf";
    else if (!seerAssigned) {
      role = "seer";
      seerAssigned = true;
    } else if (!guardAssigned) {
      role = "guard";
      guardAssigned = true;
    }
    return { ...participant, seat: index + 1, role };
  });
}

function runGame(participants, gameNo, wolfSeatIndexes) {
  const seats = assignRoles(participants, wolfSeatIndexes);
  const wolves = seats.filter((seat) => seat.role === "werewolf");
  const villageSignal = seats.filter((seat) => seat.role !== "werewolf").length + (gameNo % 2);
  const wolfSignal = wolves.length * 2 + (gameNo % 3);
  const winningTeam = wolfSignal > villageSignal ? "werewolf" : "village";
  const eliminated =
    winningTeam === "village"
      ? wolves[0]
      : seats.find((seat) => seat.role === "seer") ?? seats[0];
  const turns = [
    { role: "system", content: `第 ${gameNo + 1} 局开始，${seats.length} 名玩家入座。`, status: "ok" },
    { role: "night", content: `狼人队选择袭击 ${seats[(gameNo + 1) % seats.length].model}。`, status: "ok" },
    { role: "seer", content: `预言家查验 ${seats[(gameNo + 2) % seats.length].model} 的阵营。`, status: "ok" },
    { role: "guard", content: `守卫选择保护 ${seats[(gameNo + 3) % seats.length].model}。`, status: "ok" },
    ...seats.slice(0, 5).map((seat) => ({
      role: seat.model,
      content: `${seat.seat} 号发言：根据刀口与票型，我建议把 ${wolves[0].seat} 号放进焦点。`,
      status: seat.role === "werewolf" ? "suspect" : "ok",
    })),
    { role: "vote", content: `白天公投出局 ${eliminated?.model ?? "无人"}。`, status: "ok" },
    { role: "result", content: `${winningTeam === "village" ? "好人阵营" : "狼人阵营"}获胜。`, status: "ok" },
  ];
  return { gameNo, seats, winningTeam, turns };
}

function buildHeadToHead(participants, games) {
  const matchups = [];

  for (let aIndex = 0; aIndex < participants.length; aIndex += 1) {
    for (let bIndex = aIndex + 1; bIndex < participants.length; bIndex += 1) {
      const a = participants[aIndex].model;
      const b = participants[bIndex].model;
      let aWins = 0;
      let bWins = 0;
      let draws = 0;

      for (const game of games) {
        const aSeat = game.seats[aIndex];
        const bSeat = game.seats[bIndex];
        const aTeam = aSeat.role === "werewolf" ? "werewolf" : "village";
        const bTeam = bSeat.role === "werewolf" ? "werewolf" : "village";
        const aWon = aTeam === game.winningTeam;
        const bWon = bTeam === game.winningTeam;

        if (aWon === bWon) draws += 1;
        else if (aWon) aWins += 1;
        else bWins += 1;
      }

      matchups.push({ a, b, a_wins: aWins, b_wins: bWins, draws });
    }
  }

  return {
    type: "head_to_head",
    title: "同届头对头胜率",
    participants: participants.map(({ model }) => ({ key: model, label: model })),
    matchups,
  };
}

async function loadEvalDefinition() {
  const evalPath = fileURLToPath(new URL("./eval.yaml", import.meta.url));
  return EvalDefSchema.parse(parseYaml(await readFile(evalPath, "utf8")));
}

async function atomicWrite(outputPath, contents) {
  const tempPath = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(tempPath, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(tempPath, outputPath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function main() {
  const { inputPath, outputPath, evalCommit } = parseArgs(process.argv.slice(2));
  const rawInput = await readFile(inputPath);
  if (rawInput.byteLength > MAX_INPUT_BYTES) fail(`input exceeds ${MAX_INPUT_BYTES} bytes`);
  let parsed;
  try {
    parsed = JSON.parse(rawInput.toString("utf8"));
  } catch (error) {
    fail(`invalid JSON input: ${error.message}`);
  }
  const input = validateInput(parsed);
  const wolfSeatSchedule = buildWolfSeatSchedule(
    input.participants.length,
    input.trials,
  );
  const games = wolfSeatSchedule.map((wolfSeatIndexes, index) =>
    runGame(input.participants, index, wolfSeatIndexes),
  );
  const wins = new Map(input.participants.map((participant) => [participant.model, 0]));
  for (const game of games) {
    for (const seat of game.seats) {
      const team = seat.role === "werewolf" ? "werewolf" : "village";
      if (team === game.winningTeam) wins.set(seat.model, (wins.get(seat.model) ?? 0) + 1);
    }
  }

  const firstGame = games[0];
  const headToHead = buildHeadToHead(input.participants, games);
  const results = input.participants.map((participant, index) => {
    const won = wins.get(participant.model) ?? 0;
    const score = Math.round((won / input.trials) * 100);
    return {
      participant: {
        model: participant.model,
        ...(participant.config ? { config: participant.config } : {}),
      },
      score,
      raw_metric: { label: "Win rate", value: `${won}/${input.trials}` },
      detail: `${input.trials} 局固定角色轮换；按所在阵营获胜计分。`,
      task_results: [{ task_id: "game", score, raw: `${won} wins in ${input.trials} games` }],
      ...(index === 0
        ? {
            showcases: [
              { type: "transcript", title: "第 1 局整局 transcript", turns: firstGame.turns },
              {
                type: "timeline",
                title: "阵营胜率滚动",
                series: games.slice(0, 6).map((game) => ({
                  t: `G${game.gameNo + 1}`,
                  v: game.winningTeam === "village" ? 60 : 40,
                })),
                events: [
                  {
                    t: "G1",
                    label: `${firstGame.winningTeam === "village" ? "好人" : "狼人"}首胜`,
                  },
                ],
              },
              {
                type: "compare",
                task: "白天公投焦点",
                content: `${firstGame.seats[0].model} 带票 ${firstGame.seats[1].seat} 号`,
                expected: "优先处理狼坑最高的座位",
                verdict: "记录投票理由，供人工复盘。",
                score,
              },
              {
                ...headToHead,
              },
            ],
          }
        : {}),
    };
  });

  const resultFile = {
    eval_id: "werewolf-night",
    ...(evalCommit ? { eval_commit: evalCommit } : {}),
    submission: {
      runner_version: RUNNER_VERSION,
      run_date: new Date().toISOString().slice(0, 10),
    },
    results,
  };
  const resultValidation = ResultFileSchema.safeParse(resultFile);
  if (!resultValidation.success) fail(`invalid result envelope: ${resultValidation.error.message}`);
  const contextual = validateResultForEval(await loadEvalDefinition(), resultValidation.data);
  if (!contextual.success) fail(`invalid result for eval: ${contextual.error.message}`);
  await atomicWrite(outputPath, `${JSON.stringify(contextual.data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exitCode = 1;
});
