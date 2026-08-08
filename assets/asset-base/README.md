# @snap-engine/asset-base

Shared foundational assets for SnapEngine, including Svelte and React bindings.

## Install

```bash
npm install @snap-engine/asset-base
```

The package root is framework-neutral. Framework applications import bindings
from `@snap-engine/asset-base/svelte` or `@snap-engine/asset-base/react`.

## Core and Vanilla

- `CameraControl`
- `Background`

## Usage

```ts
import { CameraControl, Background } from "@snap-engine/asset-base";
```

The existing `@snap-engine/asset-base/camera` and
`@snap-engine/asset-base/background` deep imports remain available.

## Svelte

```bash
npm install @snap-engine/asset-base svelte
```

```svelte
<script lang="ts">
  import { Background, Camera, Engine } from "@snap-engine/asset-base/svelte";
</script>
```

Component imports such as `@snap-engine/asset-base/svelte/Engine.svelte` and
the legacy keyed utilities at `@snap-engine/asset-base/svelte/engine` are also
supported.

## React

```bash
npm install @snap-engine/asset-base react react-dom
```

```tsx
import { Background, Camera, Engine } from "@snap-engine/asset-base/react";
```

Component imports such as `@snap-engine/asset-base/react/Engine` remain
supported. React and Svelte are optional peers, so consumers of the package
root do not need to install either framework.

## Upgrading to 0.5

Asset Base 0.5 replaces the separate framework packages with subpath bindings:

| Before                           | Asset Base 0.5                   |
| -------------------------------- | -------------------------------- |
| `@snap-engine/asset-base-svelte` | `@snap-engine/asset-base/svelte` |
| `@snap-engine/asset-base-react`  | `@snap-engine/asset-base/react`  |

Remove the old adapter packages and install `@snap-engine/asset-base` instead.
Version 0.5 does not include compatibility shims for the retired names.
