# @snap-engine/snapline-svelte

Svelte 5 adapters for SnapLine node graph primitives.

## Install

```bash
npm install @snap-engine/core @snap-engine/snapline \
  @snap-engine/asset-base-svelte @snap-engine/snapline-svelte
```

## Components

`Node`, `Group`, `Connector`, `Line`, `Select`, `Placement`, and `ControlledGraph` are exported
from the package root. Component subpaths are also available as
`Node.svelte`, `Group.svelte`, `Connector.svelte`, `Line.svelte`,
`Select.svelte`, `Placement.svelte`, and `ControlledGraph.svelte`.

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

`<Connector virtual>` creates a logical connector without a visible port.
Combine it with `surfaceStrategies` and symmetric `rules` limits to make a
node border or another application-defined shape act as the connection surface.
Application graph state remains authoritative; an opaque line payload can link
a custom renderer back to the corresponding domain edge.

Connector policy, metadata, callbacks, strategies, and `virtual` are reactive.
Switching `virtual` detaches or remounts only the visible port; the logical
connector and its existing lines remain intact.

Full documentation: https://snapengine.dev/docs/snapline/introduction
