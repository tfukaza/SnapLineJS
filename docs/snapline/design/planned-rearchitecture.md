---
title: SnapLine planned re-architecture
description: Internal design doc — closed-out decision record for the re-architecture.
hidden: true
---

# SnapLine planned re-architecture

Status: complete — retained as the decision record for the re-architecture.  
Started: 2026-07-25  
Related:
[current architecture](./current-architecture.md) ·
[ownership specification](./ownership-specification.md) ·
[migration notes](./migration-notes.md)

This document is a delta from the current implementation and contains only
work that has not landed. Everything previously specified here — the
vocabulary and `*Mirror` renames, stable domain identity, the `GraphRegistry`
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
   `onGeometryCommit` observation replaces `onDragCommit` +
   `onResizeCommit`.

## Status: complete

The final simplification review has landed: the gesture and record admission
checks share one structural check plus one predicate check, the settle path's
redundant eviction block and the reconciler's unused local-topology notify
forwarding are gone, remaining single-class `_`-prefixed fields moved to `#`
privates (with `_connectors` documented as the one deliberate cross-class
field), and an informational perf benchmark
(`tests/ut/snapline-perf.spec.ts`) guards the reconcile / candidate-discovery
/ bulk-load hot paths. The complete verification matrix — unit suites, all
six SnapLine e2e suites, package validation, and the docs e2e — passes.

This document is retained as the record of the re-architecture's decisions
and amendments; the implementation is described in
[current architecture](./current-architecture.md).
