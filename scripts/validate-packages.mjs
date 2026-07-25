import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const npmCache = path.join(os.tmpdir(), "snapengine-package-validation-npm-cache");
fs.mkdirSync(npmCache, { recursive: true });
const packageFiles = [
  "package.json",
  ...fs
    .readdirSync(path.join(root, "assets"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((product) => {
      const productDir = path.join(root, "assets", product.name);
      return fs
        .readdirSync(productDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) =>
          path.relative(root, path.join(productDir, entry.name, "package.json")),
        )
        .filter((file) => fs.existsSync(path.join(root, file)));
    }),
];

const packages = packageFiles.map((file) => ({
  file,
  directory: path.dirname(path.join(root, file)),
  manifest: JSON.parse(fs.readFileSync(path.join(root, file), "utf8")),
}));
const workspaceByName = new Map(
  packages.map((entry) => [entry.manifest.name, entry]),
);
const errors = [];

function collectTargets(value, targets = []) {
  if (typeof value === "string") {
    targets.push(value);
  } else if (value && typeof value === "object") {
    for (const nested of Object.values(value)) collectTargets(nested, targets);
  }
  return targets;
}

function acceptsVersion(range, version) {
  if (!range || range === "*" || range === "workspace:*") return true;
  const normalized = range.replace(/^workspace:/, "");
  if (normalized === version) return true;
  const [major, minor] = version.split(".").map(Number);
  if (normalized === `^${version}` || normalized === `~${version}`) return true;
  if (normalized.startsWith("^")) {
    const [rangeMajor, rangeMinor] = normalized.slice(1).split(".").map(Number);
    return major === rangeMajor && (major > 0 || minor === rangeMinor);
  }
  if (normalized.startsWith("~")) {
    const [rangeMajor, rangeMinor] = normalized.slice(1).split(".").map(Number);
    return major === rangeMajor && minor === rangeMinor;
  }
  return false;
}

function sourceFiles(directory) {
  const source = path.join(directory, "src");
  if (!fs.existsSync(source)) return [];
  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(?:[cm]?[jt]sx?|svelte)$/.test(entry.name)) files.push(target);
    }
  };
  visit(source);
  return files;
}

function hasGlob(value) {
  return /[*?[{\]}]/.test(value);
}

for (const entry of packages) {
  const { directory, file, manifest } = entry;
  if (manifest.private) continue;

  const targets = new Set([
    ...collectTargets(manifest.main),
    ...collectTargets(manifest.types),
    ...collectTargets(manifest.svelte),
    ...collectTargets(manifest.exports),
  ]);
  for (const target of targets) {
    if (!target.startsWith("./")) continue;
    const resolved = path.resolve(directory, target);
    if (!resolved.startsWith(`${directory}${path.sep}`)) {
      errors.push(`${file}: target escapes package: ${target}`);
    } else if (!fs.existsSync(resolved)) {
      errors.push(`${file}: target does not exist: ${target}`);
    }
  }

  for (const includedPath of manifest.files ?? []) {
    if (hasGlob(includedPath)) continue;
    const resolved = path.resolve(directory, includedPath);
    if (
      !resolved.startsWith(`${directory}${path.sep}`) ||
      !fs.existsSync(resolved)
    ) {
      errors.push(`${file}: declared publish path does not exist: ${includedPath}`);
    }
  }

  let packedFiles = new Set();
  try {
    const output = execFileSync(
      "npm",
      ["pack", "--dry-run", "--json", "--cache", npmCache, directory],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    packedFiles = new Set(JSON.parse(output)[0].files.map((item) => item.path));
  } catch (error) {
    errors.push(`${file}: npm pack failed: ${error.stderr?.trim() ?? error.message}`);
  }
  for (const target of targets) {
    if (!target.startsWith("./")) continue;
    const packedPath = target.slice(2);
    if (fs.existsSync(path.resolve(directory, target)) && !packedFiles.has(packedPath)) {
      errors.push(`${file}: published tarball omits target: ${target}`);
    }
  }
  for (const includedPath of manifest.files ?? []) {
    if (hasGlob(includedPath)) continue;
    const resolved = path.resolve(directory, includedPath);
    if (!fs.existsSync(resolved)) continue;
    const normalized = includedPath.replace(/^\.\//, "").replace(/\/$/, "");
    const included = fs.statSync(resolved).isDirectory()
      ? [...packedFiles].some((packedPath) =>
          packedPath.startsWith(`${normalized}/`),
        )
      : packedFiles.has(normalized);
    if (!included) {
      errors.push(
        `${file}: published tarball omits declared path: ${includedPath}`,
      );
    }
  }

  const declared = {
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  };
  for (const sourceFile of sourceFiles(directory)) {
    const source = fs.readFileSync(sourceFile, "utf8");
    const imports = source.matchAll(
      /(?:from\s+|import\s*\(|require\s*\()\s*["'](@snap-engine\/[^/"']+)/g,
    );
    for (const match of imports) {
      const dependency = match[1];
      if (dependency !== manifest.name && !declared[dependency]) {
        errors.push(
          `${path.relative(root, sourceFile)}: imports undeclared dependency ${dependency}`,
        );
      }
    }
  }

  for (const dependencyField of ["dependencies", "peerDependencies"]) {
    for (const [dependency, range] of Object.entries(manifest[dependencyField] ?? {})) {
      const workspace = workspaceByName.get(dependency);
      if (workspace && !acceptsVersion(range, workspace.manifest.version)) {
        errors.push(
          `${file}: ${dependencyField}.${dependency}=${range} does not accept workspace version ${workspace.manifest.version}`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Package validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${packages.filter((entry) => !entry.manifest.private).length} publishable packages.`);
