# @snap-engine/snapline-svelte

Svelte 5 adapters for SnapLine node graph primitives.

## Install

```bash
npm install @snap-engine/core @snap-engine/snapline \
  @snap-engine/asset-base-svelte @snap-engine/snapline-svelte
```

## Components

`Node`, `Group`, `ResizeRegion`, `Connector`, `Line`, `Select`, `Placement`,
and `ControlledGraph` are exported from the package root. Component subpaths
are also available as `Node.svelte`, `Group.svelte`, `ResizeRegion.svelte`,
`Connector.svelte`, `Line.svelte`, `Select.svelte`, `Placement.svelte`, and
`ControlledGraph.svelte`.

```svelte
<script lang="ts">
  import { Engine } from "@snap-engine/asset-base-svelte";
  import { Group, Node, Select } from "@snap-engine/snapline-svelte";
</script>

<Engine>
  <Select />
  <Group x={40} y={40} width={420} height={260} title="Pipeline" />
  <Node x={100} y={120} className="node">Process</Node>
</Engine>
```

Geometry props resynchronize after mount while active gestures update locally.
Consumer callbacks compose with the adapter's rendering callbacks.
Pass framework-native ARIA attributes or DOM event handlers to the outer node
element through `Node`'s `elementProps`.

Render explicit `ResizeRegion` children to opt into resizing. Their CSS owns
the hit area, position, cursor, hover behavior, and visuals.

Pass a child snippet to `Connector` when the input root should be custom HTML
or SVG. Apply the snippet argument as a Svelte action to exactly one element;
for an SVG path, use `pointer-events="stroke"` to make the painted stroke the
source hit area. `surfaceStrategies` customize target admission and endpoint
anchors. Application graph state remains authoritative; an opaque line payload
can link a custom renderer back to the corresponding domain edge.

Connector policy, metadata, callbacks, strategies, and collider radius are
reactive. `name` and an adopted `connectorObject` are construction-time
identities.

Full documentation: https://snapengine.dev/docs/snapline/introduction
