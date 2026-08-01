/**
 * Release helper for @one-million-lines/workflow-builder.
 *
 *   node scripts/release.mjs patch   # 0.1.2 → 0.1.3
 *   node scripts/release.mjs minor   # 0.1.2 → 0.2.0
 *   node scripts/release.mjs major   # 0.1.2 → 1.0.0
 *   node scripts/release.mjs 1.2.3   # set exact version
 *
 * Steps:
 *   1. Bumps version in package.json and package-lock.json
 *   2. Runs the library build (npm run build → dist/)
 *   3. Prints next manual steps (git tag + publish)
 */
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const packageJsonPath = resolve(root, "package.json");
const packageLockPath = resolve(root, "package-lock.json");

const arg = process.argv[2];

if (!arg) {
  console.error(
    "Usage: npm run release:patch | release:minor | release:major\n" +
      "   or: node scripts/release.mjs <patch|minor|major|x.y.z>",
  );
  process.exit(1);
}

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function parseVersion(text) {
  if (!SEMVER_RE.test(text)) throw new Error(`Invalid semver: ${text}`);
  const [major, minor, patch] = text.split(".").map(Number);
  return { major, minor, patch };
}

function fmt(v) {
  return `${v.major}.${v.minor}.${v.patch}`;
}

function nextVersion(current, mode) {
  const v = parseVersion(current);
  if (mode === "patch") return fmt({ ...v, patch: v.patch + 1 });
  if (mode === "minor") return fmt({ major: v.major, minor: v.minor + 1, patch: 0 });
  if (mode === "major") return fmt({ major: v.major + 1, minor: 0, patch: 0 });
  if (SEMVER_RE.test(mode)) return mode;
  throw new Error(`Unknown bump mode: ${mode}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const pkg = await readJson(packageJsonPath);
  if (!pkg.version) throw new Error("package.json missing version field");

  const current = pkg.version;
  const target = nextVersion(current, arg);

  if (current === target) {
    console.log(`Already at ${target}. Building…`);
  } else {
    // Bump package.json
    pkg.version = target;
    await writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");

    // Bump package-lock.json (best-effort)
    try {
      const lock = await readJson(packageLockPath);
      lock.version = target;
      if (lock.packages?.[""]?.version != null) lock.packages[""].version = target;
      await writeFile(packageLockPath, JSON.stringify(lock, null, 2) + "\n");
    } catch {
      // package-lock may not exist in all environments
    }

    console.log(`Bumped: ${current} → ${target}`);
  }

  // Build the library
  console.log("Building library…");
  await run("npm", ["run", "build"], { cwd: root });
  console.log(`\n✓ Build complete — v${target} is ready in dist/\n`);
  console.log("Next steps:");
  console.log(`  git add package.json package-lock.json CHANGELOG.md`);
  console.log(`  git commit -m "chore: release v${target}"`);
  console.log(`  git tag v${target}`);
  console.log(`  git push && git push --tags`);
  console.log(`  npm publish --access public`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
