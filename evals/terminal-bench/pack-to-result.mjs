import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";
import { parse as parseYaml } from "yaml";

const EVAL_ID = "terminal-bench";
const RUNNER_VERSION = "terminal-bench/pack-to-result@2.0.0";
const MANIFEST_VERSION = 2;
const PROTOCOL_REVISION = 1;
const UPSTREAM_COMMIT = "2b0442c3c583b710ca8da14c8e601b99f2f1f244";
const HARBOR_VERSION = "0.20.0";
const HARBOR_COMMIT = "459ff6ec99417589b7f679d14ddf3b3f0ae4f1dc";
const REQUIRED_TRIALS = 5;
const MANIFEST_MAX_BYTES = 1024 * 1024;
const JSON_MAX_DEPTH = 128;
const TEMP_FILE_ATTEMPTS = 16;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/:+-]{3,254}$/u;
const IDENTITY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,119}$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const SHORT_UUID_PATTERN =
  /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{7}$/u;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const TASK_DIGEST_ENTRIES = Object.freeze([
  ["atrx-vep-crispr", "sha256:3b8eb57602814aa63af12439e3eacb7ad5bee09efb6c6af023768994bf9220b4"],
  ["batched-eval-parity", "sha256:7926394b6c448ba8debd1cdd5b0bae777a0e4cbe0f1af608b61a8707f5d957c5"],
  ["biped-contact-dynamics", "sha256:ae2cc175efc37461de142d15b01a02718c7fb7a16f87b2720d0dd666e694cf0a"],
  ["bun-sourcemap-leak", "sha256:ac0b0f77da4e8f6c3904133033ec6d8591eb0d3f18205ab28104ea3cf2a5a07f"],
  ["cad-model", "sha256:55103abe25325dfa3717d08ef3d8e02dc8f8bc9adccaed92aab7e94a95b2049a"],
  ["cargo-flight-dispatch", "sha256:2836dfe6eb2270fcbbfdb119c7cfae8495208a03a7fc691c2efff49bda5b3c61"],
  ["cli-2ph-simplex", "sha256:9f41a82565950c380501beb7f8ae33732e4ad526dc4c6ba9b3f37d66a7742a36"],
  ["coq-block-bound", "sha256:4841b523aada2a5d94bb3687b0c107765ad8feac52bdab9e92fe1b59694f6abf"],
  ["ctr-optimization", "sha256:9267570079b058061b7e6a87cdb30df4f04c5d5af3ce2c37c3da6be425e7c26d"],
  ["cumulative-layout-shift", "sha256:834205d9965467c2ed6f4516032658b0393ea0cb29c2442cfa75decf7ce026ff"],
  ["data-anonymization", "sha256:2d463025deb8bcc4c860f8a8e90c799435306e566e6c36af4b0df6d18e10a290"],
  ["distributed-dedup", "sha256:f89d4536b2b884fe972215937f01397d9c6ebe5578499e4b192e67021c50310b"],
  ["embedding-drift-monitor", "sha256:cc93452e15459e00dcd817867428f4c49cd5a8831213ba4590f1372929cb262e"],
  ["erp-procurement-planning", "sha256:4be203d7f07954008fcca9869e2e6cc7b0fb6603bebc7e7d0ffe498e7fa2b843"],
  ["exam-pdf-eval", "sha256:d4f58d8db8098e854bbd2d98b0bcfee6ac14a3a6c69b606db55a8eb1230ff7da"],
  ["fin-saccr-rwa", "sha256:5b2103ac785d4a915207a2535fabf3815fea2c75cf4de01c79747a679facc2ad"],
  ["fix-uautomizer-soundness", "sha256:4a0ee1bf87f6d571214101881b0ac031c502fd20142bdf61f78755f58c4515e3"],
  ["foodstuff-beta-activity", "sha256:62f4c9e1d2c27c3ed174be4691d7d6c2df69f6466a51b266808c63cd111a9787"],
  ["formal-crypto", "sha256:3d1bf9aadd4846379f4c2de10ffd21431444d7647ddbc302bd3cb2283051b4c4"],
  ["fp8-rmsnorm-gemm", "sha256:b2578e66cf87dfa6b64517c69fc1590a1777fb19f7bdff287f4d985ceedec2bd"],
  ["freecad-impeller", "sha256:f1e641af087bf8feb3107355e207654021504cf53f6ec9b5d19f0dd5e54d7f86"],
  ["freecad-platform-drawing", "sha256:70603e9566138b4e63165ebc4badcff5a83cbff187c397b78b0ff60073b8ffb4"],
  ["freecad-spring-clip", "sha256:4c823616ab5c8cccfc58d828a3d770122cb70b3dadc02a859bce53acf11a22b1"],
  ["freight-dispatch-shift", "sha256:b1bb32ad88e1892f33f8beea162cf1de283b3f5f0c6b8de65ce7646e94dc2bcd"],
  ["glycan-ms2-elucidation", "sha256:6d4e3b6d5cf99e84d59b4292cd06f9faf00a2521760b56e3f5e8b5531298c088"],
  ["gpt2-codegolf", "sha256:ea4f8bc8a4672f0c122fd0462381dea7151921b8fc37358d5b3370549a319c1f"],
  ["gsea-proteomics", "sha256:5dfb0c258b674ee0fea20e16f9996771e082cd4db59ee9408272c31d9397cfa1"],
  ["heat-pump-warranty", "sha256:195e39da0c97ea45552d216f04b204d438ec397e1003300be3edc064aa9859b6"],
  ["hof-topology-interpenetration", "sha256:f8307547a260e56572e02e1d876c0b94af44be980aa7028ff1512c787d65e95a"],
  ["html-js-filter", "sha256:832a5b309edca4f1a7c728da5f1ca530c2712f20a0b7f1db6d1bb6e3171a8866"],
  ["ico-path-patch", "sha256:0115a4136189b48da79070f9b3004dc4e0dfc1a60725c5acebdd7f380d037d14"],
  ["interleaved-vigenere", "sha256:83a4f0074137ab36629d33f3f4045d62b63b0feb83295ff7cb6636cbedd31bc0"],
  ["intrastat-meldung", "sha256:3385f3ea74661cc01464f0cb1155ec1553b755238a6f9b6293475e124c6edbc8"],
  ["jax-speedrun-gpu", "sha256:c17111529f4eac64223dace5f734cbcb1f3ad542ec97e65cfdb6c0e7ffe9e98c"],
  ["ks-solver-cpp", "sha256:d6e025f4f5b4bfbfb8ea9c1e661f9f2039b68eadf3fefd44ed31017cfd090952"],
  ["kv-live-surgery", "sha256:bb58097aee168627e1eea82a50feaf1e021d502fe18e0c24b4d88e5a88a6f53f"],
  ["lake-temp-glm", "sha256:8ef0ba42c13ce6ed6454e40389907d8781a681605d07a1fdc48fb5913c46388d"],
  ["layout-config-recreation", "sha256:9beda5ee8b4e0f5605da4940f53525374e837346280e83852d3741df2eef26a8"],
  ["layout-config-recreation2", "sha256:7c2a2904969ad3a80b3199919c3c50bbf35001f70363e4f474153ceab6ce1d8e"],
  ["lean-midpoint-proof", "sha256:80fda7d0f87814d8d3f1e1f6ed485c2431614e3fb05ed2d6590c9061cf28ed19"],
  ["legacy-utility-triage", "sha256:bd30b99dfa7121a0931866d177092482554ab9d3835495c15d960d735c097bcf"],
  ["live-database-cutover", "sha256:dc994181a5c0343a7e7f8ef4cda6b814dca3e48caef8ac00f066646b0132d2fd"],
  ["math-eval-grader", "sha256:25d9a4d042a2e4f05e78c7d8372040a6bc2a1ea5f323dfe67542690f2241e345"],
  ["medical-claims-processing", "sha256:21e9b716812f257927f94c1a5d53bd2565d035f7d538769affbae04fe5e4ba47"],
  ["memcached-backdoor", "sha256:b5b87182c9ac70c63d7c6afdaf7334a0262a03295ee9752f15f7ace424a72f6c"],
  ["mp-checkpoint-consolidation", "sha256:e7710fddd852c1ae62e0d0c89acaee3d774a30c3c60658b1be2b0946dbd94d04"],
  ["music-harmony", "sha256:f5ba5ef9140c164e1c3654425caea7dc0f74423c9632f5e0c9a6dc9001d38f00"],
  ["mvcc-lsm-compaction", "sha256:fdf29c5e7778739cefa3f7a85f4b06acbfdfba329f332512c731b5d879ed446d"],
  ["nextjs-performance", "sha256:8dd4222253b1cac21c139e5c11362ad748e3d7d1a1aa423839d18b7133d70db4"],
  ["ontology-kg-querying", "sha256:75a12b63f861150a038f095fc2ea06b7cf45ee04b5042413d4c4f20d3da944ad"],
  ["payments-pipeline-fix", "sha256:05cbd702e9efc41264e495e6afda5faa34f7672fa4f6faaeaf66106f03af8c6c"],
  ["photonic-waveguide-routing", "sha256:3fd44f4fbc5b862bc1a0b098d3c1295387134edd238ed6f12f2c98ec13e2dccc"],
  ["pretrain-shard-corruption", "sha256:898642139464d351ccea81a5666dd1d572ed0501df2b40feb7a251841bbd0a4c"],
  ["production-planning", "sha256:3207b248738c9e6d497559b90a2a85d43dddde1caea12a5e17e4871e985fe7de"],
  ["protein-autointerp-disulfide", "sha256:49ed2bef4e2e3f987740d8e5fd0d236078089517a0c3f0e39d59612821287916"],
  ["react-lead-form", "sha256:6164416e310fb06ba55f5a574f5c4128f36dc7f0ae54cef6d81b47fede74a09c"],
  ["retro-console-soc", "sha256:5707df6b5c777e156896f1edd5137775f297a88c7f191545e83c7b7909889d96"],
  ["risk-scorer-replay", "sha256:81eda6d9247bd5642feaccabb8eaef055cca8c3e4dab00bceb89aee56645454f"],
  ["roy-polymorph-cn", "sha256:b481c32720d39a7673a469b12cbea6e318fed750c8928bc5f5d7cbf9874610a1"],
  ["rs-archive-clone", "sha256:54a2627f15e22ea58082d6d06cad9ab5c5e0e80c3a93ded915d76db3031384b4"],
  ["satb-audio-transcription", "sha256:6c1491daac95ec0dc9e3968668933bef309ff2c5968b385636abf796afa7654d"],
  ["session-window-debug", "sha256:638c00fd438a0289ba75f6bc536861831f4a8eab2b85064064038e1bcc91cfbb"],
  ["sglang-qwen-burst", "sha256:405b3837c4b9186e60351db3d376aabd355c5f0a8c60db494ee53ee8a49b7fc8"],
  ["shadow-relay", "sha256:a677da5665a8276811f95752ac917de653d970cf2293c8345322b6101768eca0"],
  ["sound-change-cascade", "sha256:0dbc8345e012bc341060bbd5ef896a3b90ecbb302d99d5a54b047f5e3a7ce8cd"],
  ["takens-embedding-lean", "sha256:056774ee95c4d4b6ae1c2ede0a22aa30ecfbb56dcc8837b8d15c27f6f79d4b69"],
  ["telecom-entity-resolution", "sha256:4d15d983b4a44e15e933dd3b50b9116c27d5a66ff09ece221a7ea4554c24613a"],
  ["uefi-bootkit", "sha256:97b0d08a63ee8e0115300ee797ae4eb89e9651d37ca93d2b39910c95bdbcddfc"],
  ["vba-userform-port", "sha256:a75593b08997cf054b3a46163664051513e9c95fbb71249ab0c8512d7b7dc58d"],
  ["vf2-speedup-networkx", "sha256:ac62ee7aef9d3bdd6b05ac109e145ea85ebde0eb36b85eccb80dc2128625912f"],
  ["vllm-deepseek-streaming", "sha256:0efffc771f0b2207b6c5193e780fab3d70b2a910b462903a698450ce7a02db5a"],
  ["vpp-loss-divergence", "sha256:8d020c581371bffe38aff2c0ff9816d0dd61e35a9baba4cbe1eb14c7e738ce78"],
  ["wal-recovery-ordering", "sha256:7d8d20971c4db6fef99952aefbae0655b977c8ce55c3ac91ad656bd022c69543"],
  ["wdm-design", "sha256:c83f63de3c3c604b8d6ee8a46ff2e47c0be1d3b9f409d00dc52013f23df31394"],
]);
const TASK_IDS = Object.freeze(TASK_DIGEST_ENTRIES.map(([taskId]) => taskId));
const TASK_DIGESTS = new Map(TASK_DIGEST_ENTRIES);
const TASK_ID_SET = new Set(TASK_IDS);
const TOTAL_REWARDS = TASK_IDS.length * REQUIRED_TRIALS;

const MANIFEST_KEYS = Object.freeze([
  "manifest_version",
  "eval_id",
  "protocol_revision",
  "upstream_commit",
  "harbor_version",
  "harbor_commit",
  "participant",
  "run_date",
  "harbor_job",
  "tasks",
]);
const PARTICIPANT_KEYS = Object.freeze([
  "model",
  "harness",
  "harness_version",
]);
const HARBOR_JOB_KEYS = Object.freeze(["job_id", "evidence_sha256"]);
const TASK_KEYS = Object.freeze(["task_id", "task_digest", "trials"]);
const TRIAL_KEYS = Object.freeze([
  "trial_id",
  "trial_name",
  "result_sha256",
  "lock_sha256",
  "reward",
]);

class PackError extends Error {
  name = "PackError";
}

function fail(message) {
  throw new PackError(message);
}

function plainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} 必须是 JSON 对象`);
  }
  return value;
}

function onlyKnownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      fail(`${label} 含未知字段 ${JSON.stringify(key)}`);
    }
  }
}

function requirePattern(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(`${label} 缺失或格式不合法`);
  }
  return value;
}

function requireCanonicalUuid(value, label) {
  requirePattern(value, UUID_PATTERN, label);
  if (value === NIL_UUID) {
    fail(`${label} 不能是 nil UUID`);
  }
  if (value[14] !== "4" || !/[89ab]/u.test(value[19])) {
    fail(`${label} 必须是 Harbor 默认生成的 lowercase canonical UUIDv4`);
  }
  return value;
}

function isRepeatedUnit(value) {
  for (let unitLength = 1; unitLength <= value.length / 2; unitLength += 1) {
    if (value.length % unitLength !== 0) continue;
    const unit = value.slice(0, unitLength);
    if (unit.repeat(value.length / unitLength) === value) return true;
  }
  return false;
}

function requireArtifactSha256(value, label) {
  requirePattern(value, SHA256_PATTERN, label);
  if (isRepeatedUnit(value)) {
    fail(`${label} 不能是全零或重复单元组成的占位摘要`);
  }
  return value;
}

function requireTrialName(value, taskId, label) {
  if (typeof value !== "string") {
    fail(`${label} 缺失或格式不合法`);
  }
  const taskPrefix = taskId.slice(0, 32).replace(/[_-]+$/u, "");
  const prefix = `${taskPrefix}__`;
  const shortUuid = value.slice(prefix.length);
  if (
    !value.startsWith(prefix) ||
    value.length !== prefix.length + 7 ||
    !SHORT_UUID_PATTERN.test(shortUuid)
  ) {
    fail(`${label} 不符合 Harbor 默认 trial_name 格式`);
  }
  return value;
}

function decimalParts(value) {
  const match =
    /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/u.exec(String(value));
  if (match === null) {
    throw new Error(`无法规范化 reward 数值 ${String(value)}`);
  }
  const fraction = match[2] ?? "";
  const exponent = Number(match[3] ?? 0);
  const digits = `${match[1]}${fraction}`.replace(/^0+(?=\d)/u, "");
  const coefficient = BigInt(digits);
  const decimalExponent = exponent - fraction.length;
  if (decimalExponent >= 0) {
    return {
      coefficient: coefficient * 10n ** BigInt(decimalExponent),
      scale: 0,
    };
  }
  return { coefficient, scale: -decimalExponent };
}

function formatDecimal(coefficient, scale) {
  if (scale === 0) return coefficient.toString();
  const digits = coefficient.toString().padStart(scale + 1, "0");
  const integer = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/u, "");
  return fraction.length === 0 ? integer : `${integer}.${fraction}`;
}

function exactDecimalSum(values) {
  const parts = values.map(decimalParts);
  const scale = Math.max(...parts.map((part) => part.scale));
  const coefficient = parts.reduce(
    (sum, part) =>
      sum + part.coefficient * 10n ** BigInt(scale - part.scale),
    0n,
  );
  return formatDecimal(coefficient, scale);
}

function rewardToScore(reward) {
  const { coefficient, scale } = decimalParts(reward);
  if (scale >= 2) {
    return Number(formatDecimal(coefficient, scale - 2));
  }
  return Number(formatDecimal(coefficient * 10n ** BigInt(2 - scale), 0));
}

function requireExactInteger(value, expected, label) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value !== expected
  ) {
    fail(`${label} 必须是整数 ${expected}`);
  }
}

function isRealCalendarDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= days[month - 1];
}

function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFileSnapshot(left, right) {
  return (
    sameFileIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function rejectDuplicateJsonKeys(source) {
  let index = 0;

  function syntax(message) {
    fail(`输入清单不是合法 JSON：${message}（字符位置 ${index}）`);
  }

  function skipWhitespace() {
    while (
      source[index] === " " ||
      source[index] === "\t" ||
      source[index] === "\n" ||
      source[index] === "\r"
    ) {
      index += 1;
    }
  }

  function parseString() {
    if (source[index] !== '"') syntax("应为字符串");
    const start = index;
    index += 1;
    while (index < source.length) {
      const character = source[index];
      if (character === '"') {
        index += 1;
        try {
          return JSON.parse(source.slice(start, index));
        } catch (error) {
          syntax(describeError(error));
        }
      }
      if (source.charCodeAt(index) < 0x20) {
        syntax("字符串含未转义控制字符");
      }
      if (character !== "\\") {
        index += 1;
        continue;
      }
      index += 1;
      const escape = source[index];
      if (
        escape === '"' ||
        escape === "\\" ||
        escape === "/" ||
        escape === "b" ||
        escape === "f" ||
        escape === "n" ||
        escape === "r" ||
        escape === "t"
      ) {
        index += 1;
        continue;
      }
      if (escape !== "u") syntax("字符串转义序列不合法");
      for (let offset = 1; offset <= 4; offset += 1) {
        const hex = source[index + offset];
        if (hex === undefined || !/[0-9A-Fa-f]/u.test(hex)) {
          syntax("Unicode 转义必须包含四个十六进制数字");
        }
      }
      index += 5;
    }
    syntax("字符串未闭合");
  }

  function parseNumber() {
    if (source[index] === "-") index += 1;
    if (source[index] === "0") {
      index += 1;
      if (/[0-9]/u.test(source[index] ?? "")) {
        syntax("数字不能含前导零");
      }
    } else {
      if (!/[1-9]/u.test(source[index] ?? "")) syntax("数字格式不合法");
      while (/[0-9]/u.test(source[index] ?? "")) index += 1;
    }
    if (source[index] === ".") {
      index += 1;
      if (!/[0-9]/u.test(source[index] ?? "")) {
        syntax("小数点后必须有数字");
      }
      while (/[0-9]/u.test(source[index] ?? "")) index += 1;
    }
    if (source[index] === "e" || source[index] === "E") {
      index += 1;
      if (source[index] === "+" || source[index] === "-") index += 1;
      if (!/[0-9]/u.test(source[index] ?? "")) {
        syntax("指数部分必须有数字");
      }
      while (/[0-9]/u.test(source[index] ?? "")) index += 1;
    }
  }

  function parseLiteral(literal) {
    if (source.slice(index, index + literal.length) !== literal) {
      syntax(`应为 ${literal}`);
    }
    index += literal.length;
  }

  function parseArray(depth) {
    index += 1;
    skipWhitespace();
    if (source[index] === "]") {
      index += 1;
      return;
    }
    while (true) {
      parseValue(depth + 1);
      skipWhitespace();
      if (source[index] === "]") {
        index += 1;
        return;
      }
      if (source[index] !== ",") syntax("数组元素之间必须使用逗号");
      index += 1;
      skipWhitespace();
    }
  }

  function parseObject(depth) {
    index += 1;
    skipWhitespace();
    const keys = new Set();
    if (source[index] === "}") {
      index += 1;
      return;
    }
    while (true) {
      const keyPosition = index;
      const key = parseString();
      if (keys.has(key)) {
        fail(
          `输入清单含重复 JSON 字段 ${JSON.stringify(key)}` +
            `（字符位置 ${keyPosition}）`,
        );
      }
      keys.add(key);
      skipWhitespace();
      if (source[index] !== ":") syntax("对象字段名后必须使用冒号");
      index += 1;
      parseValue(depth + 1);
      skipWhitespace();
      if (source[index] === "}") {
        index += 1;
        return;
      }
      if (source[index] !== ",") syntax("对象字段之间必须使用逗号");
      index += 1;
      skipWhitespace();
    }
  }

  function parseValue(depth) {
    if (depth > JSON_MAX_DEPTH) {
      fail(`输入清单 JSON 嵌套不得超过 ${JSON_MAX_DEPTH} 层`);
    }
    skipWhitespace();
    const character = source[index];
    if (character === "{") {
      parseObject(depth);
    } else if (character === "[") {
      parseArray(depth);
    } else if (character === '"') {
      parseString();
    } else if (character === "t") {
      parseLiteral("true");
    } else if (character === "f") {
      parseLiteral("false");
    } else if (character === "n") {
      parseLiteral("null");
    } else if (character === "-" || /[0-9]/u.test(character ?? "")) {
      parseNumber();
    } else {
      syntax("值格式不合法");
    }
  }

  skipWhitespace();
  parseValue(0);
  skipWhitespace();
  if (index !== source.length) syntax("根值后存在多余内容");
}

function parseArgv(argv) {
  if (argv.length !== 3 || argv[1] !== "--out") {
    fail(
      "用法：node evals/terminal-bench/pack-to-result.mjs <submission.json> --out <result.json>",
    );
  }
  const inputPath = resolve(argv[0]);
  const outputPath = resolve(argv[2]);
  if (!argv[2].endsWith(".json")) {
    fail("--out 必须指向 .json 文件");
  }
  if (inputPath === outputPath) {
    fail("输入清单和输出结果不能是同一个文件");
  }
  return { inputPath, outputPath };
}

function readManifest(inputPath) {
  let pathStat;
  try {
    pathStat = lstatSync(inputPath, {
      bigint: true,
      throwIfNoEntry: false,
    });
  } catch (error) {
    fail(`无法检查输入清单：${describeError(error)}`);
  }
  if (pathStat === undefined) {
    fail(`输入清单不存在或不是普通文件：${inputPath}`);
  }
  if (pathStat.isSymbolicLink()) {
    fail("输入清单不能是软链接");
  }
  if (!pathStat.isFile()) {
    fail(`输入清单不存在或不是普通文件：${inputPath}`);
  }
  let canonicalInputPath;
  try {
    canonicalInputPath = realpathSync.native(inputPath);
  } catch (error) {
    fail(`无法解析输入清单真实路径：${describeError(error)}`);
  }
  if (canonicalInputPath !== inputPath) {
    fail("输入清单路径不能经过软链接或父目录别名");
  }

  let bytes;
  let inputIdentity;
  let descriptor;
  let operationError;
  try {
    descriptor = openSync(
      canonicalInputPath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    const openedStat = fstatSync(descriptor, { bigint: true });
    if (!openedStat.isFile()) {
      fail("打开后的输入清单不是普通文件");
    }
    if (!sameFileSnapshot(pathStat, openedStat)) {
      fail("输入清单在检查与打开之间发生变化");
    }
    if (openedStat.size > BigInt(MANIFEST_MAX_BYTES)) {
      fail(`输入清单超过 ${MANIFEST_MAX_BYTES} 字节上限`);
    }
    const bounded = Buffer.allocUnsafe(MANIFEST_MAX_BYTES + 1);
    let offset = 0;
    while (offset < bounded.length) {
      const count = readSync(
        descriptor,
        bounded,
        offset,
        bounded.length - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    if (offset > MANIFEST_MAX_BYTES) {
      fail(`输入清单超过 ${MANIFEST_MAX_BYTES} 字节上限`);
    }
    const completedStat = fstatSync(descriptor, { bigint: true });
    if (
      !completedStat.isFile() ||
      !sameFileSnapshot(openedStat, completedStat) ||
      BigInt(offset) !== completedStat.size
    ) {
      fail("输入清单在读取过程中发生变化，未获得一致快照");
    }
    bytes = bounded.subarray(0, offset);
    inputIdentity = { dev: completedStat.dev, ino: completedStat.ino };
  } catch (error) {
    operationError = error;
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch (error) {
        if (operationError === undefined) operationError = error;
      }
    }
  }
  if (operationError !== undefined) {
    if (operationError instanceof PackError) throw operationError;
    fail(`无法安全读取输入清单：${describeError(operationError)}`);
  }

  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("输入清单不是合法 UTF-8");
  }
  rejectDuplicateJsonKeys(source);
  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch (error) {
    fail(`输入清单不是合法 JSON：${error.message}`);
  }
  return {
    manifest: plainObject(manifest, "清单根"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    inputIdentity,
  };
}

function validateParticipant(raw) {
  const participant = plainObject(raw, "participant");
  onlyKnownKeys(participant, PARTICIPANT_KEYS, "participant");
  const model = requirePattern(
    participant.model,
    MODEL_ID_PATTERN,
    "participant.model",
  );
  const hasHarness = participant.harness !== undefined;
  const hasHarnessVersion = participant.harness_version !== undefined;
  if (hasHarness !== hasHarnessVersion) {
    fail(
      "participant.harness 与 participant.harness_version 必须同时提供或同时省略",
    );
  }
  if (!hasHarness) return { model };
  return {
    model,
    harness: requirePattern(
      participant.harness,
      IDENTITY_PATTERN,
      "participant.harness",
    ),
    harness_version: requirePattern(
      participant.harness_version,
      IDENTITY_PATTERN,
      "participant.harness_version",
    ),
  };
}

function validateHarborJob(raw) {
  const job = plainObject(raw, "harbor_job");
  onlyKnownKeys(job, HARBOR_JOB_KEYS, "harbor_job");
  return {
    jobId: requireCanonicalUuid(job.job_id, "harbor_job.job_id"),
    evidenceSha256: requireArtifactSha256(
      job.evidence_sha256,
      "harbor_job.evidence_sha256",
    ),
  };
}

function validateTask(
  raw,
  index,
  harborJob,
  trialIds,
  trialNames,
  resultSha256s,
  lockSha256Owners,
) {
  const label = `tasks[${index}]`;
  const task = plainObject(raw, label);
  onlyKnownKeys(task, TASK_KEYS, label);
  if (typeof task.task_id !== "string" || !TASK_ID_SET.has(task.task_id)) {
    fail(`${label}.task_id 不是本评测固定的任务 ID`);
  }
  const expectedDigest = TASK_DIGESTS.get(task.task_id);
  if (task.task_digest !== expectedDigest) {
    fail(`${label}.task_digest 必须是固定摘要 ${expectedDigest}`);
  }
  if (!Array.isArray(task.trials) || task.trials.length !== REQUIRED_TRIALS) {
    fail(`${label}.trials 必须恰好包含 ${REQUIRED_TRIALS} 次尝试`);
  }
  const trials = task.trials.map((rawTrial, trialIndex) => {
    const trialLabel = `${label}.trials[${trialIndex}]`;
    const trial = plainObject(rawTrial, trialLabel);
    onlyKnownKeys(trial, TRIAL_KEYS, trialLabel);
    const trialId = requireCanonicalUuid(
      trial.trial_id,
      `${trialLabel}.trial_id`,
    );
    if (trialId === harborJob.jobId) {
      fail(`${trialLabel}.trial_id 不能与 harbor_job.job_id 相同`);
    }
    if (trialIds.has(trialId)) {
      fail(`${trialLabel}.trial_id 与清单中的其他 trial 重复`);
    }
    trialIds.add(trialId);
    const trialName = requireTrialName(
      trial.trial_name,
      task.task_id,
      `${trialLabel}.trial_name`,
    );
    if (trialNames.has(trialName)) {
      fail(`${trialLabel}.trial_name 与清单中的其他 trial 重复`);
    }
    trialNames.add(trialName);
    const resultSha256 = requireArtifactSha256(
      trial.result_sha256,
      `${trialLabel}.result_sha256`,
    );
    if (resultSha256s.has(resultSha256)) {
      fail(`${trialLabel}.result_sha256 与清单中的其他 trial 重复`);
    }
    if (lockSha256Owners.has(resultSha256)) {
      fail(`${trialLabel}.result_sha256 不能与任何 lock_sha256 相同`);
    }
    resultSha256s.add(resultSha256);
    const lockSha256 = requireArtifactSha256(
      trial.lock_sha256,
      `${trialLabel}.lock_sha256`,
    );
    if (lockSha256 === resultSha256 || resultSha256s.has(lockSha256)) {
      fail(`${trialLabel}.lock_sha256 不能与任何 result_sha256 相同`);
    }
    const priorTaskId = lockSha256Owners.get(lockSha256);
    if (priorTaskId !== undefined && priorTaskId !== task.task_id) {
      fail(
        `${trialLabel}.lock_sha256 已绑定到不同任务 ${priorTaskId}；` +
          "同一 lock.json 摘要不能对应两个 task digest",
      );
    }
    lockSha256Owners.set(lockSha256, task.task_id);
    if (
      typeof trial.reward !== "number" ||
      !Number.isFinite(trial.reward) ||
      trial.reward < 0 ||
      trial.reward > 1
    ) {
      fail(`${trialLabel}.reward 必须是范围 [0,1] 内的有限 JSON number`);
    }
    return {
      trialId,
      trialName,
      resultSha256,
      lockSha256,
      reward: trial.reward,
    };
  });
  return { taskId: task.task_id, taskDigest: task.task_digest, trials };
}

function validateManifest(raw) {
  onlyKnownKeys(raw, MANIFEST_KEYS, "清单根");
  requireExactInteger(
    raw.manifest_version,
    MANIFEST_VERSION,
    "manifest_version",
  );
  if (raw.eval_id !== EVAL_ID) fail(`eval_id 必须是 ${EVAL_ID}`);
  requireExactInteger(
    raw.protocol_revision,
    PROTOCOL_REVISION,
    "protocol_revision",
  );
  if (raw.upstream_commit !== UPSTREAM_COMMIT) {
    fail(`upstream_commit 必须是 ${UPSTREAM_COMMIT}`);
  }
  if (raw.harbor_version !== HARBOR_VERSION) {
    fail(`harbor_version 必须是 ${HARBOR_VERSION}`);
  }
  if (raw.harbor_commit !== HARBOR_COMMIT) {
    fail(`harbor_commit 必须是 ${HARBOR_COMMIT}`);
  }
  const participant = validateParticipant(raw.participant);
  const runDate = requirePattern(
    raw.run_date,
    CALENDAR_DATE_PATTERN,
    "run_date",
  );
  if (!isRealCalendarDate(runDate)) fail("run_date 必须是真实的 YYYY-MM-DD 日期");
  const harborJob = validateHarborJob(raw.harbor_job);
  if (!Array.isArray(raw.tasks) || raw.tasks.length !== TASK_IDS.length) {
    fail(`tasks 必须恰好包含 ${TASK_IDS.length} 个任务对象`);
  }
  const taskMap = new Map();
  const trialIds = new Set();
  const trialNames = new Set();
  const resultSha256s = new Set();
  const lockSha256Owners = new Map();
  for (const [index, task] of raw.tasks.entries()) {
    const validated = validateTask(
      task,
      index,
      harborJob,
      trialIds,
      trialNames,
      resultSha256s,
      lockSha256Owners,
    );
    if (taskMap.has(validated.taskId)) {
      fail(`tasks 重复任务 ID ${validated.taskId}`);
    }
    taskMap.set(validated.taskId, {
      taskDigest: validated.taskDigest,
      trials: validated.trials,
    });
  }
  for (const taskId of TASK_IDS) {
    if (!taskMap.has(taskId)) fail(`tasks 缺少任务 ${taskId}`);
  }
  if (
    trialIds.size !== TOTAL_REWARDS ||
    trialNames.size !== TOTAL_REWARDS ||
    resultSha256s.size !== TOTAL_REWARDS
  ) {
    fail(
      `清单必须包含 ${TOTAL_REWARDS} 个全局唯一 trial ID、名称和 result.json 摘要`,
    );
  }
  return { participant, runDate, harborJob, taskMap };
}

function loadEvalDefinition() {
  const evalPath = resolve(dirname(fileURLToPath(import.meta.url)), "eval.yaml");
  const parsed = EvalDefSchema.safeParse(
    parseYaml(readFileSync(evalPath, "utf8")),
  );
  if (!parsed.success) {
    fail(`eval.yaml 自身不合法：${JSON.stringify(parsed.error.issues)}`);
  }
  const taskIds = parsed.data.tasks.map((task) => task.id);
  if (
    parsed.data.id !== EVAL_ID ||
    parsed.data.protocol_revision !== PROTOCOL_REVISION ||
    taskIds.length !== TASK_IDS.length ||
    taskIds.some((taskId, index) => taskId !== TASK_IDS[index])
  ) {
    fail("eval.yaml 与转换器钉死的评测 ID、协议版本或任务顺序不一致");
  }
  return parsed.data;
}

function buildResult({ participant, runDate, harborJob, taskMap, manifestSha }) {
  const rewards = [];
  const taskResults = [];
  for (const taskId of TASK_IDS) {
    const { taskDigest, trials } = taskMap.get(taskId);
    const sortedTrials = [...trials].sort((left, right) =>
      left.trialId < right.trialId ? -1 : left.trialId > right.trialId ? 1 : 0,
    );
    for (const [index, trial] of sortedTrials.entries()) {
      rewards.push(trial.reward);
      taskResults.push({
        task_id: taskId,
        score: rewardToScore(trial.reward),
        raw:
          `trial=${index + 1} reward=${trial.reward} ` +
          `trial_id=${trial.trialId} trial_name=${trial.trialName} ` +
          `task_digest=${taskDigest} ` +
          `result_sha256=${trial.resultSha256} ` +
          `lock_sha256=${trial.lockSha256}`,
      });
    }
  }
  const rewardSum = exactDecimalSum(rewards);
  const score = Number(
    ((Number(rewardSum) / TOTAL_REWARDS) * 100).toFixed(6),
  );
  return {
    eval_id: EVAL_ID,
    submission: {
      kind: "run",
      runner_version: RUNNER_VERSION,
      run_date: runDate,
    },
    results: [
      {
        participant,
        score,
        raw_metric: {
          label: "5×74 reward 平均分",
          value: `${rewardSum}/${TOTAL_REWARDS}`,
        },
        detail:
          `Harbor ${HARBOR_VERSION} job ${harborJob.jobId}; ` +
          `${TOTAL_REWARDS} trials with ${TOTAL_REWARDS} unique IDs and names; ` +
          `${TASK_IDS.length}/${TASK_IDS.length} pinned task digests matched; ` +
          `${TOTAL_REWARDS} result.json/lock.json SHA-256 pairs recorded; ` +
          `evidence_sha256=${harborJob.evidenceSha256}; ` +
          `manifest_sha256=${manifestSha}.`,
        task_results: taskResults,
      },
    ],
  };
}

function validateOutputTarget(outputPath, inputIdentity) {
  let outputStat;
  try {
    outputStat = lstatSync(outputPath, {
      bigint: true,
      throwIfNoEntry: false,
    });
  } catch (error) {
    fail(`无法检查输出路径：${describeError(error)}`);
  }
  if (outputStat === undefined) return;
  if (outputStat.isSymbolicLink()) {
    fail("输出路径不能是软链接");
  }
  if (!outputStat.isFile()) {
    fail("输出路径已存在且不是普通文件");
  }
  if (sameFileIdentity(outputStat, inputIdentity)) {
    fail("输入清单和输出结果不能指向同一个 inode（包括硬链接）");
  }
}

function writeAtomic(outputPath, value, inputIdentity) {
  const requestedParent = dirname(outputPath);
  let realParent;
  try {
    realParent = realpathSync.native(requestedParent);
  } catch (error) {
    fail(`输出目录不存在或无法解析：${describeError(error)}`);
  }
  let parentStat;
  try {
    parentStat = lstatSync(realParent, { bigint: true });
  } catch (error) {
    fail(`无法检查输出目录：${describeError(error)}`);
  }
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    fail("输出父路径必须解析到真实目录");
  }

  const realOutputPath = resolve(realParent, basename(outputPath));
  validateOutputTarget(realOutputPath, inputIdentity);
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  let descriptor;
  let parentDescriptor;
  let partialPath;
  let partialCreated = false;
  let renamed = false;
  let operationError;
  try {
    for (let attempt = 0; attempt < TEMP_FILE_ATTEMPTS; attempt += 1) {
      partialPath = resolve(
        realParent,
        `.${basename(outputPath)}.${randomBytes(16).toString("hex")}.partial`,
      );
      try {
        descriptor = openSync(partialPath, "wx", 0o600);
        partialCreated = true;
        break;
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }
    }
    if (descriptor === undefined) {
      fail(`尝试 ${TEMP_FILE_ATTEMPTS} 次仍无法创建唯一临时文件`);
    }
    writeFileSync(descriptor, serialized, { encoding: "utf8" });
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    validateOutputTarget(realOutputPath, inputIdentity);
    renameSync(partialPath, realOutputPath);
    renamed = true;
    parentDescriptor = openSync(
      realParent,
      constants.O_RDONLY | (constants.O_DIRECTORY ?? 0),
    );
    const openedParentStat = fstatSync(parentDescriptor, { bigint: true });
    if (
      !openedParentStat.isDirectory() ||
      !sameFileIdentity(parentStat, openedParentStat)
    ) {
      fail("输出目录在写入过程中发生变化");
    }
    fsyncSync(parentDescriptor);
    closeSync(parentDescriptor);
    parentDescriptor = undefined;
  } catch (error) {
    operationError = error;
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch (error) {
        if (operationError === undefined) operationError = error;
      }
    }
    if (parentDescriptor !== undefined) {
      try {
        closeSync(parentDescriptor);
      } catch (error) {
        if (operationError === undefined) operationError = error;
      }
    }
    if (partialCreated && partialPath !== undefined && !renamed) {
      try {
        unlinkSync(partialPath);
      } catch (error) {
        if (error?.code !== "ENOENT" && operationError === undefined) {
          operationError = error;
        }
      }
    }
  }
  if (operationError !== undefined) {
    if (operationError instanceof PackError) throw operationError;
    fail(`无法原子写出结果：${describeError(operationError)}`);
  }
}

function main(argv) {
  const { inputPath, outputPath } = parseArgv(argv);
  const { manifest, sha256, inputIdentity } = readManifest(inputPath);
  const validated = validateManifest(manifest);
  const resultFile = buildResult({
    ...validated,
    manifestSha: sha256,
  });
  const structural = ResultFileSchema.safeParse(resultFile);
  if (!structural.success) {
    fail(
      `生成的结果不符合 ResultFileSchema：${JSON.stringify(structural.error.issues)}`,
    );
  }
  const evalAware = validateResultForEval(
    loadEvalDefinition(),
    structural.data,
  );
  if (!evalAware.success) {
    fail(
      `生成的结果不符合本评测契约：${JSON.stringify(evalAware.error.issues)}`,
    );
  }
  writeAtomic(outputPath, structural.data, inputIdentity);
  process.stdout.write(
    `已写出 ${outputPath}：${structural.data.results[0].raw_metric.value}，` +
      `${structural.data.results[0].score} 分\n`,
  );
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(
    `${error instanceof PackError ? "提交清单错误" : "转换失败"}：${error.message}\n`,
  );
  process.exitCode = 1;
}
