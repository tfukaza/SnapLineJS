# SnapSort simplification roadmap

## Status and purpose

This is the canonical maintenance roadmap for simplifying SnapSort. It records
the current audit, approved API decisions, deferred design questions, phase
boundaries, and verification required before each phase is accepted.

The roadmap is intentionally internal and is not part of the published
SnapSort documentation. User-facing behavior and API documentation continue to
live under `docs/snapsort/` and in `assets/snapsort/README.md`.

SnapSort is being edited in parallel. Treat every finding below as a description
of the current working tree as of August 9, 2026, and recheck it at the start of
the phase that owns it. Do not overwrite unrelated or concurrent changes.

### Working agreement

- Implement one phase per commit.
- Stop for review after every phase before starting the next one.
- Stage only files owned by the current phase.
- Do not implement an API entry unless its decision status is **Approved**.
- Preserve observable behavior during internal refactors unless the phase names
  and tests an intentional behavior change.
- Prefer deterministic work-count assertions over timing benchmarks.
- Keep feature work deferred while the project-wide feature freeze is active.

## Decision filter

Every proposal must be evaluated against [`SNAPZEN.md`](SNAPZEN.md):

1. Prefer explicit primitives to inferred or magical behavior.
2. Keep one supported way to perform an operation.
3. The developer owns application data; SnapSort requests mutations through
   callbacks and never silently rewrites framework-owned collections.
4. SnapSort owns transient representation and asks the renderer to update it.
5. Prioritize maintainability, then reliability, feature coverage, browser
   support, and finally bundle size or micro-performance.
6. Do not add external runtime dependencies.

Performance alone is not sufficient justification for a more complicated data
model. Conversely, an optimization that removes duplicated work and makes the
algorithm easier to reason about is in scope once equivalence is proven.

## Compatibility and approval rules

### Decision statuses

| Status       | Meaning                                                               |
| ------------ | --------------------------------------------------------------------- |
| **Approved** | The public direction was explicitly reviewed and may be implemented.  |
| **Proposed** | Worth considering, but implementation is not authorized.              |
| **Blocked**  | Direction is partly approved, but a named design decision is missing. |
| **Rejected** | Do not implement; retain only as historical context if useful.        |

The 0.5 release may make deliberate breaking changes, but “clean break” is not
blanket authorization. Each public symbol or contract change still needs its
own decision entry.

### Public API decision register

| Proposal                                                                | Status       | Decision and constraints                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve `onItemMove`, `onItemInsert`, `onItemRemove`, and `onItemSwap` | **Approved** | These are explicit developer-owned data primitives. Do not unify or rename them in this roadmap.                                                                                                                                                                                                                                                            |
| Preserve read-only application metadata and native framework attributes | **Approved** | Metadata remains application data, not a hidden configuration channel. React and Svelte continue native event/attribute passthrough.                                                                                                                                                                                                                        |
| Remove `MutationPhase` and item-event `phase` fields                    | **Approved** | Runtime only emits `"commit"`; do not publish a speculative preview state.                                                                                                                                                                                                                                                                                  |
| Remove `callbacks.awaitMutation`                                        | **Approved** | Synchronous integration commits are the only supported mutation boundary.                                                                                                                                                                                                                                                                                   |
| Remove React `useSnapSortAwaitMutation` and its package subpath         | **Approved** | Replace its adapter-internal use with a clearly named private helper.                                                                                                                                                                                                                                                                                       |
| Remove `container.configuration`                                        | **Approved** | Retain `container.config` as the single live configuration property.                                                                                                                                                                                                                                                                                        |
| Internalize custom strategy configuration and types                     | **Approved** | Remove `ContainerConfig.strategy`, `SortStrategy`, `DropTargetStrategy`, and `DragLifecycleStrategy` from the supported surface until a composition model is intentionally designed.                                                                                                                                                                        |
| Publish a read-only `DragSession` handle                                | **Approved** | Keep the observations and controls listed in Phase 7. Hide construction, lifecycle operations, strategies, targeting state, animation maps, and ghost registries.                                                                                                                                                                                           |
| Keep Item delegates while splitting the class                           | **Approved** | Internal implementation may move, but existing methods remain during Phase 5. Any later removal needs a new per-method review.                                                                                                                                                                                                                              |
| Rename `ContainerAnimations.clickMove` to `move`                        | **Approved** | `move` is animation configuration, not an event callback, and applies to non-session/programmatic item movement regardless of what triggered it. The current `clickMove` key is unwired; remove it without an alias in the 0.5 cleanup and make `move`, rather than `reorder`, control this path.                                                           |
| Give every transient ghost a fresh item identity                        | **Approved** | Allocate a new `itemId` for each ghost that is distinct from every application Item and other live ghost in the tree/session. Never copy the source `itemId`; retain `originalItemId` as provenance, use the immutable `itemId` directly as the runtime key, and remove the conditional/prefixed `itemKey` path in Phase 11.                                |
| Rename mounted-Item registration around attachment semantics            | **Proposed** | Prefer `attachItem(item)` for registering an already-rendered object and an internal `placeItemAt(container, item, index)` primitive for indexed tree bookkeeping. Decide whether 0.5 removes `addItem` directly or retains a compatibility alias before implementation; do not literally exchange two ambiguous names.                                     |
| Move integration machinery out of `ContainerCallbacks`                  | **Blocked**  | A public advanced integration contract is approved in principle. Its exact discriminated shape, ownership scope, transaction model, and renderer responsibilities are decided in Phase 10.                                                                                                                                                                  |
| Add `onGhostMove` as the semantic ghost-relocation primitive            | **Approved** | Match the item model: insertion means an absent ghost becomes present, movement means one existing ghost changes location, and removal means it ceases to be present. A relocation emits one `onGhostMove` with concrete `from` and `to` locations, never `onGhostRemove` plus `onGhostInsert`; receiver and integration routing are finalized in Phase 10. |
| Separate insertion targeting from marker presentation                   | **Approved** | Core owns canonical gap segments, center-distance ranking, adjacent-item tie-breaking, and immutable marker state. Renderers choose line thickness and insets through explicit helper options. Presentation geometry never feeds candidate ranking, and the removed destination geometry callback has no alias.                                             |
| Add or restore `groupID`                                                | **Rejected** | The API was removed. Eligibility remains expressible through explicit metadata and `getDropPriority`; do not add a second policy mechanism during cleanup.                                                                                                                                                                                                  |

## Preserved behavioral invariants

Unless a reviewed phase says otherwise:

- Application collections change only through consumer mutation callbacks.
- React and Svelte own their rendered item and ghost DOM. Core structural DOM
  defaults remain Vanilla-only.
- Callback routing remains per container and does not bubble or inherit.
- Root lifecycle callbacks and direct-owner mutation/policy callbacks retain
  their documented receivers.
- Built-in placement modes resolve the same destinations for the same frozen
  snapshots and pointer coordinates.
- Callback order and count remain unchanged during algorithm refactors.
- Framework commits complete synchronously before SnapSort resumes geometry
  reads; this does not promise that browser paint has completed.
- Failed, cancelled, vetoed, and successful drags leave no session, hover,
  ghost, animation, or temporary style state behind.
- Public item counts describe application items and exclude transient ghosts.
- Pointer-only visual motion must not become a persistent application-data
  mutation.

## Audit findings

### Correctness and reliability

1. `Container` declares private depth and item-list fields that are never kept
   in sync with the live fields inherited from `Item`. Consequently,
   `Container.depth`, `itemList`, and `numberOfItems` do not currently represent
   the actual tree.
2. `Item` maintains both engine children and a DOM-ordered item list. A TODO in
   its movement path acknowledges that these can diverge. The invariant should
   be repaired at the mutation boundary instead of tolerated downstream.
3. Exceptional drag cleanup duplicates visual-map clearing and can write styles
   through elements that a framework has already unmounted.
4. Successful completion is repeated by the flow, insertion, and swap
   lifecycles. The copies clear the same state and construct nearly identical
   `onDragEnd` payloads, making ordering fixes easy to apply inconsistently.
5. Optional root callbacks can still enter a framework flush when no callback
   exists. React may execute two `flushSync` calls for an empty operation.
6. SnapSort has direct visual-rectangle reads spread across `Item` and the drag
   lifecycles. Most already run in READ stages, but insertion-marker relocation
   performs its before/after reads from WRITE_1 and therefore forces layout in
   the middle of a mutation path.

### Internal structure and duplication

1. `Item` combines tree ownership, input routing, drag-session construction,
   snapshots, FLIP measurement/animation, direct styles, mutation dispatch,
   and debugging in one large class.
2. Flow lifecycle restoration duplicates the helper already present in
   `drag/item-visual.ts`.
3. Mutation payloads repeatedly reconstruct the same item-run identity and
   location fields.
4. Hover dispatchers and callback-capability assertions repeat the same control
   flow for different callback keys.
5. `DragSession` updates parallel participant structures independently and
   stores several maps with identical keys and lifetimes.
6. Ghost state overlaps between a role map, flow/source runs, aliases, and a
   pending target. These are exposed because the runtime session class itself
   is exported.
7. React and Svelte repeat configuration validation, container-property
   application, Item invariants, and ghost presentation calculations.

### Algorithm and layout work

1. Flow candidate generation emits duplicate interior gaps. For `n` unlocked
   siblings it can simulate roughly `2n` candidates for only `n + 1` distinct
   slots.
2. Each flow candidate rebuilds layout inputs and recursively recomputes child
   virtual dimensions. The same subtree can be measured multiple times within
   one resolution.
3. Insertion candidate generation repeatedly searches the snapshot list,
   computes the same distance several times, and rebuilds invariant event data
   per slot.
4. Debug marker creation, sorting, and tree traversal occur on the resolution
   hot path without a single top-level “debug enabled” gate.
5. Hover resolution allocates temporary collider objects for geometry already
   represented as world-space rectangles or circles.
6. Several candidate fields and the duplicate `virtualPositions` map have no
   production consumer.
7. Moving policy evaluation ahead of geometry could save work, but would alter
   observable callback order. It is not authorized by this roadmap.

### Integration and ghost transactions

1. `ContainerCallbacks` currently mixes application events, renderer commit
   machinery, and Vanilla element creation.
2. `createGhost` has three incompatible meanings: a Vanilla element factory, a
   React notification whose return value is ignored, and an unsupported
   consumer callback in Svelte.
3. Cross-container ghost relocation currently emits removal from the old owner
   and insertion into the new owner in ordered, receiver-local commits. That
   conflates relocation with lifetime boundaries; multi-item flow relocation
   can produce `2n` callbacks and framework flushes because no ghost equivalent
   of `onItemMove` exists.
4. Pointer preview movement uses a structural ghost-insert callback and
   synchronous framework flush on repeated pointer updates even when no
   structure changes.
5. A root registry is feasible, but React cannot safely infer how to interleave
   ghosts among arbitrary JSX children, fragments, wrappers, and headers. A
   root-owned design therefore needs an explicit rendering primitive; this is
   a design decision, not a callback rename.

## Inline TODO disposition

| Existing TODO                                                        | Owning phase | Resolution                                                                                                                                                       |
| -------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `algorithm.ts`: check for an existing source-location helper         | Phase 3      | Use `Item.getIndexAndContainer()` through one shared location builder.                                                                                           |
| `mutation.ts`: introduce a shared transaction-domain coordinator     | Phases 10–11 | Keep the design here; remove the duplicate code TODO only when the approved integration contract replaces it.                                                    |
| `container.ts`: finalize the custom strategy API                     | Phase 6      | Internalize the unfinished surface instead of publishing an unreviewed composition model.                                                                        |
| `container.ts`: rename the dead `clickMove` animation key            | Phase 6      | Replace it with the approved `move` key and make that key control non-session/programmatic movement. Do not use an event-style `onMove` name or retain an alias. |
| `item.ts`: parent/list divergence “should not happen”                | Phase 2      | Restore the invariant at the mutation boundary and cover it with state tests.                                                                                    |
| `item.ts`: direct rectangle reads should use `readDom`               | Phase 5      | Move eligible SnapSort visual measurement behind one typed `readDom`-backed abstraction while preserving stage, transform, and coordinate-space semantics.       |
| Root TODO: force every layout algorithm through the collision engine | Out of scope | Do not apply literally to SnapSort hover geometry. Direct geometry is simpler here; clarify the project-wide collision task separately if its intent changes.    |
| Root TODO: clone and multi-item spawn                                | Out of scope | Valid future features, but blocked by the feature freeze and unrelated to simplification.                                                                        |

## Phased implementation

### Phase 1 — Roadmap and baseline

**Status:** Complete with this roadmap commit.

**Intent:** Establish one source of truth before changing runtime behavior.

**Changes:**

- Add this roadmap and link it from `todo.md`.
- Replace the stale split-package SnapSort review paths with the unified source
  paths.
- Add omitted `callbacks.ts`, `drag/item-visual.ts`, and
  `drag/pointer-preview.ts` review entries.
- Remove the obsolete `groupID` task.
- Replace the duplicate root ghost-transaction specification with the phase
  checklist and this canonical design record.

**Exit criteria:**

- The roadmap and root checklist agree on phase names and statuses.
- `todo.md` remains an index rather than a second specification.
- Markdown formatting and whitespace checks pass.

**Verification:**

```bash
npx prettier --check todo.md SNAPSORT_SIMPLIFICATION.md
git diff --check
```

**Commit:** `docs: add SnapSort simplification roadmap`

### Phase 2 — State correctness

**Reading order:** `container.ts` → Item tree-state/update methods → mutation
attach/detach methods → state and policy tests.

**Changes:**

- Delete the dead `Container` shadow depth/list stores.
- Derive `itemList` and `numberOfItems` from live inherited state while
  excluding ghost Items.
- Preserve live nested depth through mount, move, reorder, remove, drag
  teardown, and framework replacement.
- Repair the logical-parent/DOM-order invariant at mutation time.
- Add tests using real `Container` and `Item` instances rather than mocks.

**Preserve:** public getter names, item ordering, mutation callback routing, and
placement results.

**Required tests:**

- Nested depths and `DropPriorityEvent.depth`.
- Counts before, during, and after a drag.
- Same-container reorder, cross-container move, removal, and cancellation.
- Transient ghosts never appear in the public application-item count.
- Empty nested framework containers are registered in both engine children
  and logical order before any descendant Item mounts.

**Verification:**

```bash
npx playwright test tests/ut/snapsort-state.spec.ts --project=chromium
npm run test:snapsort
npm run check:adapters
npm run validate:packages
```

**Commit:** `fix(snapsort): restore live container state`

### Phase 3 — Safe dispatch and dead-code cleanup

**Reading order:** `container.ts` visual-invalidation scheduling →
`mutation.ts` → `events.ts` → algorithm debug helpers → lifecycle callback
call sites.

**Changes:**

- Remove the unused `GhostUpdateEvent` and no-op snapshot-debug reset helper.
- Make `fireMutation` accept only real receivers.
- Skip wrapper commits when an optional callback is absent.
- Share item-run, location, and ghost-event payload builders.
- Implement hover and capability dispatch through typed shared primitives while
  retaining named wrappers.
- Reuse the existing active-item restoration helper.
- Correct the stale `invalidateVisualGeometry` scheduling comment: stage queues
  are swapped before draining, so same-stage work is retained for the next
  frame. Keep coalesced `READ_1` delivery as the geometry-read-safe integration
  boundary.

**Preserve:** callback receiver, order, payload, error propagation, and current
commit boundary for every non-empty callback, plus the visual-invalidation
callback's stage and coalescing behavior.

**Required tests:** Add a runtime callback ledger for activation, veto,
same-owner movement, cross-owner movement, normal drop, outside cancellation,
swap, and programmatic removal.

**Verification:**

```bash
npm run test:snapsort
npm run check:adapters
npm run validate:packages
```

**Commit:** `refactor(snapsort): simplify mutation dispatch`

### Phase 4 — Session reliability

**Reading order:** `drag/session.ts` → the three lifecycle `drop()` paths →
`drag/item-visual.ts` → fail-safe tests.

**Changes:**

- Centralize successful session completion without centralizing mode-specific
  commit behavior.
- Centralize visual-state clearing for success and failure.
- Guard visual restoration when framework-owned elements have unmounted.
- Replace parallel participant assignments through one validated helper.
- Collapse duplicate `updateDropTarget` branches while retaining
  `afterSyncDropTarget` on unchanged targets.
- Extract small shared drag-visual validation/start/update/stop helpers.
- Keep swap reconciliation and session finalization exception-safe: a thrown
  `onItemSwap` callback or framework flush must still allow cleanup to run,
  retain the original error identity, and reach the existing scheduler error
  reporter exactly once rather than gaining a second call-site warning.

**Preserve:** each lifecycle's READ/WRITE stage, animation snapshot timing,
hover-leave order, `onDragEnd` timing, fail-safe cleanup behavior, the original
consumer-error identity, and the existing single reporting path.

**Required tests:** successful and exceptional completion must clear all
session/visual/hover/ghost state and allow an immediate second drag. Include
disconnected elements and mutation callback errors. Include an `onItemSwap`
error sentinel and assert that the same error is reported once while tree
reconciliation/finalization still run and an immediate second drag succeeds.

**Verification:**

```bash
npm run test:snapsort
npm run test:layout
npm run check:adapters
```

**Commit:** `refactor(snapsort): centralize drag session finalization`

### Phase 5 — Split Item responsibilities

**Reading order:** Item constructor/public accessors → simple private helpers →
snapshot/FLIP region → selection and session creation in `dragStart` → tree
reconciliation and mutation methods → adapter Item construction.

**Changes:**

- Reorganize `Item` without changing its supported surface: keep the
  constructor and simple public getters/setters together near the top, group
  straightforward private helpers by responsibility, and leave a helper beside
  a complex routine only when they are closely coupled.
- Extract FLIP state, measurement, inverse-write, and animation orchestration to
  an internal module.
- Add or consume one typed, immutable visual-rectangle snapshot with an
  explicit coordinate space, backed by SnapEngine's `ElementObject.readDom()`.
  Clone the mutable `readDom()` result immediately; do not mechanically combine
  screen-space origins with world-space dimensions when a Camera is active.
- Route every read-stage `getBoundingClientRect()` in SnapSort's animation,
  drop, and preview paths through that helper, caching repeated Item/parent
  measurements within a stage where useful.
- Reschedule insertion-marker before/after measurement into real READ stages
  before removing its two WRITE_1 rectangle reads. Never pass a fabricated
  stage argument to bypass `readDom()`'s guard, and preserve mutation callback,
  framework flush, target-change, and animation order.
- Extract `collectSelectedDragGroup`, `findGroupAnchor`, source resolution, and
  session construction into a focused internal module under `drag/`.
- Extract logical-child normalization, committed-DOM ordering, root
  reconciliation, and attach/detach/index/before-element mechanics into
  internal tree-state/tree-mutation modules. Remove the temporary symbol-keyed
  friend hook and use paired internal names that expose the call direction,
  such as `reconcileRootTreeState` and `reconcileSubtreeState`.
- Share direction-aware calculations and reorder/drop config lookup.
- Keep current Item methods as compatibility delegates.

**Preserve:** direct transformed rectangle semantics, scheduler queue IDs and
stages, selection ordering, framework ownership, and all public Item methods.
Keep engine children, sortable logical order, and committed DOM order distinct;
preserve elementless ghost slots and framework-created replacement objects.

**Required tests:** Compare first/last FLIP, insertion marker, pointer preview,
and drop rectangles before and after the helper migration, including an
interrupted transform, framework replacement, and a non-unit Camera transform.
Assert that a captured first rectangle is not mutated by the last read, that
every production geometry read runs only in its intended READ stage, and that
SnapSort production source has no direct `getBoundingClientRect()` call sites.

**Verification:**

```bash
npx playwright test tests/ut/snapsort-state.spec.ts --project=chromium
npm run test:layout
npm run test:snapsort
npm run check:adapters
```

**Commit:** `refactor(snapsort): split item responsibilities`

### Phase 6 — Approved 0.5 API pruning

**Reading order:** root/package exports → event types → container config → React
integration helper → API reference and package validation.

**Changes:**

- Remove `MutationPhase` and `phase` from item mutation events and dispatchers.
- Remove `awaitMutation` and its warning/fallback path.
- Replace React's internal use of `useSnapSortAwaitMutation` with a private,
  accurately named attachment-flush helper; remove the public export and
  package subpath.
- Remove `container.configuration` and migrate internal/tests/docs to `config`.
- Remove `ContainerConfig.strategy` and public strategy/lifecycle types; keep
  built-in strategy selection internal through `mode`.
- Replace `ContainerAnimations.clickMove` with `move`, wire it to
  destination-owned non-session `moveItem()` animation, and migrate the preset,
  demos, docs, and tests. Keep `reorder` scoped to drag/reflow displacement and
  `drop` scoped to final drag settling.
- Add compile-time export-contract assertions for every removal.

**Pending decision:** If the mounted-Item registration rename is approved,
implement `addItem` → `attachItem` in this API phase and internalize/rename the
indexed bookkeeping delegate to `placeItemAt`. Decide whether 0.5 removes the
old name directly or publishes a temporary deprecated alias before changing
the supported surface.

**Preserve:** the four item mutation callbacks, built-in modes, synchronous
framework commits, metadata, and native framework prop passthrough.

**Required test:** A programmatic `moveItem()` uses the destination's `move`
configuration and does not consult `reorder`; `clickMove` is absent from the
0.5 type/export contract.

**Verification:**

```bash
npm run validate:packages
npm run check:adapters
npm run check:website
npm run test:snapsort
npx playwright test -c tests/e2e/docs-framework-code.playwright.config.ts --grep "SnapSort callback docs"
```

**Commit:** `refactor(snapsort): trim the 0.5 compatibility API`

### Phase 7 — Read-only DragSession boundary

**Reading order:** `drag/session.ts` public fields → event types → documented
session use in demos and guides → lifecycle internal access.

**Supported public handle:**

- Read-only: `root`, `pointerId`, `items`, `sources`, `pressedItem`,
  `primaryItem`, `start`, `pointer`, and `status`.
- Controlled: `dragVisual` and `dropEffect` with their current phase validation.

**Changes:**

- Export a public handle/type rather than the lifecycle controller's complete
  runtime surface.
- Make item/source arrays and coordinate objects read-only to consumers.
- Internalize construction, `begin`, pointer/drop/finalization methods,
  strategies, cancellation flags, candidate/hover state, ghost registries, and
  animation maps.
- Update callbacks, `Container.dragSession`, docs, demos, and tests to expose
  only the handle.

`handoff(replacements)` predates the move-and-backfill copy recipe and has no
first-party use case. Preserve it only as a deprecated temporary API, then
remove it in a future release unless a concrete use case emerges.

**Verification:** API type assertions plus drag-visual, drop-effect, and
lifecycle suites for all supported phases and invalid mutations.

```bash
npm run validate:packages
npm run check:adapters
npm run test:snapsort
npm run check:website
```

**Commit:** `refactor(snapsort): expose a read-only drag session`

### Phase 8 — Candidate and debug simplification

**Reading order:** flow candidate enumeration → insertion candidate enumeration
→ policy application → hover resolution → debug rendering.

**Changes:**

- Collect eligible flow indices in insertion order and simulate every unique
  gap once.
- Precompute snapshot item indices and each insertion distance.
- Build immutable resolution event bases once per session/container.
- Split mode-specific scoring records from the minimal resolved target used by
  the session/lifecycles.
- Remove unused candidate fields and the duplicate `virtualPositions` output.
- Gate all debug-only marker/sort/tree work at the top of resolution.
- Replace temporary hover collider allocation with direct point/rect and
  squared point/circle tests using identical edge semantics.

**Preserve:** candidate eligibility, stable tie order, callback order/count,
resolved target, hover receiver, and debug output when debug is enabled.

**Required tests:**

- One candidate per eligible gap, including locked-neighbor rules.
- Golden/property equivalence for empty, flat, wrapped, nested, multi-item, and
  same-container cases.
- Deterministic counts proving `n + 1` unique flow simulations.
- Zero marker creation/tree dumping when debug is disabled.
- Exact rectangle/circle boundary behavior.

**Verification:**

```bash
npx playwright test tests/ut/snapsort-algorithm.spec.ts --project=chromium
npm run test:layout
npm run test:snapsort
```

**Commit:** `perf(snapsort): deduplicate drop candidates`

### Phase 9 — Layout-plan simplification

**Reading order:** flow layout entry assembly → recursive virtual dimensions →
slot layout → algorithm call sites.

**Changes:**

- Create one immutable per-container resolution plan with axes, content box,
  metrics, eligible children, and cached child dimensions.
- Materialize insertion rectangles from the plan instead of rebuilding the
  subtree per slot.
- Cache per-line cross starts/max sizes and replace line-by-entry rescans with
  one-pass accumulation.
- Retain separate flow and measured-slot backends; they encode different layout
  semantics and should not be merged for superficial deduplication.

**Preserve:** browser-jitter tolerances, wrapped/grid/stretch behavior,
insertion marker geometry, callback order, and all resolved targets.

**Not authorized:** evaluating drop policy before geometry. That changes
which consumer callbacks run and must receive a separate API/behavior review.

**Verification:** deterministic subtree-visit counters plus the complete layout
suite across Chromium, Firefox, and WebKit.

```bash
npm run test:layout
npm run test:snapsort
```

**Commit:** `perf(snapsort): cache virtual layout plans`

### Phase 10 — Ghost architecture design spike

**Status:** Design required; no shipping API work is authorized in this phase.

**Question:** Can SnapSort make ghosts clearly engine-owned representation,
relocate them atomically, and keep framework rendering explicit without
introducing brittle child inspection or a second collection API?

**Fixed mutation semantics:** Mirror the item mutation model without conflating
an object's lifetime with its location:

- `onGhostInsert`: the ghost was absent and is now present at one location.
- `onGhostMove`: the same existing ghost moved from one concrete location to
  another, including same-owner reindexing and cross-owner relocation.
- `onGhostRemove`: the ghost was present and is now absent.

A relocation invokes `onGhostMove` exactly once; it must not be represented as
`onGhostRemove` followed by `onGhostInsert`. `from` and `to` are therefore both
non-null on a move event. This is directly analogous to `onItemMove` being the
primary item-relocation primitive while item insertion and removal retain their
own boundary semantics.

**Compare renderer plumbing:**

1. A destination/current-owner `onGhostMove({ from, to })`, analogous to
   `onItemMove`, with explicit renderer plumbing per direct owner.
2. A root-scoped adapter registry that applies the same semantic event through
   one representation transaction with per-container subscriptions.

**Fixed identity decision:** Every ghost receives its own newly allocated
`itemId`; it never copies the source Item's `itemId`. `originalItemId` remains
the explicit provenance field. Phase 10 decides which internal integration
layer owns the allocator and how it verifies uniqueness across the active
tree/session, not whether ghosts have independent identity.

**Required decisions:**

- Exact presentation vocabulary and discriminated insert, move, and remove
  event/location types; never encode absence through a nullable location or
  magic index on a move event.
- Callback/integration receiver and whether a move invokes exactly once.
- Whether one integration object is inherited by the whole SnapSort tree or
  whether mixed transaction domains are supported.
- Public advanced integration shape and Vanilla element-factory location.
- React rendering API. A root registry cannot safely inspect arbitrary JSX, so
  evaluate an explicit `ContainerEntries`-style primitive against retaining an
  official local rendering helper.
- Svelte context registry and per-container subscription behavior.
- Multi-root isolation, portals, teardown, callback errors, and missing
  renderer behavior.
- Pointer preview mounting versus per-frame geometry updates.
- Location of the single ghost-identity allocator and its collision check
  against application Items and every other live ghost.
- How the generated identity is protected from reassignment. `Item.itemId` is
  a required construction-only getter for ordinary objects, and the internal
  ghost factory allocates its immutable identity itself.

**Research facts to preserve:** React may rerender an updated subtree but
commits only necessary DOM changes; context updates all consumers of the
changed value. Svelte supports reactive state through context. `flushSync` in
both integrations commits pending DOM updates synchronously, not browser paint.

**Exit criteria:** Write a decision-complete contract in this roadmap, mark
each affected API proposal Approved or Rejected, specify the migration, and get
explicit sign-off before Phase 11. Record the ghost-ID allocator and collision
contract, including whether an Item ID namespace is reserved and how an invalid
or colliding application ID fails.

**Commit:** `docs(snapsort): decide ghost integration architecture`

### Phase 11 — Ghost/integration migration and batching

**Status:** Blocked on Phase 10.

**Already approved constraints:**

- Separate renderer integration machinery from semantic application callbacks.
- Keep Vanilla element creation separate from framework DOM ownership.
- Preserve `onGhostInsert` and `onGhostRemove` for presence-boundary changes,
  and use one `onGhostMove` with concrete `from` and `to` locations for every
  relocation.
- Represent spacer, marker, and pointer-preview responsibilities explicitly.
- Keep ordered mutation intents; batching does not make them parallel.
- Move pointer-only geometry updates off structural framework commits.
- Allocate a fresh, stable `itemId` for every ghost instance and retain the
  source identity only in `originalItemId`.
- Use the same immutable `itemId` key path for real Items and ghosts; remove
  the synthetic key prefix and now-redundant `itemKey` helper. Retain
  `isGhost` only as the renderer discriminant.

**Provisional implementation scope, finalized by Phase 10:**

- Move overloaded `createGhost` renderer construction into the approved
  integration surface. Retain semantic `onGhostInsert`/`onGhostRemove` and add
  `onGhostMove` as the primary relocation callback.
- Route absent-to-present placement through `onGhostInsert`, location changes
  through exactly one `onGhostMove`, and present-to-absent teardown through
  `onGhostRemove`. Never synthesize one relocation as a remove/insert pair.
- Allocate ghost identity once at creation through the approved integration
  layer; preserve it across relocation and expose it consistently as
  `ghostItemId`.
- Use `ghostItemId` directly as the framework renderer key; remove adapter and
  documentation examples that synthesize keys from `ghostItem.id` or prepend a
  second manual `ghost:` prefix.
- Migrate complete multi-item ghost runs, insertion markers, flow spacers, and
  swap pointer previews.
- Apply both sides of a cross-owner `onGhostMove` inside one synchronous
  representation transaction where the approved ownership domain permits it.
  Preview removal plus item commit remain two ordered semantic operations, but
  may share one framework transaction when their commit domain permits it.
- Preserve a documented safe fallback or reject incompatible mixed domains,
  according to the Phase 10 decision.
- Keep exactly one bound ghost element throughout each committed relocation.
- Update Vanilla, React, Svelte, demos, API reference, lifecycle guide, and
  lifecycle diagram in the same phase.

**Required tests:**

- Initial placement emits one `onGhostInsert`; same-owner and cross-owner
  relocation each emit one `onGhostMove` and no remove/insert callbacks; final
  teardown emits one `onGhostRemove`.
- Multi-item runs and exact callback/transaction count.
- React and Svelte parity for nested/sibling containers and independent roots.
- No intermediate duplicate/stale ghost after success, cancellation, or error.
- Pointer motion mounts structurally once and avoids repeated structural
  framework commits.
- A failed transaction fully cleans up and the next drag succeeds.
- A ghost ID differs from its source ID, remains stable across relocation, and
  never collides with an application Item or another simultaneous source,
  target, marker, pointer, or multi-item-run ghost.
- The collision policy is deterministic even when an application ID resembles
  an engine-generated object counter, and snapshot/animation lookup still
  rebinds framework-replaced real Items by stable `itemId`.
- Create, insert, relocate, and remove events expose the same ghost ID, and the
  approved protection either rejects reassignment or prevents it from changing
  that event identity.

**Verification:**

```bash
npm run test:snapsort
npm run test:snapsort-react
npm run test:snapsort-svelte
npm run test:snapsort-examples
npm run check:adapters
npm run check:website
npx playwright test -c tests/e2e/docs-framework-code.playwright.config.ts
```

**Commit:** `refactor(snapsort): unify ghost transactions`

### Approved insertion targeting and renderer geometry

**Status:** Implemented; this contract supersedes the earlier insertion-marker
geometry callback design.

**Targeting contract:**

- Insertion candidates are canonical zero-thickness gaps between retained
  items. Rank Euclidean distance from the pointer to the gap center, not
  distance to an Item or a rendered ghost.
- When candidates have the same score and exact center, compare the virtual
  dragged Item's leading cross-axis edge with the leading edges of their
  adjacent frozen Item rectangles. The virtual rectangle preserves the
  pointer-to-item offset captured at drag start. Preserve stable tree traversal
  order for any remaining tie, including candidates without neighbors. Do not
  introduce a depth bonus or an arbitrary pixel bias.
- Non-swap placement hover considers the resolved Container's direct children
  and the resolved Container itself when nested. Resolve every hitbox and
  callback through the hovered Item's actual direct owner; prefer smaller
  hitboxes and direct children on equal-area ties. Root self-hover is invalid.
  Swap hover/target resolution and direct `findHoveredItem` calls remain
  direct-child-only.
- Nested inside/outside choice follows real layout geometry. A file-explorer
  child Container should be physically inset so its gap center moves right;
  painted indentation over a full-width Container is insufficient.
- Wrapped rows and columns use the chosen visual line's measured cross-axis
  band. A wrapping boundary uses the next line's leading edge and band; append
  uses the previous line's trailing edge and band.

**State and rendering contract:**

- `InsertionMarkerState` carries the canonical world-space `gap`, frozen
  `previous`/`next` neighbors, `isCurrentPlacement`, ghost identity, and slot
  location. The framework receives renderer-ready facts without receiving a
  renderer-chosen rectangle.
- A gap, neighbor, or `isCurrentPlacement` change at the same
  container/index emits `onGhostMove`. `onDropTargetChange` remains a semantic
  destination-location notification and is not overloaded with presentation.
- `insertionMarkerRect(marker, options)` requires explicit `thickness`,
  `startInset`, and `endInset` values. All are finite and non-negative; inset
  totals greater than the canonical gap length throw instead of clamping.
  The named `stockInsertionMarkerRectOptions` (`3/0/0`) is a built-in renderer
  contract, not an implicit helper default.
- `toContainerLocalRect` is the general projection helper for arbitrary
  world-space overlays. It projects from the destination padding-box outer
  edge using border widths and live scroll, does not subtract padding, and
  requires a mounted Container. `insertionMarkerRect` composes this helper.
- Svelte and React `Ghost` accept the explicit marker options at the render
  site. `createVanillaAdapter({ insertionMarker: options })` exposes the same
  choice; omitting it intentionally selects the named stock renderer contract.
  Marker thickness and insets affect presentation only.

**Acceptance coverage:**

- Flat, empty, nested, same-placement, cross-container, and multi-item gaps.
- Horizontal and vertical virtual-leading-edge tie-breaking, grab-offset
  preservation, neighborless fallback, and final stable-order ties.
- Nested destination self-hover, direct-child specificity, and actual-owner
  hitbox/callback routing without changing swap target resolution.
- Wrapped row/column boundaries, including next-line leading and append
  trailing bands.
- Same-location marker moves when geometry or current-placement state changes.
- Horizontal/vertical rectangle projection with borders, live scroll, and
  zero/positive insets; invalid numeric input, excessive insets, and unmounted
  destinations fail explicitly.
- Vanilla stock/custom rendering and React/Svelte explicit custom rendering.

**Commit:** `feat(snapsort): expose canonical insertion marker state`

## Final milestone gate

After all approved phases:

```bash
npm run ci
npm run test:snapsort
npm run test:layout
npm run test:snapsort-examples
npx playwright test -c tests/e2e/docs-framework-code.playwright.config.ts
```

`npm run ci` does not run the Playwright suites, so it is necessary but not
sufficient. Ghost batching is not considered proven until equivalent React and
Svelte coverage exists.

## Explicitly out of scope

- New drag features, clone/spawn behavior, and multi-item copy expansion.
- Reintroducing `groupID`.
- A public custom strategy composition API.
- Redesigning the four item mutation callbacks.
- Removing Item delegates before a separate per-method API review.
- Replacing `Container extends Item` or the complete engine child model in one
  refactor.
- Reordering consumer policy/geometry callbacks for performance.
- Treating framework commit completion as browser reflow, repaint, or
  compositor completion.
