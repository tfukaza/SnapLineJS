# @snap-engine/snapline-svelte

Svelte 5 adapters for SnapLine node graph primitives.

## Install

```bash
npm install @snap-engine/core @snap-engine/snapline \
  @snap-engine/asset-base-svelte @snap-engine/snapline-svelte
```

## Components

`Node`, `Group`, `Connector`, `Line`, `Select`, and `Placement` are exported
from the package root. Component subpaths are also available as
`Node.svelte`, `Group.svelte`, `Connector.svelte`, `Line.svelte`,
`Select.svelte`, and `Placement.svelte`.

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

Full documentation: https://snapengine.dev/docs/snapline/introduction
