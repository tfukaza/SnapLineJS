# SnapEngine Asset Packages

## Overview

Asset packages extend SnapEngine with specialized functionality. Core logic and
framework bindings stay separated by source directory. Products may publish
them as split packages or as one package with framework subpath exports.

## Split Package Structure

```
{product-name}/
├── core/                  # TypeScript core logic
│   ├── package.json       # @snap-engine/{product}
│   ├── tsconfig.json      # Path mappings to @snap-engine/core
│   └── src/
│       ├── index.ts       # Exports
│       └── *.ts           # Implementation
├── svelte/                # Svelte components
│   ├── package.json       # @snap-engine/{product}-svelte
│   ├── tsconfig.json      # Path mappings
│   └── src/
│       ├── index.ts       # Component exports
│       └── *.svelte       # Components
└── react/                 # React components
    ├── package.json       # @snap-engine/{product}-react
    └── src/
```

## Unified Package Structure

Asset Base, SnapSort, and SnapLine ship all bindings from one package:

```
{product-name}/
├── package.json           # @snap-engine/{product}
├── tsconfig.json
└── src/
    ├── index.ts           # Framework-neutral root
    ├── *.ts
    ├── svelte/            # @snap-engine/{product}/svelte
    └── react/             # @snap-engine/{product}/react
```

## Available Packages

### 1. asset-base/
- **Packages:** `@snap-engine/asset-base`, `@snap-engine/asset-base/svelte`, `@snap-engine/asset-base/react`
- **Purpose:** Common base components (Engine, Camera, Background)
- **Components:** Engine.svelte, Camera.svelte, Background.svelte
- **Classes:** CameraControl, Background
- **Status:** ✅ Active

### 2. snapsort/
- **Package:** `@snap-engine/snapsort`
- **Bindings:** `@snap-engine/snapsort/svelte`, `@snap-engine/snapsort/react`
- **Purpose:** Drag-and-drop list reordering
- **Components:** Container, Item, Ghost, Handle
- **Classes:** Container, Item, DragSession
- **Status:** ✅ Active

### 3. snapline/
- **Package:** `@snap-engine/snapline`
- **Bindings:** `@snap-engine/snapline/svelte`, `@snap-engine/snapline/react`
- **Purpose:** Node-based graph UI
- **Components:** Node, Connector, Line, Select
- **Classes:** NodeComponent, ConnectorComponent, LineComponent, RectSelectComponent
- **Status:** 📋 Work In Progress

### 4. snapzap/
- **Packages:** `@snap-engine/snapzap-*`
- **Purpose:** Reserved for future enhancements
- **Status:** 📋 Placeholder

## Design Principles

### Separation of Concerns
- **Core packages:** Framework-agnostic TypeScript, extends @snap-engine/core
- **Framework bindings:** Thin wrappers for React, Svelte, etc.
- **No build step:** Raw source exported, not built bundles

### Framework-owned collections

React and Svelte own the structure of every collection they render. Asset
adapters report structural intent through callbacks; application code updates
framework state synchronously, and the framework performs the DOM mutation.
Do not reuse a core package's Vanilla `insertBefore`/`remove` defaults in a
framework adapter, and do not demonstrate direct DOM mutation in framework
fixtures. Temporary drag UI follows the ownership model documented by each
adapter (Svelte renders ghosts internally; React consumers render `Ghost`).

## Package Dependencies

```
@snap-engine/core (built)
    ↓
@snap-engine/{product}
    ↓
@snap-engine/{product}-svelte
```

Unified asset packages:

```
@snap-engine/core
    ↓
@snap-engine/{product}
    ├── /svelte (optional Svelte peer)
    └── /react  (optional React peers)
```
