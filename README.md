<img src="./docs/assets/images/banner.png" alt="SnapEngine" width="100%" />

> [!WARNING]
> The engine is still in early stages of development. Expect frequent updates and breaking changes.

# SnapEngine: Interactivity Engine for the Web

SnapEngine is the shared, DOM-first foundation behind a growing family of
interaction tools for the web. It provides:

- Input handling with a common API for mouse and touch events.
- Collision detection for basic shapes and lines.
- Helpers for batching DOM updates.
- Camera and world coordinate translation for pan-and-zoom interfaces.
- A built-in WAAPI-based animation engine.
- A visual debugger for inspecting engine internals.
- Zero-dependency, framework-agnostic APIs.

Most application developers should start with
[SnapSort](https://snapengine.dev/docs/snapsort/introduction), an
unstyled drag-and-drop toolkit built on SnapEngine. See the
[website](https://snapengine.dev) to explore the ecosystem.

## Using SnapEngine Core directly

Install Core directly when authoring an interaction tool or asset, or when an
application needs advanced custom behavior at the engine level.

```bash
npm install @snap-engine/core
```

## Core example

```ts
import { Engine, ElementObject } from "@snap-engine/core";

const engine = new Engine();
engine.assignDom(document.getElementById("container") as HTMLElement);

const object = new ElementObject(engine, null);
object.element = document.getElementById("item");

object.schedule(() => {
  object.worldPosition = [100, 200];
  object.writeTransform();
}, { stage: "WRITE_1" });
```

## License

MIT
