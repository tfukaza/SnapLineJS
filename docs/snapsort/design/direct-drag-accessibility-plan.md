# SnapSort Programmable Direct-Drag and Keyboard Accessibility

## Summary

Add an input-agnostic direct-drag session that lets applications program a live
gesture through `moveNext()`, `movePrevious()`, `moveTo()`, `drop()`, and
`cancel()`. Direct movement bypasses pointer hit-testing and ranking while
preserving SnapSort's existing lifecycle, policy checks, callbacks, visuals,
adapters, and final mutations.

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
type DragSession = PointerDragSession | DirectDragSession;

interface BaseDragSession {
  readonly inputType: "pointer" | "direct";
  readonly root: Container;
  readonly items: readonly Item[];
  readonly sources: readonly DragLocation[];
  readonly pressedItem: Item;
  readonly primaryItem: Item;
  readonly start: Readonly<{ x: number; y: number }>;
  readonly pointer: Readonly<{ x: number; y: number }>;
  readonly status: DragSessionStatus;
  dragVisual: DragVisual;
  dropEffect: DropEffect;
}

interface PointerDragSession extends BaseDragSession {
  readonly inputType: "pointer";
  readonly pointerId: number;
  handoff(replacements: readonly Item[]): void;
}

interface DirectDragSession extends BaseDragSession {
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
Item.beginDirectDrag(): DirectDragSession | null;
```

- This is intentionally a clean discriminated union. Existing callers must
  narrow on `inputType` before using `pointerId` or `handoff()`.
- `root.dragSession` and callback session fields expose the union.
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

## Direct-session implementation

### Frozen candidates and indices

Build a pure structural candidate snapshot when direct drag begins, using the
reconciled tree and cached geometry. The public array remains frozen for the
session and includes structurally valid candidates even when current drop
policy rejects them.

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

- Traverse non-participant Items, including nested Containers-as-Items, in
  depth-first preorder.
- A candidate location identifies the target Item at its frozen parent/index;
  empty Containers provide no target.
- Retain the target Item identity internally and re-resolve it before commit.
- Passing the dragged Item's own swap position is a no-op returning `false`.

Before the first accepted movement, `currentTarget` is `null`. Maintain a
private cursor at the initiating Item's projected source slot; if a selected
ancestor is the actual participant, anchor at that nearest participant instead.

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
- A successful move immediately updates `currentTarget` and the virtual
  `pointer`, then schedules lifecycle synchronization.
- Return `false` at traversal boundaries, for the same destination, policy
  rejection, an inactive or terminal session, or while another move is
  settling.
- A move called while start is pending is accepted immediately using the frozen
  cached layout, updates `currentTarget`, and is applied after activation. If
  the later scheduled `onDragStart` vetoes the session, discard that command
  and end normally.

### Shared lifecycle and visual state

Refactor pointer placement so target resolution and target application are
separate:

- Pointer sessions run hit-testing/ranking, then pass the resolved target to a
  shared placement method.
- Direct sessions pass their exact logical target to that method without
  invoking pointer algorithms.
- The shared path remains responsible for placement conversion, hover state,
  ghosts, markers, `onDropTargetChange`, visual invalidation, and mode
  lifecycle callbacks.

Use the existing candidate-layout geometry to derive the direct virtual
pointer:

- Flow modes use the exact candidate's projected placement anchor.
- Insertion uses the canonical marker/gap midpoint.
- Swap uses the target Item's frozen center.

Initialize `start` at the pressed/group-anchor Item's visual center. Moving the
virtual pointer must move an Item or preview visual exactly as the equivalent
resolved pointer placement would.

Flow modes create their source spacer during activation. Insertion and swap
show no pending marker or highlight before the first accepted move.

### Scheduling, terminal commands, and cleanup

- Permit one accepted move at a time. Keep the session busy until its callbacks,
  adapter reconciliation, and transient visual synchronization settle; later
  requests return `false` and are not queued.
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
- Pointer move/end handlers require `inputType === "pointer"` and the matching
  `pointerId`.
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
  `root.event.input.keyDown` slot, then installs its callback. It throws on
  conflicts.
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
- Previous/next use the initiating source Container's direction before the
  first move and `currentTarget.container.direction` afterward.
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
  unprevented so browser focus navigation continues.
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

## Verification and documentation

- Core input tests: composed-path owner resolution, input aliases,
  ancestor/global dispatch, `focusedObject === null`, error isolation, and
  listener cleanup.
- Type tests: discriminated narrowing, pointer-only members, direct-only
  commands, `beginDirectDrag()` return type, controller bindings, and
  union-valued callback/root sessions.
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
- Mode integration tests: all four modes use the shared placement lifecycle,
  produce equivalent callbacks/ghosts/markers/previews, avoid mutation before
  drop, and preserve zero-move behavior.
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
- Announcements and live regions.
- Deprecated ARIA drag-state attributes.
