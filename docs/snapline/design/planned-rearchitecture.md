# SnapLine planned re-architecture

Status: living planning document — **implementation complete through the
adapter/consumer phases**; only the final simplification review remains.  
Started: 2026-07-25  
Related:
[current architecture](./current-architecture.md) ·
[ownership specification](./ownership-specification.md) ·
[migration notes](./migration-notes.md)

This document is a delta from the current implementation and contains only
work that has not landed. Everything previously specified here — the
vocabulary and `*Mirror` renames, stable domain identity, the `GraphMirror`
registry, engine scoping, `ConnectorRules`, the controlled line protocol
(`attachControlledGraph` / `setCanonicalGraph` / `onLineChangeRequest`),
batching, diagnostics, the `ControlledGraph` adapters, property-propagation
removal, the geometry consolidation, identity props, stable line keying, and
the package export alignment — is implemented and verified; it is described
in [current architecture](./current-architecture.md) and, for upgraders, in
[migration notes](./migration-notes.md).

## Amendments adopted during implementation

Two decisions were amended from the original plan (both user-directed):

1. **The uncontrolled graph mode was eliminated entirely.** Topology —
   which nodes, connectors, and lines exist — is always controlled: the
   application document is the single source of truth, and the imperative
   public topology commands were removed rather than gated. Future
   vanilla-JS support is a pure-JS graph-owner module driving the same
   `attachControlledGraph`/`setCanonicalGraph` contract (a mini emulated
   framework), so the core stays common across frameworks.
2. **Geometry authority modes were dropped.** Position and size are visual
   cues owned by SnapLine; there is no controlled-geometry variant and no
   `onGeometryChangeRequest`. D8 reduced to the consolidation: one batched
   `onGeometryChanged` observation replaces `onDragCommit` +
   `onResizeCommit`.

## Final phase: post-rearchitecture simplification review

After the re-architecture has settled, review the result as a new codebase
rather than assuming every intermediate abstraction must survive. This phase
may simplify aggressively, but must preserve the ownership model, public
behavior, and verified performance.

### Review method

- Trace every major lifecycle (connect, reconnect, disconnect, hydration,
  bulk load, selection, teardown) from public entry point to final state.
- Remove redundant adapters, forwarding callbacks, snapshots, indexes,
  schedulers, wrappers, and migration-only internals.
- Known consolidation candidates from the migration itself:
  - unify the gesture admission check with the strict record admission
    check (`#admitsConnection` / `#admitsRecordEndpoints`);
  - the settle path's replacement-eviction block should be dead now that
    accepted replaces prune first — verify and remove;
  - the reconciler slot's local-topology notify forwarding
    (`notifyConnect`/`notifyDisconnect`) has no consumer — drop it from the
    emit sites if nothing needs it;
  - evaluate whether `pendingGestureRequest` still earns its keep;
  - remaining `_`-prefixed cross-class fields → `#` or documented
    internals; delete `_endLineDragCleanup` if unused;
  - a shared adapter callback-merge helper to replace the duplicated
    monkey-patch blocks in the four Node/Group adapters.
- Profile before retaining or adding non-obvious optimization: an
  informational (non-asserting) unit benchmark over a ~200-node/300-line
  synthetic graph timing the reconcile pass, per-pointer-move candidate
  discovery, and a bulk load.
- Repeat the vocabulary audit: one concept, one name; `on*` for
  observations/requests, `is*`/`can*` for predicates.
- Finish with the complete verification matrix: all SnapLine unit and e2e
  suites, `validate:packages`, the docs e2e, and the lab consumer checks.

### Exit criteria

- Each major lifecycle has one obvious path through the code.
- No layer, registry, callback, or snapshot merely duplicates another.
- Public APIs expose the smallest surface the ownership model requires.
- All tests, type checks, adapter suites, browser tests, and relevant
  benchmarks pass after the simplification.

## Remaining task board

- [ ] Trace every major lifecycle through the completed architecture.
- [ ] Apply the consolidation candidates above (verify each is truly
      redundant before removing).
- [ ] Add the informational profiling benchmark.
- [ ] Repeat the naming and public-surface audits.
- [ ] Run the complete verification matrix again.
