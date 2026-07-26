# @snap-engine/snapline-react

React 18/19 adapters for SnapLine node graph primitives.

## Install

```bash
npm install react react-dom @snap-engine/core \
  @snap-engine/snapline @snap-engine/snapline-react
```

## Components

The package exports `Engine`, `Node`, `Group`, `Connector`, `Line`, `Select`,
and `Placement`. Each component is also available from a named subpath.

```tsx
import { Engine, Group, Node, Select } from "@snap-engine/snapline-react";

export function Graph() {
  return (
    <Engine>
      <Select />
      <Group x={40} y={40} width={420} height={260} title="Pipeline" />
      <Node x={100} y={120} className="node">
        Process
      </Node>
    </Engine>
  );
}
```

`Node` and `Group` forward refs to their core objects. Geometry props
resynchronize after mount, and callback props remain live across renders.
Pass native ARIA attributes or DOM event handlers to the outer node element
through `Node`'s `elementProps`.

Set `virtual` on `Connector` to keep the logical endpoint without rendering a
port. `surfaceStrategies` can then hit-test and anchor against the parent
node's shape, while `capabilities` independently enable source and target
behavior. Keep domain edges in React state and use an opaque line payload as
the stable link from a custom renderer.

Connector policy, metadata, callbacks, strategies, and `virtual` stay live
across renders. Toggling `virtual` removes or remounts only the visible port;
the logical connector and existing lines are preserved.

Full documentation: https://snapengine.dev/docs/snapline/introduction
