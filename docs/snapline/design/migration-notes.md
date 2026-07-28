---
title: SnapLine migration notes
description: Internal design doc — migrating across the controlled-graph re-architecture.
hidden: true
---

# SnapLine migration notes — the controlled-graph re-architecture

Status: migration reference for the pre-1.0 re-architecture  
Applies to: every consumer upgrading across the `Cleanup` re-architecture

SnapLine's topology is now **always controlled**: the application's document
is the single source of truth for which nodes, connectors, and lines exist.
SnapLine maintains an engine-scoped runtime mirror, and user gestures arrive
as atomic proposals the application accepts by updating its records.
Position and size stay SnapLine-owned — geometry is a visual cue, observed
(not negotiated) through one batched callback.

## Type and callback renames

| Old | New |
| --- | --- |
| `NodeComponent` / `ConnectorComponent` / `LineComponent` / `GroupNodeComponent` (core) | `NodeMirror` / `ConnectorMirror` / `LineMirror` / `GroupNodeMirror` |
| `RectSelectComponent` | `RectSelectController` |
| `NodeObjectContext` (React) | `NodeMirrorContext` |
| `ConnectorLinePhase` | `LineMirrorPhase` (adds `"staged"`) |
| `syncDomGeometry()` | `remeasureDomGeometry()` |
| `onLinesChanged` | unchanged name; payload is `LineMirror`s |
| `onDragCommit` + `onResizeCommit` | one batched `onGeometryCommit({ nodes })` |
| `NodePosition` / `NodeDragCommitEvent` | `NodeGeometry` / `GeometryChangeEvent` |
| `EdgeId` / `EdgeRecord` / `EdgeLike` / `EdgeEndpoint` | `LineId` / `LineRecord` (stable-id, no endpoint-pair keying) |

## Connector configuration: `capabilities` → `rules`

`maxConnectors`, `allowDragOut`, and `capabilities` are gone. The mapping:

| Old | New `rules` |
| --- | --- |
| `allowDragOut: true` (source-only) | `{ maxIncoming: 0 }` |
| `allowDragOut: false, maxConnectors: N` (target-only, finite) | `{ maxOutgoing: 0, maxIncoming: N, onFull: "replace-oldest" }` |
| `maxConnectors: -1` (unlimited) | `maxIncoming: "unlimited"` (the `-1` sentinel is gone) |
| `capabilities.source/target` booleans | derived: `isSource` = `maxOutgoing !== 0`, `isTarget` = `maxIncoming !== 0` |
| implicit oldest-line eviction | explicit `onFull: "reject"` (default) or `"replace-oldest"` |
| `canConnect(event)` pair predicate (callback) | `rules.isValidConnection(proposal)` — line-aware: `{ line, source, target, phase }`; both endpoints may veto; synchronous and side-effect free |
| `onConnectionRequest` (veto + payload) | veto → `isValidConnection`; payload → canonical `LineRecord.payload` |

Defaults: `maxOutgoing: "unlimited"`, `maxIncoming: 1`, `reconnect: true`,
`allowParallel: false`, `onFull: "reject"`.

## EdgeSync → ControlledGraph

The `EdgeSync` component/controller, its `identity()` callback, and
endpoint-pair edge matching are replaced by the controlled-graph protocol:

```svelte
<ControlledGraph onLineChangeRequest={(r) => (lines = applyLineChange(lines, r))} />
```

- `lines: readonly LineRecord[]` — your document's records, each
  `{ id, fromConnectorId, toConnectorId, payload? }`. Give connectors stable
  `id` props (a composite like `` `${node}:${port}` `` works well) instead of
  implementing `identity()`.
- `onLineChangeRequest(request)` — ONE atomic proposal per gesture:
  `{ intent: "connect" | "disconnect" | "replace" | "reconnect", add,
  remove, update }`. Apply it atomically: filter `remove`, apply `update`
  endpoint changes, concat `add`. A capacity replacement arrives as a single
  `"replace"` (removals + addition together), never as ordered intents.
- **Adopt the proposed ids.** A gesture-created line carries a
  SnapLine-minted `LineId`; keeping it in the record you add settles the
  dragged line in place (no flicker, same mirror). Substituting your own id
  works but recreates the mirror.
- **Return the next list.** `onLineChangeRequest` returns the records that
  should now be canonical; the bridge adopts them directly, so there is no
  push to remember. Rejection is `return lines` — the staged line is
  discarded on the decisive pass. The return type is required, so forgetting
  to return is a type error rather than a silent rejection.
- Diagnostics: records the mirror cannot represent (missing endpoints stay
  silently latent; capacity/rule violations) surface through
  `onDiagnosticsChanged` / `query(engine).diagnostics()` — canonical records
  are never rewritten or evicted by SnapLine.

## Imperative topology API removal

`connectToConnector()`, `deleteLine()`, `deleteAllLines()`, and `createLine()`
are no longer public (`disconnectFromConnector()` has been removed
outright). Create and
remove lines by changing your records; `canConnect(target, line?)` remains
as a read-only admission query. A gesture on an engine with no attached
graph owner warns and discards the preview.

**Vanilla JS** consumers own the graph with a plain module — a mini emulated
framework holding the records:

```ts
import { attachControlledGraph } from "@snap-engine/snapline";

let lines = [];
const handle = attachControlledGraph(engine, {
  onLineChangeRequest(request) {
    lines = [
      ...lines
        .filter((record) => !request.remove.includes(record.id))
        .map((record) => {
          const update = request.update.find((u) => u.id === record.id);
          return update
            ? { ...record, toConnectorId: update.toConnectorId }
            : record;
        }),
      ...request.add,
    ];
    handle.setCanonicalGraph({ lines });
  },
});
handle.setCanonicalGraph({ lines });
```

## Stable identity

Every mirror has a domain id — `nodeId` / `connectorId` / `lineId` —
supplied via the `id` prop/config or minted (`node-42`-style) when omitted.
Minted ids are stable only for the mirror's lifetime: any graph that
outlives it (persistence, remounts, reloads) must supply its own ids, or
stored `LineRecord`s will reference dead connector ids. Adapter line lists
key by `lineId`, and line SVGs carry `data-line-id`.

## Property propagation removal

The node property bag (`setProp` / `getProp` / `addSetPropCallback` /
`propagateProp`) is gone. Dataflow belongs to the application graph: derive
values from your own document (the same records that drive
`ControlledGraph`) and render them through normal framework state.

## Geometry

`onGeometryCommit({ nodes: [{ node, x, y, width, height }] })` fires once
per settled drag (every moved node of a group/multi-select drag in one
event) or resize (single entry). SnapLine owns live and settled geometry;
persist the observation if you want it back after a reload — ignoring it
never reverts the mirror.
