# @snap-engine/snapline-react

React 18/19 adapters for SnapLine node graph primitives.

## Install

```bash
npm install react react-dom @snap-engine/core \
  @snap-engine/snapline @snap-engine/snapline-react
```

## Components

The package exports `Engine`, `Node`, `Group`, `ResizeRegion`, `Connector`,
`Line`, `Select`, `Placement`, and `ControlledGraph`. Each component is also
available from a named subpath.

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

Render explicit `ResizeRegion` children to opt into resizing. Their CSS owns
the hit area, position, cursor, hover behavior, and visuals.

Pass a render function to `Connector` when the input root should be custom
HTML or SVG. Attach its callback ref to exactly one element; for an SVG path,
use `pointerEvents="stroke"` to make the painted stroke the source hit area.
`surfaceStrategies` customize target admission and endpoint anchors. Keep
domain edges in React state and use an opaque line payload as the stable link
from a custom renderer.

Connector policy, metadata, callbacks, strategies, and collider radius stay
live across renders. `name` and an adopted `connectorObject` are
construction-time identities.

Full documentation: https://snapengine.dev/docs/snapline/introduction
