# The Zen of SnapEngine

- Explicit verbosity over magic abstractions.
- Expose the primitives; let developers combine them.
- There should only be one way to do something.
- There are no such thing as sensible defaults.

- The developer owns the data. Never silently modify it.
- When data must change, ask the developer for permission.
- The engine owns the representation.
- When representation must change due to data mutation, request the engine to update.

- No external dependencies.
- Prioritize code maintainability, reliability, feature set, browser support, bundle size, in that order.
