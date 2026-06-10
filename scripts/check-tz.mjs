#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BAD_PATTERNS = [
  { re: /\.getHours\(\)/, msg: "getHours() без timezone — используй wallClockInTz" },
  { re: /\.getMinutes\(\)/, msg: "getMinutes() без timezone — используй wallClockInTz" },
  { re: /\.getSeconds\(\)/, msg: "getSeconds() без timezone" },
  { re: /\.getDate\(\)/, msg: "getDate() без timezone — используй wallClockInTz или parseYMD" },
  { re: /\.getDay\(\)/, msg: "getDay() — используй getDayOfWeekInTz" },
  { re: /\.getMonth\(\)/, msg: "getMonth() без timezone — используй wallClockInTz" },
  { re: /\.getFullYear\(\)/, msg: "getFullYear() без timezone — используй wallClockInTz" },
  { re: /\.setHours\(/, msg: "setHours() — используй parseWallClockToUtc" },
  { re: /\.setMinutes\(/, msg: "setMinutes() — используй parseWallClockToUtc" },
  { re: /\.setDate\(/, msg: "setDate() — используй addDays на строке YYYY-MM-DD" },
  { re: /\.setMonth\(/, msg: "setMonth() — используй addMonths на строке YYYY-MM-DD" },
  { re: /\.setFullYear\(/, msg: "setFullYear() — используй addYears на строке YYYY-MM-DD" },
  { re: /\.toLocaleString\s*\((?![^)]*timeZone)/, msg: "toLocaleString без timeZone" },
  { re: /\.toLocaleTimeString\s*\((?![^)]*timeZone)/, msg: "toLocaleTimeString без timeZone" },
  { re: /\.toLocaleDateString\s*\((?![^)]*timeZone)/, msg: "toLocaleDateString без timeZone" },
  { re: /Intl\.DateTimeFormat\s*\(\s*\)/, msg: "Intl.DateTimeFormat() без аргументов — используй явную tz" },
  { re: /resolvedOptions\(\)\.timeZone/, msg: "browser tz fallback — используй schedule.timezone" },
];

const SKIP_DIR = /node_modules|\.next|dist|build|coverage|\.git/;
const TEST_EXT = /\.(test|spec)\.(ts|tsx|js|mjs|jsx)$/;
const CODE_EXT = /\.(ts|tsx|js|mjs|jsx)$/;

const walk = (dir) => {
  const out = [];
  const entries = readdirSync(dir);
  for (const e of entries) {
    const p = join(dir, e);
    if (SKIP_DIR.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) {
      out.push(...walk(p));
      continue;
    }
    if (!CODE_EXT.test(p)) continue;
    if (TEST_EXT.test(p)) continue;
    out.push(p);
  }
  return out;
};

const ROOTS = process.argv.slice(2);
if (ROOTS.length === 0) {
  console.error("usage: node scripts/check-tz.mjs <dir1> [dir2 ...]");
  process.exit(2);
}

const checkFile = (file) => {
  const txt = readFileSync(file, "utf8");
  const lines = txt.split("\n");
  const errs = [];
  lines.forEach((line, i) => {
    if (/tz-ok:/.test(line)) return;
    for (const { re, msg } of BAD_PATTERNS) {
      if (re.test(line)) {
        errs.push({ file, line: i + 1, msg, text: line.trim() });
      }
    }
  });
  return errs;
};

const allErrors = ROOTS.flatMap((root) => walk(root)).flatMap(checkFile);

if (allErrors.length === 0) {
  console.log("tz-check: OK — 0 issues");
  process.exit(0);
}

for (const e of allErrors) {
  console.error(`${e.file}:${e.line}  ${e.msg}`);
  console.error(`    ${e.text}`);
}
console.error(`\ntz-check: FAIL — ${allErrors.length} issue(s)`);
console.error(`Добавь комментарий "// tz-ok: <reason>" на строку если UTC/browser tz применяется намеренно.`);
process.exit(1);
