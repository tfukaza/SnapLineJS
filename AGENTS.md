# SnapEngine Project Structure

## Overview

SnapEngine is an interactivity engine for the web, structured as an npm workspace monorepo with a core engine and multiple asset packages.

## Repository Structure

```
SnapEngineJS/
├── src/                    # Core engine source (snap-engine package)
├── assets/                 # Asset packages (npm workspaces)
│   ├── asset-base/
│   ├── snapsort/
│   ├── snapline/
│   └── snapzap/
├── demo/                   # Demo applications
│   ├── svelte/
│   ├── react/
│   └── vanilla/
├── docs/                   # Documentation
├── tests/                  # Test suites
├── dist/                   # Build output (generated)
├── package.json            # Root workspace config
├── tsconfig.json           # TypeScript config
└── vite.config.mjs         # Build config
```

## Core Engine (`src/`)

**Package:** `@snap-engine/core`
**Purpose:** Core interactivity engine
**Build:** Raw-source package (`exports` → `src/*.ts`); `npm run build` emits `dist/` as a build check

See `src/AGENTS.md` for module details.

**Entry points:**
- `@snap-engine/core` - Main export
- `@snap-engine/core/animation` - Animation system
- `@snap-engine/core/collision` - Collision detection
- `@snap-engine/core/geometry` - Shared geometry types and pure helpers
- `@snap-engine/core/layout` - Layout simulation over measured box trees
- `@snap-engine/core/debug` - Debug utilities

## Asset Packages (`assets/`)

Asset Base, SnapSort, and SnapLine use the unified-package layout: core,
Svelte, and React
source live in one workspace and are exposed through package subpaths.

### 1. SnapEngine Asset Base
- **Packages:** `@snap-engine/asset-base`, `@snap-engine/asset-base/svelte`, `@snap-engine/asset-base/react`
- **Purpose:** Common components (Engine, Camera, Background)
- **Status:** Active
- See `assets/asset-base/AGENTS.md`

### 2. SnapSort
- **Package:** `@snap-engine/snapsort`
- **Bindings:** `@snap-engine/snapsort/svelte`, `@snap-engine/snapsort/react`
- **Purpose:** Drag-and-drop list reordering
- **Status:** Active
- See `assets/snapsort/AGENTS.md`

### 3. SnapLine
- **Package:** `@snap-engine/snapline`
- **Bindings:** `@snap-engine/snapline/svelte`, `@snap-engine/snapline/react`
- **Purpose:** Node graph UI system
- **Status:** Experimental public package
- See `assets/snapline/AGENTS.md`

### 4. SnapZap
- **Packages:** `@snap-engine/snapzap-*` (placeholders)
- **Purpose:** Future enhancements
- **Status:** Placeholder

## Package Naming

All packages use the `@snap-engine` organization:

- **Core engine:** `@snap-engine/core`
- **Asset base:** `@snap-engine/asset-base`, `@snap-engine/asset-base/svelte`, `@snap-engine/asset-base/react`
- **Split products:** `@snap-engine/{product}`, `@snap-engine/{product}-svelte`, `@snap-engine/{product}-react`
- **Unified products:** `@snap-engine/{product}` with `/{framework}` subpath exports

## Import Patterns

Asset packages must import from published package names:

```typescript
// ✅ Correct
import { Engine } from "@snap-engine/core";
import { CameraControl } from "@snap-engine/asset-base";

// ❌ Wrong - no relative imports to src/
import { Engine } from "../../../src/index";
```

## Workspace Setup

**Root `package.json`:**
```json
{
  "workspaces": [
    "assets/asset-base",
    "assets/snapsort",
    "assets/snapline",
    "assets/snapzap/*"
  ]
}
```

**Asset package structure:**
```
{product-name}/
├── core/
│   ├── package.json          # @snap-engine/{product}
│   ├── tsconfig.json         # Path mappings to @snap-engine/core
│   └── src/
│       ├── index.ts
│       └── *.ts
└── svelte/
    ├── package.json          # @snap-engine/{product}-svelte
    ├── tsconfig.json         # Path mappings
    └── src/
        ├── index.ts
        └── *.svelte
```

**Unified asset structure (Asset Base, SnapSort, and SnapLine):**
```
{product-name}/
├── package.json              # @snap-engine/{product}
├── tsconfig.json
└── src/
    ├── index.ts              # Framework-neutral root
    ├── *.ts                  # Core implementation
    ├── svelte/               # /svelte binding
    └── react/                # /react binding
```

## TypeScript Configuration

Each asset package needs path mappings. A unified package at
`assets/{product}` resolves core source two levels above it:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@snap-engine/core": ["../../src/index.ts"],
      "@snap-engine/core/animation": ["../../src/animation.ts"],
      "@snap-engine/core/collision": ["../../src/collision.ts"],
      "@snap-engine/core/debug": ["../../src/debug.ts"],
      "@snap-engine/core/geometry": ["../../src/geometry.ts"],
      "@snap-engine/core/layout": ["../../src/layout.ts"]
    }
  }
}
```

## Development Workflow

**Install dependencies:**
```bash
npm install
```

**Build core engine:**
```bash
npm run build
```

**Run demo:**
```bash
npm run dev:svelte    # Svelte demo
npm run dev:react     # React demo
```

**Run tests:**
```bash
npm test                  # every unit suite (tests/ut)
npm run test:e2e          # every e2e project on Chromium
npm run test:snapsort     # one project: core, asset-base, snapline,
                          # snapsort, layout, snapdesign, or website
```

End-to-end suites live in `tests/e2e/<project>/<feature>/`, one Playwright
config per project (`tests/e2e/<project>/playwright.config.ts`). Servers and
ports come from `tests/e2e/shared/servers.ts`. Tests that never open a page
belong in `tests/ut/`.

## Release Workflow

Publishing is triggered by pushing version tags, not by pushing `main`.

**Core engine tag:**
```bash
git tag core-v{version}
git push origin core-v{version}
```

**Asset package tags:**
```bash
git tag asset-base-v{version}
git tag snapsort-v{version}
git tag snapline-v{version}
git push origin asset-base-v{version}
git push origin snapsort-v{version}
git push origin snapline-v{version}
```

Push release tags one at a time and verify each publish workflow before sending the next tag.

Tag versions must match each package's `package.json` version. The publish workflows live in `.github/workflows/publish.yml` and `.github/workflows/publish-assets.yml`.

Asset Base 0.5 and later publishes the root plus both bindings from
`@snap-engine/asset-base`; do not create framework-specific Asset Base tags.
After verifying the unified release, deprecate the old
`@snap-engine/asset-base-svelte` and `@snap-engine/asset-base-react` packages
with messages pointing to the new subpaths.

SnapSort 0.5 and later publish core plus both bindings from
`@snap-engine/snapsort`; do not create `snapsort-svelte-v*` or
`snapsort-react-v*` tags. After the unified release is verified on npm,
deprecate the old `@snap-engine/snapsort-svelte` and
`@snap-engine/snapsort-react` packages with messages pointing to the new
subpaths. Deprecation is a separate registry operation, not part of the tag
workflow.

SnapLine 0.4 and later follows the same rule: publish only `snapline-v*`, then
deprecate `@snap-engine/snapline-svelte` and
`@snap-engine/snapline-react` after verifying the unified release. Do not
create framework-specific SnapLine tags.

## Build System

- **Core engine:** Built with Vite → `dist/`
- **Asset packages:** Not built, export raw source
- **Workspaces:** Auto-linked by npm

## Adding New Asset Package

1. Choose a split or unified package layout and create the source directories
2. Create the package manifest(s) and explicit subpath exports
3. Add tsconfig.json with @snap-engine/core path mappings
4. Create AGENTS.md documenting the package
5. Update root package.json workspaces (if needed)
6. Run `npm install`

## Coding Conventions

// Comments: Use single-line `//` comments. Only use `/** */` for JSDoc function documentation.

// Privacy: Use `#` (JS private class fields) for private fields and methods, not the `private` keyword.

// Naming: camelCase for all variables, functions, methods, and properties.

// API style: Prefer property-style access (getters/setters) over explicit get/set methods.
// Example: `obj.worldPosition = [x, y]` not `obj.setWorldPosition(x, y)`.
// This keeps the API minimal and clean-looking.

## Key Principles

- **Separation:** Core TypeScript logic stays separate from framework wrappers, even when shipped from one package
- **No relative imports:** Asset packages import from package names
- **No build for assets:** Raw source exported, not built bundles
- **Workspace linking:** Automatic via npm workspaces

### Framework DOM ownership

Framework adapters must treat framework state as the single source of truth for
rendered collections. Svelte and React examples must update their arrays
synchronously from SnapSort mutation callbacks and let the framework reconcile
the DOM. Never call `insertBefore`, `appendChild`, `remove`, or another
structural DOM API for framework-rendered items or ghosts. SnapSort's default
DOM mutation callbacks are for the framework-agnostic/Vanilla API only.

## Documentation

- **Project structure:** This file and subdirectory AGENTS.md files
- **API reference:** See `doc/` directory
- **Module details:** See `src/AGENTS.md` and package-specific AGENTS.md
