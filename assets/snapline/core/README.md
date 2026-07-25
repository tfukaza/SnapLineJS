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

Groups maintain an exclusive direct parent. Ordinary nodes use center
containment, nested groups use full-bounds containment, and the smallest safe
candidate wins unless an engine-level resolver overrides it.

SnapLine `0.3` is experimental and may make breaking changes before `1.0`.

Full documentation: https://snapengine.dev/docs/snapline/introduction
