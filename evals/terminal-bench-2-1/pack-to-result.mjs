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

const EVAL_ID = "terminal-bench-2-1";
const RUNNER_VERSION = "terminal-bench-2-1/pack-to-result@1.0.0";
const MANIFEST_VERSION = 2;
const PROTOCOL_REVISION = 1;
const UPSTREAM_COMMIT = "7131e4375048a0e408a8fb404b5f499d726b695b";
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
  ["adaptive-rejection-sampler", "sha256:bcaa2399985cd57666018025846289ab25e193ae0dd8fb7f0ffab2410c24d4de"],
  ["bn-fit-modify", "sha256:b5f9644970c17ad9ddb46b7266f7bcd87c761d77d7e6f55d7cfe7284d5ff66e9"],
  ["break-filter-js-from-html", "sha256:678008d1a4fd1e6e1b9b3cc9a327219fe4b410a31eafc52e9099bbf947eea600"],
  ["build-cython-ext", "sha256:35dc561790e73f13e59837828ac0863c0893edc6b71d42cf7d58656c843adf12"],
  ["build-pmars", "sha256:63f0449b276f081986740c941ea9372068b310a02b062c1e5e3400f575241893"],
  ["build-pov-ray", "sha256:4f08dab602fe2e9e2f42051cc6aef684a88cf2822e8b499b3ca19e670759fddb"],
  ["caffe-cifar-10", "sha256:7b0045106d7d5af724efe96b610ba64f7893f5c88528401c573c4d47e384e2bf"],
  ["cancel-async-tasks", "sha256:a3d048d351136e48070696cda8bb79660dfd74db1fea3b6da88559f0332699c1"],
  ["chess-best-move", "sha256:9ab8e4b3674282e751edafbd9b5bd551fef995fd6601585a2cdb04fd70c520da"],
  ["circuit-fibsqrt", "sha256:9bcffe1054bb33249aa578a9a2a74f3c8cca66b0cb7aa1328233f1d31822aae3"],
  ["cobol-modernization", "sha256:e03aa03965eee48c9f772d566ff9bcd741fceeac9693123f82a13fdd46be0d88"],
  ["code-from-image", "sha256:ef2907bb300d9b3352410c2a75dbf831278c187c073298371870ea9c83526f78"],
  ["compile-compcert", "sha256:22bde2a73d62fa46f5ab96f710561a72e8d1aa4266f008605a17f174622ad785"],
  ["configure-git-webserver", "sha256:e3dc712acfecdb1338a889f86c97b37422c3778351253f9aca4236e895fdb36e"],
  ["constraints-scheduling", "sha256:91dd6f87e1ee508328d5aafbd99a6bd1ccc47bc22671b4aaa4060bda492deb53"],
  ["count-dataset-tokens", "sha256:cd0574ec8281f53854256acc93702ed1441407c0428849e1dd4f27e863c6b08a"],
  ["crack-7z-hash", "sha256:99cbb2269f6bd112d3387fd01cb6900118fe4aded3f75a8d656580a8296a1ae5"],
  ["custom-memory-heap-crash", "sha256:61e021e0304c9818a9be2c9173c8a0938ce5d136e95c5422e099f1fdb2dc080e"],
  ["db-wal-recovery", "sha256:07e9193513bfce038b9f9d84962ecc85683eee0a642d14ee6fb7104b086ddab4"],
  ["distribution-search", "sha256:8787d3004ac4dd9d78f0c14f5b5ef94a4ad3e69d8828d7d35b9fbd7828a69ed1"],
  ["dna-assembly", "sha256:e41a8e94d86019949b08d3b5f88a85f6d943ba0fd85d5e1d5ebb95cb8f66223f"],
  ["dna-insert", "sha256:37fc023970e3464c1acc31f43e04a0b4b94758130d340788f261f00764d9e530"],
  ["extract-elf", "sha256:1ef31d566be4fe3459d5368621ae7ef7a31b23ef675737e473bbc43c8c7b3fce"],
  ["extract-moves-from-video", "sha256:168e2b9168511b8f8d32b1697f4703b08626203e7949ad396658f4bef7dee66e"],
  ["feal-differential-cryptanalysis", "sha256:8ea56995fcc43fb94f0e4e15adb12dd28836bf3e9c766b2cc7ae78a7ce90341f"],
  ["feal-linear-cryptanalysis", "sha256:0f3234c5fde85f9dc610d94cfefd4c892afb75c9e571f21f18fee66972b67332"],
  ["filter-js-from-html", "sha256:2d1496b6fc62adeccdba7a56f4bc24e5ef265840434d2011234ed20b6c240759"],
  ["financial-document-processor", "sha256:63dc43a15d9ec401613016e9114d1a93ec860eea63b2db02abfe8060deea30fb"],
  ["fix-code-vulnerability", "sha256:d31348aa16b533a15f013420e4d9726dc529e6086adc7d6d48067d22cc18fe71"],
  ["fix-git", "sha256:16948b980df9d96de616a205f5acca1c5d395de83ff4f8ffabcafacb93226f2e"],
  ["fix-ocaml-gc", "sha256:2031f3d5224b891fe443a31526b569eb756be2f88b663cb025448af9c4f97e2c"],
  ["gcode-to-text", "sha256:7dd2af04820e71ecaba96bc493cbffa16317e96816c6c8003385c034adf6c23b"],
  ["git-leak-recovery", "sha256:22a9ec10dbd4cd8b99477b70e1944103775ca41de9b9e0025ec4898cd17bd334"],
  ["git-multibranch", "sha256:7759a92a373c967dd31535975bad8659410644025673fe62385444fd2605c5fa"],
  ["gpt2-codegolf", "sha256:fe42af8e9c5aa927c3b680acd08e43032c84088fa9d770b03ce63dbc66fea4e7"],
  ["headless-terminal", "sha256:203953871ebdae4efbf163af9499849368dab5e219b70d447e5ee9701ad382d9"],
  ["hf-model-inference", "sha256:01370f37e61286f920dfca1e471496640ebcc8d06e1cc48d874c790715dbd4ad"],
  ["install-windows-3.11", "sha256:1f1361b0012e1ad24054e7cfc039829459e8ab0631b3573d9b93499bf6b3563e"],
  ["kv-store-grpc", "sha256:973c5d4c111fb61a344457936f1c36400acd2d9e44389e7b319586fe23a7a307"],
  ["large-scale-text-editing", "sha256:1f1cddc3df15e452fe2d3c6928f6b1e5b5330a7ae67cab373a0d089ea7d334a2"],
  ["largest-eigenval", "sha256:1b6f17c344d23e97435ba3fa93400d141f6bb7763ed2014fab418830983791b3"],
  ["llm-inference-batching-scheduler", "sha256:a3bf47589118daec5124fe3689b4439802c805b2f4ed9d402a48ae73ca2fea67"],
  ["log-summary-date-ranges", "sha256:27b074a2f10fff7606e096f3abd8dced418ad8fda0f53d88acbe477f2d9ceaf6"],
  ["mailman", "sha256:831b3ed00807153963c05f91599443e4839099521d1d56db811c5547ab280dbe"],
  ["make-doom-for-mips", "sha256:2d83dd3dee8e0f055e09973934cf0d7e3169a9cd90704cba5c8940b170be9498"],
  ["make-mips-interpreter", "sha256:41a55da0abec5d7b32a0c2321f8b18e84000ca8074ae62c6874d6ed4a3a1cd3c"],
  ["mcmc-sampling-stan", "sha256:443cd2b94ed797944793e97a56527a5dc0f8ad40f78ed418fe1b2e367cf22546"],
  ["merge-diff-arc-agi-task", "sha256:6aab6511a5344ce87698293bb1ce4cc51d9a45f1ad9f0c075d2a83197b36727d"],
  ["model-extraction-relu-logits", "sha256:1ae5045ad68b5d34c3398b612066a07c4a08b6dc330d28868ec4021e17c94b17"],
  ["modernize-scientific-stack", "sha256:67a9952aca67df9c70510acf62faea336644a0e9d379f3aaf9df79f14c8fcb12"],
  ["mteb-leaderboard", "sha256:484f6d7008a05b5b8640fc6618a384b8c9447cd76f85416c8a595028d29bff9c"],
  ["mteb-retrieve", "sha256:fa7c777df6ed8987a2bb144b4b73a1200935bbea69da03a2aaa1dc8aa9bd9dc9"],
  ["multi-source-data-merger", "sha256:70367c38732e1beda7b229968a48d60242277c2fa4db91339c3f064c4c230d49"],
  ["nginx-request-logging", "sha256:9d1b8bebd989ea0bc8080c3b159480068caf183c5fd61385868b2574b206e097"],
  ["openssl-selfsigned-cert", "sha256:d4afa2bd2a9ba1420db8d6cfde42ffdb4873ae2d955c35014e8da94444c83302"],
  ["overfull-hbox", "sha256:3c3b16e4b2de5fea90ca98db242b155a6843f9cc4dfd00be3479985a34bab4f7"],
  ["password-recovery", "sha256:9b5c6bdce0cf03f075b21f6a7af5030b825ce07d7b16b37610f3964217ab84a4"],
  ["path-tracing", "sha256:cf56094c881a488b27e9f204a638a7e78ed7d55e12dc3064108c93357190314c"],
  ["path-tracing-reverse", "sha256:035880d7ef5554b217e53a75ce5e87e43193b7a44c30ad17226a6ab10fc11a6c"],
  ["polyglot-c-py", "sha256:25570ccacf63f573a252eaa2a9c62ee8b55f5aa228cc803b5beb39dd6d8afeb7"],
  ["polyglot-rust-c", "sha256:a33dc72e2278d225513c0724abe2e4539653d5ee7e4c2a90ba2d676586ba9f3d"],
  ["portfolio-optimization", "sha256:d112f8945600f18ec47bbbe76935dc05953173cc3d0a375a7aa2712b091584e4"],
  ["protein-assembly", "sha256:c491d45acce234e1aa1d44dcc6778c55fcf875e9eb254b8dd3ae5ef58119621b"],
  ["prove-plus-comm", "sha256:d5ae25720df1f7cd619ed8408cda4b87b79a3d8b0ff4f1919e2c96e9547339c2"],
  ["pypi-server", "sha256:1a1e0542f58e2d3362fec17a9bbb98667717d9a4a3e9a4c8413d3150a4fa0ff1"],
  ["pytorch-model-cli", "sha256:6f11544dcc81a380dc4611902961f5520259c462d9fceb413419d66ab9a96c79"],
  ["pytorch-model-recovery", "sha256:2e628841cff93290919172398e573e794f34c95d9382b7425adde4364022decc"],
  ["qemu-alpine-ssh", "sha256:60b7050b0e0aa51641208cf65766743d340e59575db2c4d2f8628240846c2a28"],
  ["qemu-startup", "sha256:8e58263747da7dc688ad470688fb72825c4ba2c1c40443fa0f52963645bbd999"],
  ["query-optimize", "sha256:169496ea6843cb403b0860132675baf7aa0df0ac8b86221068e27d86395260f4"],
  ["raman-fitting", "sha256:97ca4025332b20739da553cab0658f2ead925d1b5b3b9b7664dc9eb5e7fbeab7"],
  ["regex-chess", "sha256:e763e0ac1c9759081af0a4a82ba51b8cf9ae5485a93de3bbe42d7d344597bd78"],
  ["regex-log", "sha256:802c16cfd132e6c457529cb864be5a757c1b23b6cadc57f2d01983cb0110292a"],
  ["reshard-c4-data", "sha256:a402bbfede73dd04168d697de9b9146026f69e14c8cd333b6a91fc87e44ecd4b"],
  ["rstan-to-pystan", "sha256:592f15f75751f3c4999c3d05087f2f8b2a4dbaaedbfad5a30ae54058b80b925f"],
  ["sam-cell-seg", "sha256:37c182b91df18b9c2ea2dceda47430bbd585e7880c56fca2f1975907ce0df8ce"],
  ["sanitize-git-repo", "sha256:73c94a21ebe370bae843adbeeaaa9e991374867b18483aaf56c7cd470dcddea7"],
  ["schemelike-metacircular-eval", "sha256:58130c2166c3115276dc8592f358e326ff2d81ea852e3d88636c82fd1dff57e6"],
  ["sparql-university", "sha256:02aeca67b6c5b0d2d72c91ab471beb51ded6f42f0dc3dec580e20d489f09a867"],
  ["sqlite-db-truncate", "sha256:956f038b479cc3b9b493553b57a60a8ff4154526386c3914c0b99e93e1ab6e87"],
  ["sqlite-with-gcov", "sha256:9f9bd57fbf9f4831e9031755e83aea6b9d60d2b2d54e8a12d48cff4dca3c231d"],
  ["torch-pipeline-parallelism", "sha256:db605337c749a872cea7b5b413429b3915bb4c3efe0f7875f0c46ce81bd8c4fb"],
  ["torch-tensor-parallelism", "sha256:f32ce74a5aeb6638480247ab799fe46127bbee631acdd0921b0f394ec49b3684"],
  ["train-fasttext", "sha256:460fc0818971ec83545a76805267b65459128fad52e68c26a199a0d74022badb"],
  ["tune-mjcf", "sha256:7da0fd3b906624df9eff8829ccd4f19cbb1ba967411b6d64d92b85b2f3fbdfb0"],
  ["video-processing", "sha256:d3f02e177b49e5768b6ce6709fc4ae3ef2ce0cdecb63b09fc9b07f9d3ddb7203"],
  ["vulnerable-secret", "sha256:d76dfa9e256487c5542905b892156f694137aeef784e1abf3f41e15a8c946eac"],
  ["winning-avg-corewars", "sha256:a9f2c630fb7d656e96f3a42ade600a8abcb500631d153d62d5ceb2df073bc256"],
  ["write-compressor", "sha256:d9ddd9a8e925e2c566b37b2492cbf995afecefe58874e4043ef78d7f3c892c7e"],
]);
const TASK_IDS = Object.freeze(TASK_DIGEST_ENTRIES.map(([taskId]) => taskId));
const evalTaskId = (upstreamTaskId) => upstreamTaskId.replaceAll(".", "-");
const EVAL_TASK_IDS = Object.freeze(TASK_IDS.map(evalTaskId));
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
      "用法：node evals/terminal-bench-2-1/pack-to-result.mjs <submission.json> --out <result.json>",
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
  const harborVersion = requirePattern(raw.harbor_version, IDENTITY_PATTERN, "harbor_version");
  const harborCommit = requirePattern(raw.harbor_commit, /^[0-9a-f]{40}$/u, "harbor_commit");
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
  return { participant, runDate, harborVersion, harborCommit, harborJob, taskMap };
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
    taskIds.some((taskId, index) => taskId !== EVAL_TASK_IDS[index])
  ) {
    fail("eval.yaml 与转换器钉死的评测 ID、协议版本或任务顺序不一致");
  }
  return parsed.data;
}

function buildResult({ participant, runDate, harborVersion, harborCommit, harborJob, taskMap, manifestSha }) {
  const rewards = [];
  const taskResults = [];
  for (const taskId of TASK_IDS) {
    const { taskDigest, trials } = taskMap.get(taskId);
    const sortedTrials = [...trials].sort((left, right) =>
      left.trialId < right.trialId ? -1 : left.trialId > right.trialId ? 1 : 0,
    );
    for (const [index, trial] of sortedTrials.entries()) {
      rewards.push(trial.reward > 0 ? 1 : 0);
      taskResults.push({
        task_id: evalTaskId(taskId),
        score: trial.reward > 0 ? 100 : 0,
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
          label: "5×89 成功率",
          value: `${rewardSum}/${TOTAL_REWARDS}`,
        },
        detail:
          `Harbor ${harborVersion} (${harborCommit}) job ${harborJob.jobId}; ` +
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
