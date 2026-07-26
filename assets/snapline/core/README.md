# @snap-engine/snapline

Framework-neutral node graph interaction primitives for SnapEngine.

SnapLine provides draggable and resizable nodes, connector policy, SVG line
geometry, rectangle selection, exclusive nested groups, engine queries, and
headless palette placement. Applications retain ownership of graph documents,
node types, validation, persistence, and styling.

## Install

```bash
npm install @snap-engine/core @snap-engine/snapline
```

## Entry points

- `@snap-engine/snapline`
- `@snap-engine/snapline/node`
- `@snap-engine/snapline/connector`
- `@snap-engine/snapline/line`
- `@snap-engine/snapline/select`
- `@snap-engine/snapline/group`
- `@snap-engine/snapline/placement`
- `@snap-engine/snapline/query`

```ts
import {
  GroupNodeComponent,
  NodeComponent,
  getParentGroup,
  setGroupMembershipResolver,
} from "@snap-engine/snapline";
```

After assigning a Vanilla-rendered element, call `syncDomGeometry()`. Svelte
and React adapters perform that synchronization automatically.

When another interaction system applies transient transforms inside a node,
call `connector.requestDomGeometrySync()` for each affected connector. The
request is coalesced into the next read/write cycle and updates every connected
line without coupling SnapLine to the external system.

Surface strategies decouple connection hit testing from visible connector
elements. They can activate from a node border, rank shape-specific target
hits, and resolve preview and settled anchors from cached geometry. Independent
connector capabilities allow the same logical surface to start and accept
connections. `onPointerDown` runs when a connector claims the primary pointer,
before the drag threshold, so consumers can preserve click selection or other
gesture-start UI for headless surfaces.

Call `connector.updateConfig(...)` to change callbacks, metadata, policy,
surface strategies, collider radius, edge-pan behavior, or the line class
without replacing the connector or its existing lines. `name` is
construction-only because it is the connector's key in its parent node.

For a framework-owned graph, use `onConnectionRequest` to create the domain
edge and return its stable ID as an opaque line payload. Pass that payload
directly when hydrating with `connectToConnector`; programmatic connections do
not invoke the creation request.

Groups maintain an exclusive direct parent. Ordinary nodes use center
containment, nested groups use full-bounds containment, and the smallest safe
candidate wins unless an engine-level resolver overrides it.

SnapLine `0.3` is experimental and may make breaking changes before `1.0`.

Full documentation: https://snapengine.dev/docs/snapline/introduction
