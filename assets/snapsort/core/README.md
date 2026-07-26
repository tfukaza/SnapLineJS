# @snap-engine/snapsort

Core TypeScript logic for SnapEngine drag-and-drop interactions.

A single `Container`/`Item` class pair; each container picks its drag
behavior with `config.mode`: `"euclidean"` (default), `"progressive"`,
`"insertion"`, or `"swap"`.

## Install

```bash
npm install @snap-engine/snapsort @snap-engine/core
```

## Includes

- `Container`
- `Item`
- `DragSession`
- Event types: `ItemInsertEvent`, `ItemRemoveEvent`, `ItemMoveEvent`, `ItemSwapEvent`, `GhostCreateEvent`, `GhostInsertEvent`, `GhostRemoveEvent`, `DragStartEvent`, `DragEndEvent`, `DropTargetChangeEvent`, `CanDropEvent`, `VisualGeometryInvalidationEvent`, `DragLocation`
- `ContainerCallbacks`, `ContainerConfig`, `SortMode`, `SortStrategy`

## Usage

```ts
import { Container, Item } from "@snap-engine/snapsort";

const container = new Container(engine, parent, { mode: "insertion" });
```

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

`awaitMutation` remains deprecated for compatibility. Promise-returning
mutation waits are not paint-atomic and are not supported by the FLIP path.

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
