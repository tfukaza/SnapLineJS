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
**Build:** Yes → `dist/`

See `src/AGENTS.md` for module details.

**Entry points:**
- `@snap-engine/core` - Main export
- `@snap-engine/core/animation` - Animation system
- `@snap-engine/core/collision` - Collision detection
- `@snap-engine/core/debug` - Debug utilities

## Asset Packages (`assets/`)

Organized as npm workspaces following a consistent pattern:
- `core/` - TypeScript classes extending snap-engine
- `svelte/` - Svelte component wrappers
- `react/` - React component wrappers

### 1. SnapEngine Asset Base
- **Packages:** `@snap-engine/asset-base`, `@snap-engine/asset-base-svelte`, `@snap-engine/asset-base-react`
- **Purpose:** Common components (Engine, Camera, Background)
- **Status:** Active
- See `assets/asset-base/AGENTS.md`

### 2. SnapSort
- **Packages:** `@snap-engine/snapsort`, `@snap-engine/snapsort-svelte`, `@snap-engine/snapsort-react`
- **Purpose:** Drag-and-drop list reordering
- **Status:** Active
- See `assets/snapsort/AGENTS.md`

### 3. SnapLine
- **Packages:** `@snap-engine/snapline`, `@snap-engine/snapline-svelte`, `@snap-engine/snapline-react`
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
- **Asset base:** `@snap-engine/asset-base`, `@snap-engine/asset-base-svelte`, `@snap-engine/asset-base-react`
- **Products:** `@snap-engine/{product}`, `@snap-engine/{product}-svelte`, `@snap-engine/{product}-react`

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
    "assets/asset-base/*",
    "assets/snapsort/*",
    "assets/snapline/*",
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

## TypeScript Configuration

Each asset package needs path mappings:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@snap-engine/core": ["../../../src/index.ts"],
      "@snap-engine/core/animation": ["../../../src/animation.ts"],
      "@snap-engine/core/collision": ["../../../src/collision.ts"],
      "@snap-engine/core/debug": ["../../../src/debug.ts"]
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
npm test
```

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
git tag asset-base-svelte-v{version}
git tag asset-base-react-v{version}
git tag snapsort-v{version}
git tag snapsort-svelte-v{version}
git tag snapsort-react-v{version}
git tag snapline-v{version}
git tag snapline-svelte-v{version}
git tag snapline-react-v{version}
git push origin asset-base-v{version}
git push origin asset-base-svelte-v{version}
git push origin asset-base-react-v{version}
git push origin snapsort-v{version}
git push origin snapsort-svelte-v{version}
git push origin snapsort-react-v{version}
git push origin snapline-v{version}
git push origin snapline-svelte-v{version}
git push origin snapline-react-v{version}
```

Push release tags one at a time and verify each publish workflow before sending the next tag.

Tag versions must match each package's `package.json` version. The publish workflows live in `.github/workflows/publish.yml` and `.github/workflows/publish-assets.yml`.

## Build System

- **Core engine:** Built with Vite → `dist/`
- **Asset packages:** Not built, export raw source
- **Workspaces:** Auto-linked by npm

## Adding New Asset Package

1. Create directory: `assets/{product-name}/{core,svelte}/`
2. Create package.json for each sub-package
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

- **Separation:** Core TypeScript logic separate from framework wrappers
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
