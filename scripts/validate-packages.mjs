import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const npmCache = path.join(
  os.tmpdir(),
  "snapengine-package-validation-npm-cache",
);
fs.mkdirSync(npmCache, { recursive: true });
const packageFiles = [
  "package.json",
  ...fs
    .readdirSync(path.join(root, "assets"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((product) => {
      const productDir = path.join(root, "assets", product.name);
      const manifests = [];
      const productManifest = path.join(productDir, "package.json");
      if (fs.existsSync(productManifest)) {
        manifests.push(path.relative(root, productManifest));
      }
      manifests.push(
        ...fs
          .readdirSync(productDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) =>
            path.relative(
              root,
              path.join(productDir, entry.name, "package.json"),
            ),
          )
          .filter((file) => fs.existsSync(path.join(root, file))),
      );
      return manifests;
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
      else if (/\.(?:[cm]?[jt]sx?|svelte)$/.test(entry.name))
        files.push(target);
    }
  };
  visit(source);
  return files;
}

function hasGlob(value) {
  return /[*?[{\]}]/.test(value);
}

function expandTarget(directory, target) {
  if (!hasGlob(target)) return [target];
  if (/[?[{\]}]/.test(target)) return [];

  const normalized = target.replace(/^\.\//, "");
  const globIndex = normalized.indexOf("*");
  const prefixEnd = normalized.lastIndexOf("/", globIndex);
  const searchRoot = path.resolve(
    directory,
    prefixEnd === -1 ? "." : normalized.slice(0, prefixEnd),
  );
  if (!fs.existsSync(searchRoot)) return [];

  const pattern = new RegExp(
    `^${normalized
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[^/]*")}$`,
  );
  const matches = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) visit(resolved);
      else {
        const relative = path
          .relative(directory, resolved)
          .split(path.sep)
          .join("/");
        if (pattern.test(relative)) matches.push(`./${relative}`);
      }
    }
  };
  visit(searchRoot);
  return matches;
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
  const resolvedTargets = new Set();
  for (const target of targets) {
    if (!target.startsWith("./")) continue;
    const expanded = expandTarget(directory, target);
    if (expanded.length === 0) {
      errors.push(`${file}: target does not match any files: ${target}`);
    }
    for (const expandedTarget of expanded) {
      resolvedTargets.add(expandedTarget);
      const resolved = path.resolve(directory, expandedTarget);
      if (!resolved.startsWith(`${directory}${path.sep}`)) {
        errors.push(`${file}: target escapes package: ${expandedTarget}`);
      } else if (!fs.existsSync(resolved)) {
        errors.push(`${file}: target does not exist: ${expandedTarget}`);
      }
    }
  }

  for (const includedPath of manifest.files ?? []) {
    if (hasGlob(includedPath)) continue;
    const resolved = path.resolve(directory, includedPath);
    if (
      !resolved.startsWith(`${directory}${path.sep}`) ||
      !fs.existsSync(resolved)
    ) {
      errors.push(
        `${file}: declared publish path does not exist: ${includedPath}`,
      );
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
    errors.push(
      `${file}: npm pack failed: ${error.stderr?.trim() ?? error.message}`,
    );
  }
  for (const target of resolvedTargets) {
    if (!target.startsWith("./")) continue;
    const packedPath = target.slice(2);
    if (
      fs.existsSync(path.resolve(directory, target)) &&
      !packedFiles.has(packedPath)
    ) {
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
    for (const [dependency, range] of Object.entries(
      manifest[dependencyField] ?? {},
    )) {
      const workspace = workspaceByName.get(dependency);
      if (workspace && !acceptsVersion(range, workspace.manifest.version)) {
        errors.push(
          `${file}: ${dependencyField}.${dependency}=${range} does not accept workspace version ${workspace.manifest.version}`,
        );
      }
    }
  }
}

function validateUnifiedPackage({
  name,
  manifestPath,
  expectedExports,
  frameworkPeers,
  retiredPackages,
}) {
  const packageEntry = workspaceByName.get(name);
  if (!packageEntry) {
    errors.push(`${manifestPath}: unified package is missing`);
    return;
  }

  const { manifest, directory, file } = packageEntry;
  if (file !== manifestPath) {
    errors.push(`${file}: ${name} must be rooted at ${manifestPath}`);
  }
  for (const [specifier, target] of Object.entries(expectedExports)) {
    if (manifest.exports?.[specifier] !== target) {
      errors.push(`${file}: exports.${specifier} must target ${target}`);
    }
  }

  if (!manifest.dependencies?.["@snap-engine/core"]) {
    errors.push(`${file}: @snap-engine/core must be a regular dependency`);
  }
  for (const dependency of frameworkPeers) {
    if (!manifest.peerDependencies?.[dependency]) {
      errors.push(`${file}: missing framework peer ${dependency}`);
    }
    if (manifest.peerDependenciesMeta?.[dependency]?.optional !== true) {
      errors.push(`${file}: framework peer ${dependency} must be optional`);
    }
  }

  const rootEntry = fs.readFileSync(
    path.join(directory, "src/index.ts"),
    "utf8",
  );
  if (
    /(?:from\s+|import\s*\()\s*["']\.\/(?:react|svelte)(?:\/|["'])/.test(
      rootEntry,
    )
  ) {
    errors.push(`${file}: root entry must not load a framework binding`);
  }

  for (const retiredPackage of retiredPackages) {
    if (workspaceByName.has(retiredPackage)) {
      errors.push(
        `${retiredPackage}: retired package remains in the workspace`,
      );
    }
  }
}

validateUnifiedPackage({
  name: "@snap-engine/asset-base",
  manifestPath: "assets/asset-base/package.json",
  expectedExports: {
    ".": "./src/index.ts",
    "./camera": "./src/camera.ts",
    "./background": "./src/background.ts",
    "./svelte": "./src/svelte/index.ts",
    "./svelte/*.svelte": "./src/svelte/*.svelte",
    "./svelte/engine": "./src/svelte/engineState.svelte.js",
    "./react": "./src/react/index.ts",
    "./react/*": "./src/react/*.tsx",
  },
  frameworkPeers: ["react", "svelte"],
  retiredPackages: [
    "@snap-engine/asset-base-react",
    "@snap-engine/asset-base-svelte",
  ],
});

validateUnifiedPackage({
  name: "@snap-engine/snapsort",
  manifestPath: "assets/snapsort/package.json",
  expectedExports: {
    ".": "./src/index.ts",
    "./container": "./src/container.ts",
    "./item": "./src/item.ts",
    "./svelte": "./src/svelte/index.ts",
    "./svelte/*.svelte": "./src/svelte/*.svelte",
    "./react": "./src/react/index.ts",
    "./react/*": "./src/react/*.tsx",
  },
  frameworkPeers: ["@snap-engine/asset-base", "react", "react-dom", "svelte"],
  retiredPackages: [
    "@snap-engine/snapsort-react",
    "@snap-engine/snapsort-svelte",
  ],
});

validateUnifiedPackage({
  name: "@snap-engine/snapline",
  manifestPath: "assets/snapline/package.json",
  expectedExports: {
    ".": "./src/index.ts",
    "./svelte": "./src/svelte/index.ts",
    "./svelte/*.svelte": "./src/svelte/*.svelte",
    "./react": "./src/react/index.ts",
    "./react/*": "./src/react/*.tsx",
  },
  frameworkPeers: ["@snap-engine/asset-base", "react", "react-dom", "svelte"],
  retiredPackages: [
    "@snap-engine/snapline-react",
    "@snap-engine/snapline-svelte",
  ],
});

if (errors.length > 0) {
  console.error(`Package validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Validated ${packages.filter((entry) => !entry.manifest.private).length} publishable packages.`,
);
