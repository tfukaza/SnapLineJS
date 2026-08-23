---
title: SnapEngine SSR hydration plan
hidden: true
---

# SnapEngine SSR hydration plan

Status: planned
Created: 2026-08-22

## Summary

Add an opt-in SSR lifecycle in which `new Engine({ ssr: true })` is safe when
`window` and `document` do not exist. An SSR Engine stores configuration but
does not create input handlers, register a frame loop, measure elements, or
perform any other browser work until client code assigns its container and
calls the engine-wide `hydrate()` method.

The first milestone covers Core and the Svelte `<Engine>` boundary with plain
children. Camera, Background, SnapSort, SnapLine, and other object mirrors stay
client-only until later milestones.

`Engine.hydrate()` owns only Core browser resources. Framework and asset
components must defer their own mirrors until the Engine is hydrated instead
of moving package-specific behavior into Core.

## Public contract

### Core Engine

```ts
const engine = new Engine({ ssr: true });

engine.setCollisionEngine(new CollisionEngine());
engine.enableAnimationEngine();
engine.setDebugRenderer(new DebugRenderer()); // Queued while inert.

engine.assignDom(container); // Records the container while inert.
engine.hydrate(); // Activates the complete client runtime.

engine.hydrated; // Read-only lifecycle state.
```

- Add immutable `EngineConfig.ssr?: boolean`, defaulting to `false`.
- Add a read-only `engine.hydrated` property.
  - A normal Engine activates eagerly and reports `true`.
  - An SSR Engine reports `false` until hydration succeeds.
- Add an idempotent `engine.hydrate()` method.
  - Repeated calls are no-ops.
  - Calling it on an ordinary, already-active Engine is a no-op.
  - Calling it without an assigned container, outside a browser, or after
    destruction throws a specific lifecycle error.
- Do not allow `engineConfig` changes to toggle SSR mode after construction.

### Svelte Engine

```svelte
<Engine
  ssr
  animation={true}
  collision={true}
  debug={false}
  bind:engine
>
  <div>Server-rendered application content</div>
</Engine>
```

- `ssr` defaults to `false`.
- `animation` and `collision` default to `true`.
- The feature props are enable-only initialization options. `false` skips
  wrapper setup but does not remove a feature already installed on an injected
  Engine.
- An injected Engine's SSR configuration must match the component's `ssr`
  prop. Report a mismatch with an actionable error.

## Browser dependency inventory

| Milestone | Subsystem | Browser-dependent work |
| --- | --- | --- |
| 1 | Core Engine | Input construction, global frame-loop registration, container measurement, resize and scroll observers, camera DOM assignment, and debug canvas attachment |
| 1 | Svelte Engine | Engine creation during SSR, client DOM assignment, manual hydration, and feature configuration |
| 2 | Core objects | `ElementObject` registration and observers, DOM reads and writes, camera measurement, computed styles, and Web Animations API objects |
| 2 | Asset Base | Svelte and React Camera and Background mirrors, element binding, and edge-pan animation frames |
| 3 | SnapSort | Container, Item, Handle, and Ghost mirrors; FLIP animation; vanilla ghost creation and structural DOM mutations |
| 4 | SnapLine | Node, Group, Connector, Line, ResizeRegion, Select, and ControlledGraph mirrors; Placement window listeners and post-measurement lines |

Collision geometry and collision-engine configuration do not directly depend
on the DOM. Animation-engine configuration is also safe while inert, but
constructing an actual animation remains browser-only.

## Milestone 1: Core lifecycle

### Inert construction

When `ssr` is `true`, the Engine constructor must not:

- instantiate `InputControl` or read the global `document`;
- obtain or register with `GlobalManager`;
- start `requestAnimationFrame`;
- create a camera or bind a camera container;
- measure DOM bounds or create observers and listeners.

Keep the internal GlobalManager and InputControl references nullable until
hydration. Direct input access and construction of a `BaseObject` or
`ElementObject` before hydration must throw an explicit "Engine is not
hydrated" error rather than leaking a `ReferenceError` from a browser global.
DOM reads, DOM writes, and Web Animation construction follow the same rule.

Default `new Engine()` behavior stays eager. When used outside a browser, it
should throw a clear error that directs the developer to
`new Engine({ ssr: true })`.

### Deferred configuration

- `assignDom()` and the `element` setter only store the container while an SSR
  Engine is inert. They must not measure it, bind input, create observers, add
  listeners, assign camera DOM, or publish container events.
- `setCollisionEngine()` and `enableAnimationEngine()` remain safe because
  they only store state and processors.
- `setDebugRenderer()` stores the first renderer requested while inert without
  creating a canvas. This preserves the existing first-enable-wins behavior.
- `disableDebug()` clears either a queued renderer or an active renderer.

### Hydration sequence

`hydrate()` performs one atomic transition:

1. Validate that the Engine is not destroyed, browser globals exist, and a
   container has been assigned.
2. Obtain `GlobalManager` and construct `InputControl`.
3. Create or bind the stationary camera, measure the container, bind input,
   and install resize and scroll observation.
4. Register the Engine and start the shared frame loop.
5. Attach a queued debug renderer and publish `containerAssigned`.
6. Mark the Engine hydrated only after activation succeeds.

If activation fails, remove resources created by that attempt and leave the
Engine inert so the caller can retry. After hydration, `assignDom()` resumes
its existing eager rebind behavior.

`destroy()` must be safe both before and after hydration. It clears queued
configuration and container references while inert, performs the existing
browser cleanup when active, and prevents later hydration.

## Milestone 1: Svelte boundary

When `<Engine ssr>` renders:

- Create or accept an inert Core Engine during both server and client
  component initialization.
- Install the selected collision and animation features without activating a
  browser runtime.
- Put the inert Engine in Svelte context.
- Render the Engine container and plain application children during SSR.
- On client mount, call `assignDom()` but do not call `hydrate()`.
- Leave activation to application code through the bound Core Engine.
- Queue the existing `debug` prop in Core so its canvas attaches during
  hydration. Later debug changes use the normal active behavior.
- Preserve ownership cleanup even if the component is destroyed before it is
  hydrated.

Example manual activation:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as CoreEngine } from "@snap-engine/core";

  let engine: CoreEngine | null = null;

  onMount(() => {
    engine?.hydrate();
  });
</script>

<Engine ssr bind:engine>
  <main>SSR content</main>
</Engine>
```

For compatibility, `<Engine ssr={false}>` retains the current eager client
behavior and delayed child rendering. Camera and Background inside
`<Engine ssr>` are not supported in this milestone; they must fail with the
explicit not-hydrated error rather than a browser-global crash.

## Later milestones

### Milestone 2: Core objects and Asset Base

- Introduce a shared "run now or after `containerAssigned`" lifecycle helper.
- Create Camera and Background mirrors only after hydration while preserving
  their server-rendered markup.
- Apply the same lifecycle to the React Asset Base adapters.

The existing `hydrated` getter handles components mounted after activation;
the existing `containerAssigned` event wakes components that mounted while the
Engine was inert.

### Milestone 3: SnapSort

- Move framework Container, Item, and Handle mirror creation into hydrated
  mount/effect lifecycles.
- Keep Ghost creation limited to an active client drag session.
- Keep framework state as the only owner of rendered collections.
- Restrict vanilla structural DOM callbacks, ghost elements, and FLIP
  animations to the active browser runtime.

### Milestone 4: SnapLine

- Progressively create Node, Group, Connector, ResizeRegion, and Select mirrors
  after hydration.
- Keep graph contexts nullable and reactive until mirrors exist.
- Attach ControlledGraph on the client.
- Omit canonical and preview lines until the first client measurement.
- Install Placement window listeners only in the active client lifecycle.

## Verification

### Core SSR tests

- Import Core and construct `new Engine({ ssr: true })` with no `window` or
  `document`.
- Configure collision, animation, and debug without touching browser globals.
- Confirm `global` is absent and `hydrated` is `false` before activation.
- Confirm `assignDom()` performs no measurement, listener, observer, camera,
  event, or frame-loop work while inert.
- Confirm pre-hydration object construction, input access, DOM operations, and
  animation construction produce the intended lifecycle error.
- Confirm destroying an inert Engine is safe.
- Confirm eager construction outside a browser gives the actionable SSR-mode
  error.

### Browser lifecycle tests

- Confirm hydration installs input, camera, observers, frame processing,
  collision, animation, and queued debug exactly once.
- Confirm `disableDebug()` before hydration prevents canvas creation.
- Cover missing-container hydration, repeated hydration, failed hydration and
  retry, post-hydration container reassignment, normal destruction, and
  hydration after destruction.

### Svelte integration tests

- Server-render `<Engine ssr>` with no browser globals and assert that its
  container and plain children appear in the output.
- Hydrate the Svelte output without a markup mismatch.
- Confirm the client Engine remains inert after mount until application code
  calls `engine.hydrate()`.
- Cover owned and injected Engines, feature defaults and opt-outs, queued
  debug, and mismatched SSR configuration.
- Preserve the existing non-SSR Svelte Engine behavior.

Run the focused lifecycle suites followed by:

```bash
npm run typecheck
npm run check:adapters
npm run check:website
npm run build
```
