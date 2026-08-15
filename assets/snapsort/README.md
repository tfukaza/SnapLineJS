# @snap-engine/snapsort

Framework-neutral drag-and-drop primitives with first-party Svelte and React
bindings.

A single `Container`/`Item` class pair; each container picks its drag
behavior with `config.mode`: `"euclidean"` (default), `"progressive"`,
`"insertion"`, or `"swap"`.

## Install

```bash
npm install @snap-engine/snapsort
```

The package root is the framework-neutral API. Framework applications import
their bindings from `@snap-engine/snapsort/svelte` or
`@snap-engine/snapsort/react`.

## Core and Vanilla

- `Container`
- `Item`
- `DragSession`
- `DragVisual` - `"item"`, `"preview"`, or `"none"` pointer representation
- `DropEffect` - `"move"` or `"none"` persistent mutation choice
- `defaultAnimations` - opt-in 100ms reorder, drop, and programmatic-move animation preset
- Event types: `ItemInsertEvent`, `ItemRemoveEvent`, `ItemMoveEvent`, `ItemSwapEvent`, `GhostCreateEvent`, `GhostInsertEvent`, `GhostRemoveEvent`, `DragStartEvent`, `DragEndEvent`, `DropTargetChangeEvent`, `CanDropEvent`, `DropPriorityEvent`, `InsertionMarkerRectEvent`, `ItemHitboxEvent`, `VisualGeometryInvalidationEvent`, `DragLocation`
- `ContainerCallbacks`, `ContainerConfig`, `SortMode`

```ts
import { Container, defaultAnimations, Item } from "@snap-engine/snapsort";

const container = new Container(engine, parent, {
  mode: "insertion",
  animation: defaultAnimations,
});
```

## Drop eligibility and priority

Candidate selection has three stages. Destination `canDrop` callbacks first
exclude containers, `getDropPriority` then assigns a per-resolution preference,
and the selected placement mode ranks positions only within the
highest-priority containers. `dropPriority` is `0` by default, so omitting
policy keeps the normal global placement behavior.

Use item and container metadata for application-specific rules:

```ts
import type { CanDropEvent } from "@snap-engine/snapsort";

function canDropInSameLane(event: CanDropEvent) {
  const lane = event.containerMetadata.lane;
  return event.sources.every(
    (source) => source?.containerMetadata.lane === lane,
  );
}
```

Common policies are available from the optional callbacks subpath:

```ts
import {
  prioritizeIntersectingContainer,
  prioritizeNearestContainerEdge,
  prioritizePointerContainer,
  rejectDrop,
} from "@snap-engine/snapsort/callbacks";
```

These helpers are pure, use the core collision geometry, and work with Vanilla,
Svelte, and React. Programmatic `moveItem` calls are authoritative and bypass
drop eligibility and priority.

## Callback Routing

Callbacks belong to individual containers; they do not bubble or inherit from
the root. The root receives session-wide callbacks such as `onDragStart`,
`onDropTargetChange`, and `onDragEnd`. Candidate destinations receive
`canDrop`/`getDropPriority`, a normal move commits through the direct
destination's `onItemMove` (or `onItemInsert` fallback), and a swap commits
through the dragged item's direct, pre-swap source `onItemSwap`.

Ghost callbacks follow the container currently owning the ghost. Item hover is
semantically separate from slot changes: hit-testing is scoped to the resolved
target container, then dispatched on the direct owner of the hovered item.
That owner can customize a candidate's rectangle/circle through
`getItemHitbox`; insertion destinations can return a complete world-space
marker rectangle from `getInsertionMarkerRect`. Both are synchronous geometry
calculations outside `flushMutation`.

Item `metadata` is read-only application data (`ItemMetadata`), not behavior
configuration. Applications may replace it; SnapSort shallow-copies and freezes
the current value for each drag snapshot. Framework Item components also pass
native root-element attributes and events through directly.

An ordinary move does not also fire source `onItemRemove`. That callback is
for an item actually removed from its current owner, including
`container.removeItem(id)`. The
imperative `moveItem` (when placement changes) and `removeItem` APIs set
`event.session` to `null` and do not create a drag lifecycle. A same-placement
`moveItem` request emits no mutation callback.

Mutation callbacks run through `flushMutation` on the same container that
receives the callback. `flushMutation` is an adapter integration boundary, not
a lifecycle event; the Svelte and React bindings supply it automatically.

## Placement and drag visuals

SnapSort keeps three decisions independent:

1. The mode's target resolver chooses a destination.
2. The mode's placement feedback shows a flow spacer, insertion marker, or
   swap target.
3. `DragSession.dragVisual` chooses what follows the pointer.

`dragVisual` accepts `"item"`, `"preview"`, or `"none"`. Euclidean and
progressive default to `"item"`, insertion defaults to `"none"`, and swap
defaults to `"preview"`. Override it while the session is still pending,
normally from the root's `onDragStart` callback:

```ts
import type { DragStartEvent } from "@snap-engine/snapsort";

const callbacks = {
  onDragStart(event: DragStartEvent) {
    event.session.dragVisual = "preview";
  },
};
```

A preview is one root-owned `Ghost` with `kind: "marker"` and
`role: "pointer"`. It can coexist with insertion's destination-owned marker,
which has `role: "target"`. The preview represents the complete ordered drag
run and never becomes application data.

## Copy from move primitives

Copy is application state logic rather than a `dropEffect`. Handle the normal
destination-owned `onItemMove` in one synchronous update:

1. Move the original stable ID to `event.to`.
2. Mint a fresh replacement ID carrying the same application data.
3. Insert that replacement at the vacated `event.from` source/index.

This keeps the original stable identity represented by the drag visual as the
Item that animates into the destination. The source replacement is newly
mounted, so it has no old FLIP rectangle and is not inverse-animated. Set
`dragVisual = "preview"` when the source should remain visually occupied during
the gesture.

`DragSession.handoff(replacements)` remains available as a separate advanced
primitive for interfaces that already mounted a parallel replacement run and
need to retarget the pending gesture during `onDragStart`. Replacements must
be unique, connected Items in the same engine and root. Handoff transfers
pointer ownership, frozen geometry, and session participation; it does not
create, render, copy, destroy, or clean up application state. It cannot be
called after lifecycle activation begins.

### Migrating from built-in copy

Remove `session.dropEffect = "copy"`, `onDragClone`, transient adopted-Item
state, clone-cancellation `onItemRemove` handling, and `ItemMoveEvent.origin*`
reads. Choose `dragVisual = "preview"` when desired, then implement copy with
the ordinary non-null `event.from`/`event.to` move-and-backfill recipe above.

## Svelte

Install Svelte and the shared Engine binding alongside SnapSort:

```bash
npm install @snap-engine/snapsort @snap-engine/asset-base svelte
```

```svelte
<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Handle, Item } from "@snap-engine/snapsort/svelte";
  import type { ItemMoveEvent } from "@snap-engine/snapsort";
</script>
```

The Svelte entry exports `Container`, `Ghost`, `Item`, and `Handle`. Component
subpaths such as `@snap-engine/snapsort/svelte/Container.svelte` are also
supported.

## React

Install the React peers and shared Engine binding alongside SnapSort:

```bash
npm install @snap-engine/snapsort @snap-engine/asset-base react react-dom
```

```tsx
import {
  Container,
  Engine,
  Ghost,
  Handle,
  Item,
} from "@snap-engine/snapsort/react";
import type { ItemMoveEvent } from "@snap-engine/snapsort";
```

The React entry also exports `SnapSortEngine`, `useSnapSortEngine`, framework
contexts, and component prop types. Deep imports such as
`@snap-engine/snapsort/react/Container` remain supported.

Svelte, React, React DOM, and Asset Base are optional peers. Consumers of
the package root do not need to install either framework.

## Upgrading to 0.5

SnapSort 0.5 replaces the separate framework packages with subpath bindings in
the main package:

| Before                         | SnapSort 0.5                   |
| ------------------------------ | ------------------------------ |
| `@snap-engine/snapsort-svelte` | `@snap-engine/snapsort/svelte` |
| `@snap-engine/snapsort-react`  | `@snap-engine/snapsort/react`  |
| `container.addItem(item)`      | `container.attachItem(item)`   |
| `container.configuration`      | `container.config`             |
| `animation.clickMove`          | `animation.move`               |

Remove the old adapter package from your dependencies and install
`@snap-engine/snapsort` instead. The package root remains the framework-neutral
API. Version 0.5 does not include compatibility shims for the retired package
names.

Animations are also opt-in. Omit `ContainerConfig.animation` for immediate
reorders, drops, and programmatic moves, or pass the exported
`defaultAnimations` preset to retain SnapSort's standard 100ms motion. The
former `disableFlip` option has been removed; `animation: null` and per-channel
`null` values remain supported.

The 0.5 API is intentionally synchronous and mode-based. Mutation events no
longer contain a `phase`, `ContainerCallbacks.awaitMutation` and the React
`useSnapSortAwaitMutation` helper are removed, and `flushMutation` is the only
framework mutation boundary. Custom `ContainerConfig.strategy` injection and
the root exports `SortStrategy`, `DropTargetStrategy`, and
`DragLifecycleStrategy` are also removed; select a built-in behavior through
`ContainerConfig.mode` and the exported `SortMode` type.

## DOM ownership contract

SnapSort core is designed to work identically across Vanilla JS, Svelte, React,
and any future framework adapter. That only works if core and the framework
never fight over the same DOM nodes. The contract:

1. **The framework owns the DOM tree.** Core never inserts, removes, or
   reparents an element the framework rendered. All structural intent flows
   through `ContainerCallbacks` (`onItemMove`, `onItemInsert`, `onItemRemove`,
   `onGhostInsert`, `onGhostRemove`), which carry everything an adapter needs
   (`index`, `beforeElement`, `ghostRect`, metadata). The default callback
   implementations in `mutation.ts` are the "vanilla JS adapter" — legitimate
   defaults when no framework owns the DOM, not a parallel mutation path.
2. **Core writes only non-structural properties on the dragged element** —
   `transform`, `position`/`z-index` styles. Every framework tolerates that;
   none diffs inline styles it didn't set.
3. **Framework mutations commit synchronously.** Core runs structural
   callbacks inside `flushMutation(mutation)`. React and Svelte adapters
   provide this transaction automatically, committing state and DOM before
   core performs its final geometry read and writes the inverse FLIP transform.
4. **After `flushMutation`, the framework's DOM is the truth.** Core resolves
   elements lazily from item identity (`findItemByKey`), revalidates them with
   `isConnected`, and verifies placement. It never silently repairs adapter
   output, since that would mask an integration bug.

`onVisualGeometryInvalidated` is the low-level seam for visuals owned by other
systems. SnapSort coalesces drag, ghost, and FLIP changes at the root container
and reports the affected items during the next engine read phase. The callback
does not refresh any dependent UI itself; consumers decide what to invalidate.

A concrete consequence: **the dragged element stays in its original DOM
parent for the entire drag.** It never gets reparented into whichever
container is currently hovered — it's moved only by `transform`, computed
against a coordinate parent frozen at drag start. This is what lets the React
adapter stay thin (no DOM snapshot/restore bookkeeping): React's reconciler
never observes a node outside the parent it rendered it under.

### Accepted trade-offs

- **Clipping/stacking:** an `overflow: hidden` ancestor can clip the dragged
  element, and a FLIP-transformed ancestor becomes a stacking context, so the
  dragged item (`z-index: 1000`) can paint under a later sibling while that
  ancestor is mid-animation. Avoid `overflow: hidden` on draggable surfaces if
  this matters for your layout.
- **Original parent unmounted mid-drag:** if the framework unmounts the
  dragged item's parent while a drag is in flight, the dragged element goes
  with it (the framework owns that subtree). `dragEnd` still commits state via
  `onItemMove`/`onItemInsert`, so application state recovers even though the
  visual drag ends abruptly.
- **Inner scroll containers:** core does not track scroll offsets. Dragging
  within a container that itself scrolls mid-drag is unhandled today (this
  predates the ownership contract and is a separate, open limitation).
