# SnapSort Programmable Direct-Drag and Keyboard Accessibility

## Summary

Add an input-agnostic direct-drag session that lets applications program a live
gesture through `moveNext()`, `movePrevious()`, `moveTo()`, `drop()`, and
`cancel()`. Direct movement bypasses pointer hit-testing and ranking while
preserving SnapSort's existing lifecycle, policy checks, callbacks, visuals,
adapters, and final mutations.

Direct movement is target-first. A command selects an exact logical candidate,
SnapSort synchronizes its prospective placement, and only then derives private
presentation coordinates from the candidate geometry to reuse the existing
item/preview animation path. The derived coordinates never participate in
candidate selection. Application data and final DOM order change only when the
session drops.

Ship an optional `KeyboardDragController` supporting only lift/drop, cancel,
and linear previous/next navigation. Kanban movement, spatial navigation,
selection controls, and other gestures remain the responsibility of custom
controllers calling the direct-session API.

## Public contracts

### SnapEngine input

```ts
interface keyDownProp {
  event: KeyboardEvent;
  focusedObject: ElementObject<DomElement> | null;
}
```

- `focusedObject` is the nearest registered object in the key event's composed
  path, not a `document.activeElement` lookup.
- Dispatch `keyDown` through the existing object-to-ancestor and global input
  paths.
- Add `ElementObject.inputElement`, returning the registered input alias,
  otherwise the object element, otherwise `null`.
- Keep callbacks void-returning; controllers communicate ownership through
  `preventDefault()`.

### Drag sessions

```ts
interface DragSession {
  readonly root: Container;
  readonly input: PointerDragController | DirectDragController;
  readonly items: readonly Item[];
  readonly sources: readonly DragLocation[];
  readonly pressedItem: Item;
  readonly primaryItem: Item;
  readonly status: DragSessionStatus;
  dragVisual: DragVisual;
  dropEffect: DropEffect;
}

class PointerDragController {
  readonly inputType: "pointer";
  readonly pointerId: number;
  readonly start: Readonly<{ x: number; y: number }>;
  readonly pointer: Readonly<{ x: number; y: number }>;
}

class DirectDragController {
  readonly inputType: "direct";
  readonly candidates: readonly DragLocation[];
  readonly currentTarget: DragLocation | null;

  moveNext(): boolean;
  movePrevious(): boolean;
  moveTo(container: Container, index: number): boolean;
  drop(): boolean;
  cancel(): boolean;
}
```

Add:

```ts
Item.beginDirectDrag(): DragSession | null;
```

- `DragSessionController` is the one runtime session object. `root.dragSession`
  and callback session fields expose that same object through the narrower
  `DragSession` interface; there is no separate handle or wrapper class.
- Callers narrow `session.input.inputType` before using pointer coordinates or
  direct navigation commands.
- The shared session transaction retains private `visualStart`,
  `visualPointer`, and `visualOffset` coordinates solely as an adapter for the
  existing visual transform code. Pointer input copies real coordinates into
  them; direct input derives them from the accepted candidate. They are not
  public direct-session state, and `Item.dragPointerPosition` returns `null`
  for a direct session.
- `dragVisual` remains input-agnostic. Direct sessions preserve all existing
  `"item"`, `"preview"`, and `"none"` behavior.
- `beginDirectDrag()` returns `null` for expected refusal: locked or unattached
  initiator, pending programmatic mutation, or an existing root session.
  Invalid or destroyed programmer state throws.
- In flow modes, starting on a selected Item uses the existing selected group
  and excludes locked members. In direct swap mode, only the initiating Item
  participates.
- Preserve `pressedItem`'s existing group-anchor meaning. Track the actual
  initiating Item ID privately for navigation anchoring and focus restoration.
- Existing `getIndexAndContainer()` and cached geometry remain the ordinary
  Item/Container position APIs; do not add another global position index.

### Controller ownership

Keep one drag transaction and contain its input-specific behavior through
composition:

```ts
type DragInputController = PointerDragController | DirectDragController;

type DragInputStart =
  | {
      readonly inputType: "pointer";
      readonly prop: dragStartProp;
    }
  | {
      readonly inputType: "direct";
      readonly initiatingItemId: ItemId;
    };

class DragSessionController {
  readonly input: DragInputController;

  constructor(
    root: Container,
    items: readonly Item[],
    sources: readonly DragLocation[],
    strategy: SortStrategy,
    start: DragInputStart,
    pressedItem?: Item,
  );
}
```

- `DragSessionController` owns the shared drag transaction: root and
  participants, snapshots and group geometry, strategy/lifecycle state,
  drag-visual and drop-effect configuration, ghosts and pending placement,
  exact-target application, commit/cancel/error cleanup, and the internal
  visual coordinates used by existing animation code.
- `PointerDragController` owns `pointerId`, real start/current coordinates,
  pointer move/end entry points, pointer hit-testing and candidate ranking,
  hovered-Item state, and pointer-only enter/move/leave callbacks.
- `DirectDragController` owns the frozen rich candidates, their public
  `DragLocation` projection, current candidate index, navigation and policy
  scanning, move-settling and queued-terminal state, initiating Item identity,
  and focus restoration.
- Do not add public wrapper classes or an inheritance hierarchy.
  `DragSessionController` implements the public `DragSession` shape directly,
  while its contained input controller owns the pointer- or direct-only API.
- A pointer gesture and a direct/key gesture both construct the same
  `DragSessionController`. The constructor receives a discriminated
  `DragInputStart`, initializes all shared transaction state, and then creates
  the matching contained controller. Callers never construct an input
  controller separately and never attach one to an existing session.
- Each input controller may retain a private, non-owning reference to its
  session so its commands can request shared placement, visual, drop, and
  cancellation work. The session remains the sole owner of the controller and
  of the drag transaction.
- Refactor pointer resolution to receive the real pointer from
  `PointerDragController`; it must not read the shared visual adapter as input.
  Direct input updates `visualPointer` only after choosing an authoritative
  candidate and never invokes pointer resolution.
- Do not add `fromPointer()`/`fromDirect()` factories or expose a separate
  candidate-initialization step. Root session storage, callbacks, and
  `root.dragSession` all reference the same `DragSessionController` instance.

### Session initialization lifecycle

The session owns initialization from the initial event through activation:

1. Pointer drag start or `Item.beginDirectDrag()` gathers the participants,
   sources, strategy, and a `DragInputStart` description.
2. `new DragSessionController(...)` initializes shared state and constructs
   either `PointerDragController` or `DirectDragController` itself.
3. The caller installs that complete session in the root and calls
   `session.begin()` with no second copy of the pointer-start property.
4. During the existing `READ_1` start stage, the session captures drag
   snapshots and computes group geometry.
5. If the contained controller is direct, the session invokes one internal
   controller activation method. That method builds and freezes candidates
   from the now-available drag snapshot.
6. During `WRITE_1`, normal validation, callbacks, lifecycle startup, and the
   transition to `"active"` continue for either input method.

The direct controller exists from session construction onward but accepts no
navigation or terminal command until candidate activation completes. Calls
made while the session is `"pending"` return `false`. Candidate activation is
an internal phase of `session.begin()`, not public object assembly; it runs
exactly once and throws if the session attempts to activate it twice.

## Direct-session implementation

### Frozen candidates and indices

Build a pure structural candidate snapshot during the direct session's
`READ_1` activation, after the session has captured its drag snapshot and group
geometry. The public array remains frozen for the active session and includes
structurally valid candidates even when current drop policy rejects them.

Each private candidate keeps its exact resolved target and the frozen geometry
needed to present that target. Do not store a pointer anchor. The target is the
single source of truth; the public `DragLocation` is derived from it.

```ts
type DirectCandidate =
  | {
      readonly kind: "flow";
      readonly target: ResolvedDropTarget;
      readonly memberRects: readonly Rect[];
    }
  | {
      readonly kind: "insertion";
      readonly target: ResolvedDropTarget & {
        readonly insertion: InsertionMarkerPresentation;
      };
      readonly memberRects: readonly Rect[];
    }
  | {
      readonly kind: "swap";
      readonly target: ResolvedDropTarget;
      readonly targetItemId: ItemId;
      readonly memberRects: readonly Rect[];
    };
```

- Flow candidates reuse the layout engine's projected group placement rect.
- Insertion candidates retain both the canonical zero-thickness marker
  presentation and a separate projected group rect for the drag visual.
- Swap candidates retain the target Item identity and its frozen rect.
- Candidate collection and geometry generation must not require a pointer.
  Refactor pointer-distance scoring into a later selection step so pointer and
  direct modes can share geometry without sharing resolution.

### Layout projection for flow candidates

Use the layout engine's existing virtual-insertion model instead of building or
splicing a second Item-order representation outside the layout module. A
`VirtualInsertion` is the dragged member's stand-in in the hypothetical final
order, and `FlowPositionResult.virtualRects` is the authoritative projected
geometry.

For each candidate:

1. Start from the frozen root drag snapshot.
2. Exclude every dragged participant through
   `filter.excludeValues = session.itemSet`. Candidate indices therefore use
   the final post-removal coordinate system.
3. Create one `VirtualInsertion` per dragged member at consecutive indices
   beginning at the candidate index. Size every entry with
   `virtualEntrySizeFor(targetSnapshot, memberBox)` so destination stretching,
   margins, wrapping, and measured-slot layouts remain layout-engine owned.
4. Register that insertion run when creating the candidate's layout resolution
   plan. This lets a nested destination's projected dimensions propagate
   through its ancestors.
5. Materialize positions recursively from the root content-box origin to the
   destination, passing each Container its local insertion entries.
6. Read every inserted member's rect from `virtualRects` and freeze the full
   array as `candidate.memberRects`, ordered to parallel `session.items`.

The essential local call is:

```ts
const result = layoutPlan.layoutPositions(
  targetSnapshot,
  targetOrigin.x,
  targetOrigin.y,
  insertionRun,
);

const memberRects = insertionRun.map((insertion) => {
  const rect = result.virtualRects.get(insertion);
  if (!rect) {
    throw new Error("SnapSort: layout did not project a direct candidate.");
  }
  return rect;
});
```

The layout module's `materializeEntries()` remains the sole owner of the
hypothetical order: it starts with the filtered children and inserts the
virtual entries at their requested indices. Direct-candidate code must not
manually clone, splice, or lay out an Item list.

Single-item dragging is the degenerate one-entry run. A multi-item run retains
every member's destination position and size; its bounding union is derived
from the current interpolated member rects only when a combined preview needs
one group rectangle.

For `euclidean`, `progressive`, and `insertion`:

- A candidate is a final, ghost-free, post-removal `{container, index}` slot.
- Each Container contributes `retainedChildCount + 1` slots, including empty
  Containers.
- Convert this public final index internally to the existing lifecycle's
  live/pre-removal index when synchronizing or committing.
- Direct navigation exposes all slots. `locked` only prevents an Item from
  starting or joining a drag; it does not suppress adjacent direct candidates.
- Remove dragged participants from traversal and prune the entire subtree of a
  dragged Container to prevent cycles.
- Traverse deterministically:

  1. Yield the Container's slot `0`.
  2. For each retained child, recurse into it when it is a Container.
  3. Yield the parent's next slot after that child.

For insertion mode, map each logical slot to one canonical presentation: the
boundary immediately before the next retained child, or the end boundary.

For swap mode:

- Traverse Items, including nested Containers-as-Items, in depth-first
  preorder. Include the initiating participant's home position as one no-op
  candidate; prune the remaining dragged participants and their subtrees.
- A candidate location identifies the target Item at its frozen parent/index;
  empty Containers provide no target.
- Retain the target Item identity internally and re-resolve it before commit.
- Selecting the already-current home candidate returns `false`; returning to
  it from another candidate is accepted and clears the prospective swap.
- Dropping on the home candidate performs no mutation.

During direct activation, initialize the single current candidate to the
initiating Item's projected source/home slot. If a selected ancestor is the
actual participant, use that nearest participant's source instead. Once active,
`currentTarget` is always `candidates[currentCandidateIndex]`; there is no
separate navigation cursor. It may be `null` only while the session is pending
and candidate geometry has not yet been captured.

### Movement and policy

- `moveTo()` validates that the Container is live, belongs to the same root,
  is outside every dragged subtree, and that the integer index exists in the
  frozen candidate contract. Invalid arguments throw.
- Every move command evaluates `dropPriority` synchronously. `-1` rejects;
  finite nonnegative values accept without relative ranking; all other
  negative or non-finite values throw.
- `moveTo()` evaluates its requested Container once using that candidate's
  index and virtual geometry.
- A `moveNext()`/`movePrevious()` scan evaluates each encountered Container at
  most once for that command. Rejection skips all of that Container's own slots
  but never prunes descendants. A later command reevaluates policy.
- An already accepted target is authoritative and is not revalidated by
  `drop()`.
- A successful move immediately makes the selected target authoritative and
  updates `currentTarget`, then schedules prospective placement and visual
  synchronization. The shared `visualPointer` is derived from that target; it
  never determines or revalidates it.
- Return `false` at traversal boundaries, for the same destination, policy
  rejection, an inactive or terminal session, or while another move is
  settling.
- A move called while start is pending returns `false`; candidate geometry and
  the initial source target become available together during `READ_1`
  activation.

### Shared lifecycle and visual state

Refactor pointer placement so target resolution and target application are
separate:

- Pointer sessions run hit-testing/ranking, then pass the resolved target to a
  shared placement method.
- Direct sessions pass their exact logical target to that method without
  invoking pointer algorithms.
- The shared path remains responsible for placement conversion, ghosts,
  markers, `onDropTargetChange`, visual invalidation, and mode lifecycle
  callbacks. Pointer-hover state and `onDragItemEnter`/`Move`/`Leave` remain
  pointer-input-only.

Apply an accepted direct candidate in this order:

1. Construct the shared placement update from the candidate's exact target.
2. Synchronize its prospective flow ghost, insertion marker, or swap target.
3. Capture the currently rendered rect of every dragged member as the motion
   origin. For a second command this is the previous candidate's settled
   geometry, not the gesture's original source geometry.
4. Animate each member rect to its corresponding `candidate.memberRects`
   entry, interpolating `x`, `y`, `width`, and `height` together.
5. Derive the compatibility `visualPointer` from the initiating member's
   source-to-current delta and run the existing mode lifecycle's drag-visual
   update on every tick.

The initiating member keeps the legacy pointer adapter coherent without
making it authoritative:

```ts
const visualPointer = {
  x: visualStart.x + currentPressedRect.x - pressedSourceRect.x,
  y: visualStart.y + currentPressedRect.y - pressedSourceRect.y,
};
```

Do not use candidate centers: differently sized source and destination Items
would produce an incorrect grab offset. Never feed the derived visual pointer
back through `DropTargetStrategy.resolve()`. Item visuals consume their exact
interpolated member rect; pointer previews derive their group rect and member
drop origins from the same current geometry.

Direct motion uses the accepted destination Container's `animation.reorder`
duration and easing. As with other SnapSort animations, an omitted animation
config, `animation: null`, a nonpositive duration, or `dragVisual: "none"`
settles immediately at the exact destination geometry. Only one direct move
animation runs at a time. Cancel, teardown, and error cleanup stop it; a drop
requested while it runs begins only after the animation reaches its exact
endpoint.

Flow modes create their source spacer during activation. Insertion synchronizes
its source marker as the initial placement. Swap initializes its logical home
candidate without highlighting or attempting to swap the Item with itself.

Prospective placement does not fire Item mutation callbacks. The ghost/marker
occupies the target visually while the framework-owned collection remains the
source of truth. `drop()` commits once; `cancel()` removes transient state and
requires no application rollback.

### Scheduling, terminal commands, and cleanup

- Permit one accepted move at a time. Keep the session busy until its callbacks,
  adapter reconciliation, transient visual synchronization, and direct-motion
  animation settle; later requests return `false` and are not queued.
- `drop()` during a busy move queues one terminal request and returns `true`.
  Repeated terminal requests return `false`.
- Keep public status pending or active until queued drop work actually begins.
  This lets `cancel()` supersede an uncommitted queued drop.
- Once commit begins, expose `"dropping"` and reject cancellation.
- `cancel()` immediately invalidates pending move/drop work, unwinds visuals,
  and commits nothing.
- Dropping with no accepted move fires no Item mutation callback and reports
  `sources[0]` as `onDragEnd.destination`.
- Preserve existing error-boundary behavior for scheduled callback failures,
  followed by guaranteed session cleanup.
- Use generation-aware queue IDs so work from an ended session cannot affect a
  newer session.
- Participant destruction cancels the session. A destroyed pending target
  cannot commit. Root destruction hard-disposes the session without callbacks
  or focus restoration.

Make the root session store exclusive:

- Neither pointer nor direct start may overwrite an existing session.
- Pointer move/end handlers require `input.inputType === "pointer"` and the
  matching `pointerId`.
- Pointer gestures in the same root cannot move, drop, or cancel a direct
  session; unrelated engine input and other roots remain usable.

## Standard keyboard controller and focus

### Controller API

```ts
interface KeyboardDragBindings {
  liftDrop?: readonly string[];
  cancel?: readonly string[];
  previous?: Partial<Record<"column" | "row", readonly string[]>>;
  next?: Partial<Record<"column" | "row", readonly string[]>>;
}

interface KeyboardDragControllerOptions {
  bindings?: KeyboardDragBindings;
}

class KeyboardDragController {
  readonly root: Container;

  constructor(root: Container, options?: KeyboardDragControllerOptions);
  destroy(): void;
}
```

Defaults use `KeyboardEvent.key`:

```ts
{
  liftDrop: ["Enter"],
  cancel: ["Escape"],
  previous: {
    column: ["ArrowUp"],
    row: ["ArrowLeft"],
  },
  next: {
    column: ["ArrowDown"],
    row: ["ArrowRight"],
  },
}
```

A supplied action/direction list replaces that default; an empty list disables
it.

- The constructor requires a live root Container and an unused
  `root.event.global.keyDown` slot, then installs its callback. Root-scoped
  dispatch keeps commands active while a dragged Item is temporarily outside
  the logical ancestor chain; exact `focusedObject` and `inputElement`
  filtering still limits ownership to this root. It throws on conflicts.
- Do not add a controller property to Container.
- `destroy()` is idempotent and removes the callback only if it still owns the
  slot.
- Destroying the controller cancels only an active direct session that the
  controller itself started. It leaves application-started sessions untouched.
- Custom controllers assign their own root `keyDown` callback and call the
  direct-session API directly.

### Key behavior

- Inactive Enter starts any focused, unlocked Item; selection only controls
  participant grouping.
- During any active direct session on the root, Enter drops and Escape cancels.
- Previous/next use `currentTarget.container.direction`; every active direct
  session already has its source/home candidate as `currentTarget`.
- There is no wrapping, spatial navigation, board-switch action, or `moveTo`
  resolver in the standard controller.
- Handle a command only when the native event target is exactly an Item's
  effective `inputElement` in the same root. Nested controls retain their
  native behavior.
- Ignore already-default-prevented and composing events.
- Configured commands require no Shift, Control, Meta, or Alt modifier.
- Ignore repeated Enter/Escape actions; allow native arrow repetition.
- While active, prevent default for recognized movement keys even when
  movement returns `false` because of a boundary or busy session.
- Prevent default for a successful lift and accepted drop/cancel. A refused
  inactive lift remains native.
- Tab and Shift+Tab always cancel an active direct drag immediately but remain
  unprevented so browser focus navigation continues. This controller-driven
  cancellation suppresses the usual initiating-Item focus restoration; the
  browser's newly focused element remains authoritative.
- Ignore pointer sessions.

### Focus restoration

- Every direct session records the initiating Item ID separately from
  `pressedItem`.
- After terminal callbacks and adapter/framework reconciliation, resolve the
  current Item instance by ID and focus its current `inputElement` with
  `{preventScroll: true}`.
- Restoration is unconditional even if application code moved focus during the
  gesture.
- Skip restoration if the root was destroyed or the initiating Item no longer
  exists; do not focus the root or a sibling.
- Make React Handle alias registration synchronous with its ref commit and
  Svelte registration synchronous with element attachment, so a remounted
  Handle is registered before restoration.
- The library does not alter `tabIndex`; consumers must use a native focusable
  control or configure `tabIndex` on the Item/Handle.

### Ghost and screen-reader feedback

- Ghosts are physical layout markers, not duplicate accessible Items. Built-in
  adapters render them as presentational/`aria-hidden` content.
- During a direct drag, the focused real Item remains the accessibility anchor.
- Applications own screen-reader announcements. They may use
  `onDropTargetChange`, `onDragEnd`, and their own polite live region to
  describe prospective position, drop, and cancellation.
- The standard `KeyboardDragController` does not create a live region or infer
  an accessible Item name.
- After drop, framework state reconciliation produces the final DOM order so
  reading order, focus order, and visual order agree.

## Verification and documentation

- Core input tests: composed-path owner resolution, input aliases,
  ancestor/global dispatch, `focusedObject === null`, error isolation, and
  listener cleanup.
- Type tests: discriminated narrowing, pointer-only `pointerId`/`start`/
  `pointer`, direct-only commands, `beginDirectDrag()` return type, controller
  bindings, and union-valued callback/root sessions.
- Candidate tests: exact nested DFS order, empty Containers, dragged-subtree
  pruning, final post-removal indices, all locked-adjacent slots, canonical
  insertion gaps, swap identities, and frozen candidates after live-tree
  changes.
- Policy tests: `-1` skipping with descendant traversal, one callback per
  Container per command, reevaluation on later commands, ignored positive
  magnitudes, invalid values, and no drop-time revalidation.
- Scheduling tests: immediate pending move, one in-flight move, repeated key
  requests, drop-after-settle, cancellation superseding queued drop, stale
  generation suppression, and start veto.
- Mode integration tests: all four modes use exact direct targets with no
  pointer resolution; produce equivalent callbacks/ghosts/markers/previews;
  derive one shared visual translation from the selected candidate; avoid
  mutation before drop; and preserve zero-move behavior.
- Target-first regression tests: widely different Item sizes retain the grab
  offset, insertion preview geometry is independent of its marker, and the
  derived pointer cannot change `currentTarget`.
- Input-exclusion tests: direct start versus active pointer session, pointer
  start during direct drag, mismatched pointer move/end, separate roots,
  destruction, and failed-target cleanup.
- Controller tests: row/column defaults, custom key lists, modifiers,
  composition, repeats, boundaries, exact-target protection, active
  application-started sessions, Tab cancellation, callback-slot conflicts, and
  destroy ownership.
- React/Svelte browser tests: framework-owned collection mutation, Handle
  remount registration, focus restoration after cross-Container drop/cancel,
  missing-item behavior, and no structural DOM writes by SnapSort.
- Update session/controller/reference documentation and include a simple linear
  list example plus a custom Kanban controller demonstrating Left/Right via
  `moveTo()`.

## Deferred work

- Built-in multidirectional or Kanban semantics.
- Selection UX.
- Scrolling candidates into view.
- Built-in announcements and live regions.
- Deprecated ARIA drag-state attributes.
