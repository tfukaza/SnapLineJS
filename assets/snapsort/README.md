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
- `DragSession` - public view of the active gesture controller
- `DragVisual` - `"item"`, `"preview"`, or `"none"` pointer representation
- `DropEffect` - `"move"` or `"none"` persistent mutation choice
- `defaultAnimations` - opt-in 100ms reorder, drop, and programmatic-move animation preset
- Event types: `ItemInsertEvent`, `ItemRemoveEvent`, `ItemMoveEvent`, `ItemSwapEvent`, `GhostCreateEvent`, `GhostInsertEvent`, `GhostMoveEvent`, `GhostRemoveEvent`, `DragStartEvent`, `DragEndEvent`, `DropTargetChangeEvent`, `DropPriorityEvent`, `ItemHitboxEvent`, `VisualGeometryInvalidationEvent`, `DragLocation`
- `DROP_REJECT_PRIORITY` - the `-1` effective priority that rejects a destination
- Ghost and insertion render state: `GhostState`, `InsertionMarkerState`, `InsertionGapSegment`, and `InsertionMarkerNeighbor`
- Framework render state: `RenderEntry`, `RenderTree`, `RenderTreeEvent`, `createRenderEntry`, `createRenderEntries`, `createRenderTree`, and `reduceRenderTree`
- Insertion presentation: `InsertionMarkerRectOptions`, `insertionMarkerRect`, `toContainerLocalRect`, and `stockInsertionMarkerRectOptions`
- Geometry values (`Rect`, `Circle`, `Point`) use the shared types from `@snap-engine/core/geometry`
- `createVanillaAdapter` and `CreateVanillaAdapterOptions`
- `ContainerCallbacks`, `ContainerConfig`, `SortMode`

```ts
import { Container, defaultAnimations, Item } from "@snap-engine/snapsort";

const container = new Container(engine, parent, {
  itemId: "tasks-root",
  mode: "insertion",
  animation: defaultAnimations,
});

const item = new Item(engine, container, { itemId: "task-1" });
```

`itemId` is required when every ordinary `Item` and `Container` is created. It
is a non-empty, construction-only application identity: changing an identity
means creating a replacement object. IDs are unique across one independent
SnapSort root, including nested containers and live ghosts; separate roots may
reuse the same IDs.

RenderTree reducers use that identity to locate nested logical trees. The root
component itself must stay mounted for the lifetime of its RenderTree state.
If the root is destroyed, discard that state and create a fresh RenderTree for
the replacement root.

## Drop policy

Destination `getDropPriority` callbacks assign one effective policy value per
resolution. `-1` rejects the Container; nonnegative values remain eligible,
and the selected placement mode ranks positions only within the highest
priority. `dropPriority` defaults to `0`, so omitting policy keeps normal global
placement behavior.

Use item and container metadata for application-specific rules:

```ts
import {
  DROP_REJECT_PRIORITY,
  type DropPriorityEvent,
} from "@snap-engine/snapsort";

function prioritizeSameLane(event: DropPriorityEvent) {
  const lane = event.containerMetadata.lane;
  const matches = event.sources.every(
    (source) => source?.containerMetadata.lane === lane,
  );
  return matches ? undefined : DROP_REJECT_PRIORITY;
}
```

Common policies are available from the optional callbacks subpath:

```ts
import {
  prioritizeIntersectingContainer,
  prioritizeNearestContainerEdge,
  prioritizePointerContainer,
  prioritizeTreeDepth,
  rejectDrop,
} from "@snap-engine/snapsort/callbacks";
```

These helpers are pure, use the core collision geometry, and work with Vanilla,
Svelte, and React. `prioritizeTreeDepth` uses the virtual dragged Item's leading
X edge with the pointer's Y position to prefer the deepest matching vertical
tree Container. That depth preference is opt-in: default insertion targeting
does not prioritize depth or require the pointer to hover a destination Item or
Container. Programmatic `moveItem` calls are authoritative and bypass drop
policy.

## Callback Routing

Structural and root-lifecycle callbacks resolve once on the independent root:
`onItemInsert`, `onItemRemove`, `onItemMove`, `onItemSwap`, the three ghost
callbacks, `onDragStart`, `onDropTargetChange`, `onDragEnd`, and
`onVisualGeometryInvalidated`. Event fields identify the semantic source,
destination, or ghost owner. If a root structural callback is absent, SnapSort
uses the root adapter. Descendants cannot configure root-dispatched callbacks.

Drop policy, item hitbox geometry, and hover callbacks stay local to the
Container they describe and do not bubble or inherit. Item hover is
semantically separate from slot changes: non-swap placement hit-testing
considers the resolved target's direct children and, when that target is
nested, the target Container itself. The smallest matching hitbox wins, with a
direct child winning an equal-area tie. Hitbox and hover callbacks dispatch on
the hovered Item's actual direct owner, which can customize its
rectangle/circle through `getItemHitbox`. The root has no self candidate; swap
hover/target resolution and the direct `findHoveredItem` contract remain
direct-child-only.
Insertion targeting has no presentation callback: core owns the canonical gap,
adjacent-item data, and current-placement flag, then exposes them as
`InsertionMarkerState` through the ordinary ghost lifecycle. Rendering that
state stays on the adapter side of the commit boundary.

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

When the source Container configures `animation.move`, `removeItem(id)` is
accepted immediately and committed in SnapEngine's next coordinated frame.
SnapSort removes the requested Item through `onItemRemove`, then FLIP-animates
the surviving layout. Until an animated programmatic move or removal commits,
further move/remove commands for that Item return `false`, and no drag can
start within the same SnapSort root. Conversely, `moveItem` and `removeItem`
return `false` while that root has a drag session. Independent roots remain
unblocked. Directly deleting framework state remains synchronous and does not
use SnapSort animation; the departing element itself is never retained for an
exit animation.

Structural callback commands run through the root's `SnapSortAdapter.commit`
boundary. The Svelte and React bindings use it to publish framework state and
DOM synchronously; the Vanilla adapter performs the corresponding DOM command.

These callbacks describe transitions initiated by SnapSort. An application's
own Add or Delete command updates its collection directly; framework
mount/unmount then reconciles the matching core object without sending a
second insert/remove event back into the state that already made the decision.

## Framework-owned render state

`RenderTree` is an optional immutable scaffold for one independent SnapSort
root. Its `entries` contain ordinary application values and transient ghosts
in render order. Every ordinary entry has one required `itemId`; a non-null
`childTree` means that entry renders as a nested `Container`, while a null
`childTree` means it renders as an `Item`. The nested Container is itself the
sortable Item and must not be wrapped in another Item. Keep an empty child tree
mounted when it should remain a valid drop destination.

`reduceRenderTree` routes nested Containers by their required `itemId` and
applies SnapSort-originated item moves, swaps, removals, and all three ghost
lifecycle events across the complete tree. It intentionally excludes
`ItemInsertEvent`, because a core Item cannot manufacture an application value.
Application-owned insertions create an entry directly; copy/backfill and
destination-specific conversion remain application policy. Projects with a
different state shape can skip this helper and implement the explicit
callbacks themselves.

```ts
import {
  createRenderEntries,
  createRenderTree,
  reduceRenderTree,
  type ContainerCallbacks,
  type RenderTreeEvent,
} from "@snap-engine/snapsort";

let tasks = $state.raw(
  createRenderTree(createRenderEntries(initialTasks, (task) => task.id)),
);

const applyRenderEvent = (event: RenderTreeEvent) => {
  tasks = reduceRenderTree(tasks, event);
};

const callbacks = {
  onItemMove: applyRenderEvent,
  onItemRemove: applyRenderEvent,
  onItemSwap: applyRenderEvent,
  onGhostInsert: applyRenderEvent,
  onGhostMove: applyRenderEvent,
  onGhostRemove: applyRenderEvent,
} satisfies ContainerCallbacks;
```

Svelte uses `$state.raw(...)` here because each update replaces the immutable
root, while ghost state contains engine-owned object identities that should not
be deep-proxied. React stores the same value in ordinary component state.
Rendering still uses direct children and the framework's keyed loop; there is
no hidden ghost outlet or adapter-owned collection.

Application-specific destination meaning remains outside SnapSort. For
drop-to-delete, set `session.dropEffect = "none"` while the trash destination
is active so no ordinary move commits, then inspect `onDragEnd.destination`
and remove the application value yourself.

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

`DragSession` is exported as a type, not a constructor. Callback events and
`root.dragSession` expose the same controller object; nested containers return
`null`. Shared read-only observations include `root`, `items`, `sources`,
`pressedItem`, `primaryItem`, `status`, and the discriminated `input`
controller. Pointer coordinates live on pointer input, while direct
navigation state lives on direct input. The supported shared mutable controls
are `dragVisual` while pending and `dropEffect` while pending or active.

A preview is one root-owned `GhostState` with `type: "pointer-preview"` and an
overlay location. It can coexist with insertion's destination-owned
`"insertion-marker"`, which has a slot location. Each ghost has its own
generated `ghostItemId`; `originalItemId` identifies the application Item it
represents. The preview represents the complete ordered drag run and never
becomes application data.

## Insertion targeting and marker presentation

Insertion mode ranks zero-thickness gaps between retained items rather than
ranking ghost rectangles or item centers. Eligible gaps are considered without
requiring the pointer to hover their destination Item or Container. Each
candidate is scored first by absolute distance on its Container's main axis:
pointer Y for a column and pointer X for a row. Cross-axis center distance does
not affect this primary rank.

When candidates have the same main-axis distance, SnapSort compares the
virtual dragged item's leading cross-axis edge with the leading edges of each
candidate's adjacent item rectangles. The virtual rectangle preserves the
initial pointer-to-item grab offset. Stable tree traversal order breaks any
remaining tie, including candidates without neighbors. Default insertion has
no implicit depth preference; `getDropPriority` and helpers such as
`prioritizeTreeDepth` remain available when an application explicitly wants
depth-based destination policy. Physical indentation can affect the
leading-edge tie-breaker, but never candidate eligibility or primary distance.

For wrapped rows or columns, a gap's cross-axis span is the measured band of
the selected visual line. A boundary that wraps uses the next line's leading
edge and band; an append boundary uses the previous line's trailing edge and
band. This keeps marker state aligned with the same measured geometry used to
rank the destination.

An insertion marker is ordinary immutable ghost render state. In addition to
its identity and slot `location`, `InsertionMarkerState` provides the canonical
world-space `gap`, frozen `previous` and `next` neighbor records, and
`isCurrentPlacement`. The last field tells a renderer that committing the
candidate would preserve the dragged run's present placement. A marker can
change geometry or that flag while its container and index stay unchanged;
SnapSort reports that presentation update through `onGhostMove`. It does not
multiplex presentation changes into `onDropTargetChange`.

Framework components can turn the state into a positioned line by supplying
all presentation values explicitly:

```svelte
{#if entry.isGhost}
  <Ghost
    ghost={entry.ghost}
    insertionMarker={{ thickness: 3, startInset: 8, endInset: 8 }}
  />
{:else}
  <Item itemId={entry.itemId}>{entry.value.title}</Item>
{/if}
```

The framework-neutral helper takes the same explicit contract:

```ts
const rect = insertionMarkerRect(marker, {
  thickness: 3,
  startInset: 8,
  endInset: 8,
});
```

`insertionMarkerRect` expands the zero-thickness world-space gap around its
centerline, applies the two along-line insets, and returns coordinates from the
destination Container's padding-box outer edge. It accounts for the
Container's border and live scroll position; it does not subtract padding.
All three options are required, finite, and non-negative. If the insets total
more than `marker.gap.length`, the helper throws instead of clamping or
inventing a fallback. `toContainerLocalRect(worldRect, container)` exposes the
same world-to-local projection for arbitrary overlay geometry and requires a
mounted destination.

The published `stockInsertionMarkerRectOptions` value is the built-in renderer
contract `{ thickness: 3, startInset: 0, endInset: 0 }`; it is not an implicit
default of `insertionMarkerRect`. Vanilla can either select its own explicit
presentation or intentionally use that named stock contract by omitting the
option:

```ts
const adapter = createVanillaAdapter({
  insertionMarker: { thickness: 3, startInset: 8, endInset: 8 },
});
```

Svelte and React `Ghost` components also expose `insertionMarker`. Passing it
at the render site makes theme-specific marker thickness and insets visible in
application code instead of hiding those choices in targeting policy.

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
`useSnapSortAwaitMutation` helper are removed, and `SnapSortAdapter.commit` is
the framework mutation boundary. Custom `ContainerConfig.strategy` injection and
the root exports `SortStrategy`, `DropTargetStrategy`, and
`DragLifecycleStrategy` are also removed; select a built-in behavior through
`ContainerConfig.mode` and the exported `SortMode` type.

## Keyboard dragging

`KeyboardDragController` adds optional linear keyboard controls to one root
Container without changing Item markup or focus order:

```ts
import { Container, KeyboardDragController } from "@snap-engine/snapsort";

const root = new Container(engine, null, { itemId: "tasks" });
const keyboard = new KeyboardDragController(root);

// Enter lifts or drops, Escape cancels, and arrow keys follow the current
// Container's row or column direction.

keyboard.destroy();
```

Items must already use a native focusable element or provide `tabIndex`.
When an Item has a Svelte or React `Handle`, keyboard commands are accepted
only from that exact Handle. Custom bindings replace individual defaults:

```ts
const keyboard = new KeyboardDragController(root, {
  bindings: {
    liftDrop: ["Enter", " "],
    previous: { row: ["ArrowLeft", "h"] },
    next: { row: ["ArrowRight", "l"] },
  },
});
```

For board navigation or other spatial behavior, call
`item.beginDirectDrag()` and use the narrowed direct controller's `moveTo()`,
`drop()`, and `cancel()` methods from an application-owned key handler.

Accepted direct moves animate with the destination Container's
`animation.reorder` settings. The dragged visual interpolates its exact
position and size to the projected candidate geometry, including per-member
geometry for a selected group. Omit `animation`, set it to `null`, or disable
the reorder channel for an immediate move. A drop requested during a direct
transition is queued until that transition settles; cancellation interrupts
it immediately.

## DOM ownership contract

SnapSort core is designed to work identically across Vanilla JS, Svelte, React,
and any future framework adapter. That only works if core and the framework
never fight over the same DOM nodes. The contract:

1. **The framework owns the DOM tree.** Core never inserts, removes, or
   reparents an element the framework rendered. All structural intent flows
   through `ContainerCallbacks` (`onItemMove`, `onItemInsert`, `onItemRemove`,
   `onGhostInsert`, `onGhostMove`, `onGhostRemove`), which carry everything an
   adapter needs as immutable item or ghost render state. Direct DOM mutation
   exists only behind `createVanillaAdapter`; framework bindings never inherit
   it as a parallel mutation path.
2. **Core writes only non-structural properties on the dragged element** —
   `transform`, temporary `position`/`z-index`, and temporary `width`/`height`
   styles. Every framework tolerates that; none diffs inline styles it didn't
   set.
3. **Framework mutations commit synchronously.** Core runs structural
   commands inside `SnapSortAdapter.commit(mutation)`. React and Svelte adapters
   provide this transaction automatically, committing state and DOM before
   core performs its final geometry read and writes the inverse FLIP transform.
4. **After `commit`, the framework's DOM is the truth.** Core resolves
   elements lazily from item identity (`findItemById`), revalidates them with
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
