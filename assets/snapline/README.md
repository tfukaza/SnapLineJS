# @snap-engine/snapline

Framework-neutral node graph interaction primitives for SnapEngine.

SnapLine provides draggable nodes with explicit DOM resize regions, connector policy, SVG line
geometry, rectangle selection, exclusive nested groups, engine queries, and
headless palette placement. Applications retain ownership of graph documents,
node types, validation, persistence, and styling.

## Install

```bash
npm install @snap-engine/snapline
```

The package root is the framework-neutral API. Framework applications import
their bindings from `@snap-engine/snapline/svelte` or
`@snap-engine/snapline/react`.

## Core and Vanilla

`@snap-engine/snapline` — one entry point, no per-module subpaths. Everything
public is re-exported from the package root; `src/internal/` is
implementation detail and must not be deep-imported.

```ts
import {
  GroupNodeMirror,
  NodeMirror,
  ResizeRegionMirror,
  getParentGroup,
  setGroupMembershipResolver,
} from "@snap-engine/snapline";
```

## Svelte

```bash
npm install @snap-engine/snapline @snap-engine/asset-base svelte
```

```svelte
<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Group, Node, Select } from "@snap-engine/snapline/svelte";
</script>
```

The Svelte entry exports `Node`, `Group`, `ResizeRegion`, `Connector`, `Line`,
`Select`, `Placement`, and `ControlledGraph`. Component subpaths such as
`@snap-engine/snapline/svelte/Node.svelte` are also supported.

## React

```bash
npm install @snap-engine/snapline @snap-engine/asset-base react react-dom
```

```tsx
import { Engine, Group, Node, Select } from "@snap-engine/snapline/react";
```

The React entry exposes the same component set plus component prop and ref
types. Deep imports such as `@snap-engine/snapline/react/Node` remain
supported.

Svelte, React, React DOM, and Asset Base are optional peers. Consumers of
the package root do not need to install either framework.

## Upgrading to 0.4

SnapLine 0.4 replaces the separate framework packages with subpath bindings:

| Before | SnapLine 0.4 |
| --- | --- |
| `@snap-engine/snapline-svelte` | `@snap-engine/snapline/svelte` |
| `@snap-engine/snapline-react` | `@snap-engine/snapline/react` |

Remove the old adapter package from your dependencies and install
`@snap-engine/snapline` instead. Version 0.4 does not include compatibility
shims for the retired package names.

After assigning a Vanilla-rendered element, call `remeasureDomGeometry()`. Svelte
and React adapters perform that synchronization automatically.

Resizing is opt-in: create a `ResizeRegionMirror` child and assign its DOM
element. The application owns that element's hit area, position, cursor,
hover behavior, and visuals.

Live gesture geometry stays outside framework state. Nodes and groups write
their retained element transforms and resize dimensions directly. Line,
selection, and placement renderers register one imperative
`bindGeometryWriter(...)`; semantic observers and commit callbacks remain
separate. A custom line renderer should mount its SVG/Canvas structure once,
bind a writer, and call the returned cleanup function when it unmounts.

When another interaction system applies transient transforms inside a node,
call `node.remeasureDomGeometry()`. The remeasure is coalesced into the next
read/write cycle and re-glues every connected line without coupling SnapLine to
the external system.

Connector roots own gesture initiation, while target-hit and anchor strategies
can rank shape-specific collision candidates and resolve preview and settled
anchors from cached geometry. Symmetric connector rules
(`maxOutgoing`/`maxIncoming`, `"unlimited"` explicit) let the same logical
connector start and accept connections. `onPointerDown` runs when a connector
claims the primary pointer, before the drag threshold, so consumers can
preserve click selection or other gesture-start UI on custom HTML or SVG roots.

Call `connector.updateConfig(...)` to change callbacks, metadata, policy,
surface strategies, collider radius, or edge-pan behavior
without replacing the connector or its existing lines. `name` is
construction-only because it is the connector's key in its parent node.

Topology is always controlled: attach the graph owner with
`attachControlledGraph(engine, { onLineChangeRequest })` (or mount the
adapter `ControlledGraph` component), push your `LineRecord`s through
`setCanonicalGraph`, and apply each gesture's atomic proposal to your
records — adopting the proposed line id settles the dragged line in place.
Hydration never invokes your request handler, so restoring a saved graph
cannot duplicate application edges.

Groups maintain an exclusive direct parent. Ordinary nodes use center
containment, nested groups use full-bounds containment, and the smallest safe
candidate wins unless an engine-level resolver overrides it.

SnapLine `0.4` is experimental and may make breaking changes before `1.0`.

Full documentation: https://snapengine.dev/docs/snapline/introduction
