---
title: SnapLine NodeGraph composition decision record
hidden: true
---

# SnapLine NodeGraph composition decision record

Status: working design record — latest decisions are recorded first; implementation has not started  
Recorded: 2026-08-15  
Related:
[current architecture](./current-architecture.md) ·
[ownership specification](./ownership-specification.md) ·
[migration notes](./migration-notes.md)

This document records the decisions made while designing the next SnapLine
framework API. It is intentionally separate from the current-architecture
document: everything here is proposed until implementation and verification
land.

The SSR section is especially important to read with its status label.
SnapEngine as a whole is not SSR-ready, so full graph SSR is an aspirational
direction, not an acceptance requirement for the first NodeGraph phase.

## Current decisions — supersedes conflicting exploration below

This section records the latest design discussion. Where it conflicts with a
later section in this file, this section wins. The older material remains for
now as design history and will be rewritten or removed when the API is turned
into an implementation plan.

### Reference projects are use-case fixtures

Painterly Sandbox, Interview Prep, and other applications are references for
behaviors that SnapLine should be capable of expressing. Their current stores,
record schemas, callbacks, component boundaries, and imperative APIs are not
compatibility requirements.

SnapLine should choose one coherent API according to SNAPZEN ownership rules.
Reference applications should be migrated to that API when necessary. The
behaviors extracted from them become acceptance cases, including:

- atomic replacement of an occupied connection;
- dynamic connectors inside sortable content;
- graph persistence, load, undo, and redo;
- whole-node or perimeter connector surfaces;
- custom line visuals with hit targets and labels;
- deterministic initial geometry and eventual SSR hydration.

Do not add alternate mutation paths, reconciliation modes, or compatibility
shapes merely to preserve how a reference application currently works.

### One topology gateway with named operations

Framework arrays provide the initial graph. After activation, every topology
change goes through a named `NodeGraph` command. The command invokes the
corresponding named callback, the callback synchronously updates framework
state and returns an explicit decision, and SnapLine reconciles to that
decision.

This applies to gestures, application commands, load, collaboration, undo,
and redo. Applications do not mutate topology behind SnapLine and then ask it
to discover the change.

The public API does not use a generic `GraphChange` union, `applyGraphChange`,
or one multiplexed `decide()` callback. The semantic callback families are:

```ts
interface NodeGraphCallbacks<TNode, TConnector, TLine> {
  onNodeInsert?: NodeInsertCallback<TNode>;
  onNodeRemove?: NodeRemoveCallback<TNode, TConnector, TLine>;

  onConnectorInsert?: ConnectorInsertCallback<TConnector>;
  onConnectorRemove?: ConnectorRemoveCallback<TConnector, TLine>;
  onConnectorReparent?: ConnectorReparentCallback<TConnector>;

  onLineInsert?: LineInsertCallback<TLine>;
  onLineConnect?: LineConnectCallback<TLine>;
  onLineRemove?: LineRemoveCallback<TLine>;

  onGraphRestore?: GraphRestoreCallback<TNode, TConnector, TLine>;
  flushMutation?: (mutation: () => void) => void;
}
```

The exact generic spelling is not final. The accepted behavior is:

- a node removal includes its connectors and incident lines in one atomic
  decision;
- a connector removal includes its incident lines in one atomic decision;
- connector reorder within the same logical node is geometry/layout work, not
  topology;
- connector reparenting is topology;
- a line connection includes every line displaced by capacity policy, so an
  occupied-target replacement is one callback, one framework update, and one
  history operation;
- adapters provide the synchronous framework flush boundary;
- an opt-in `defaultCallbacks(...)` quickstart is composed from exported pure
  reducers.

### There is no public preview-line concept

A line being drawn is not a different entity or a separate presentation
record. Every rendered line uses the same runtime entry and the same framework
component:

```ts
interface GraphLineEntry<TData = unknown> {
  id: LineId;
  sourceConnectorId: ConnectorId;

  // Null only while a newly created line is following the pointer.
  targetConnectorId: ConnectorId | null;

  data: TData;
  mirror: LineMirror | null;

  // Null means that SSR must omit the line until geometry is available.
  initialGeometry: LineGeometrySnapshot | null;
}
```

The runtime collection does not expose `isPreview`, `draft`, a preview union,
`LinePresentationInsert`, `LinePresentationRemove`, `renderableLines`, or a
separate preview collection. SnapLine may still keep private gesture state
such as `creating`, `reconnecting`, or `over-target`; private engine state does
not become framework topology.

New-line gesture lifecycle:

```text
pointer threshold
    -> create one line with targetConnectorId: null
    -> onLineInsert asks the framework to render that line
    -> pointer movement writes geometry through the retained LineMirror
    -> successful release calls onLineConnect
    -> unsuccessful release calls onLineRemove
```

An accepted connection retains the same line ID, mirror, keyed component, and
DOM element. SnapLine never replaces an incomplete line with a second
"canonical" line.

Reconnect lifecycle:

- the canonical endpoints remain unchanged while the mirror follows the
  pointer;
- successful release calls `onLineConnect` with previous endpoints, next
  endpoints, and any displaced lines;
- releasing unconnected calls `onLineRemove` when the interaction semantics
  mean disconnect/delete;
- canceling restores the mirror to the unchanged endpoints without a topology
  callback.

The working event shape is:

```ts
interface LineConnectEvent<TLine> {
  line: TLine;
  previousEndpoints: LineEndpoints | null;
  nextEndpoints: LineEndpoints;
  displacedLines: readonly TLine[];
}
```

`onLineConnect` always means "commit this line at these endpoints." A null
`previousEndpoints` denotes its first completed connection. Reconnect,
direction change, and occupied-target replacement are context carried by the
same semantic operation rather than separate public line kinds.

### Structural rendering, history, and persistence

`onLineInsert` is structural framework work: the line must exist in the
framework collection so the application can render its chosen component.
It is not committed topology while `targetConnectorId` is null.

Therefore:

- inserting an incomplete line does not create a history entry;
- removing that incomplete line does not create a history entry;
- the first successful `onLineConnect` creates the topology/history entry;
- reconnect and displaced-line replacement are each one atomic history entry;
- `captureSnapshot()` excludes incomplete lines and all runtime mirrors;
- `restore(snapshot)` is the named atomic path for load, undo, and redo.

Runtime node and line dictionaries may contain mirror fields for direct
imperative access. They are deliberately not serializable documents. The
official graph snapshot boundary produces plain topology and committed
geometry; reference applications must persist that representation rather
than cloning runtime entries.

### Composition and graph scope

`NodeGraph` is a real container with ordinary framework children. Headers,
footers, overlays, lines, nodes, fragments, conditions, and keyed loops may all
be declared directly inside it. `Node` does not secretly render outgoing
lines, and `NodeGraph` does not require snippets or render functions for graph
composition.

Each `NodeGraph` creates a distinct runtime graph scope under its Engine.
Connector IDs, candidate discovery, line reconciliation, selection, queries,
and imperative commands are graph-scoped rather than merely engine-scoped.
Two graphs under one Engine cannot connect to or replace one another's
objects.

Svelte exposes direct bindable mirrors and React uses refs. Runtime node arrays
may therefore use entries such as:

```ts
interface GraphNodeEntry<TData = unknown> {
  id: NodeId;
  data: TData;
  initialGeometry: InitialNodeGeometry;
  mirror: NodeMirror | null;
}
```

### Representation and SnapSort integration

SnapLine/SnapEngine own live geometry. Pointer movement, CSS transforms, path
writes, hover, and other representation changes do not update framework graph
arrays. Geometry commit notifications may update persisted mount seeds without
becoming topology changes.

Nodes need two explicit geometry ownership modes:

```ts
type NodeGeometryOwnership =
  | { kind: "snapline"; initial: InitialNodeGeometry }
  | { kind: "layout" };
```

- `snapline` means SnapLine writes node transforms and resize geometry;
- `layout` means an ancestor or layout system owns position and size while
  SnapLine measures them;
- SnapSort and SnapLine never bind to or write the same DOM element;
- a sortable item that is also a graph node uses nested elements with explicit
  ownership.

A node-level geometry invalidation primitive lets integrations report that
descendant connector positions changed without a node resize:

```ts
node.invalidateGeometry();
connector.invalidateGeometry();
```

The final name is open. The behavior must coalesce DOM measurement, connector
collider updates, and incident-line writes at scheduler-safe stages. SnapLine
does not acquire a SnapSort dependency or discover sortable ancestors.

SnapSort ghosts render connector-looking presentation markup only. They never
mount a second live `Connector` with the same graph-scoped ID.

### Connector surfaces and custom line rendering

Connector IDs are opaque, stable, application-supplied identities. Callbacks
carry endpoint mirrors and application metadata; applications do not parse an
ID string to recover its node or port.

A connector surface must be able to define broad-phase bounds, source hit
testing, target hit testing, and anchor resolution. This supports point ports,
rectangular or circular node perimeters, and other explicit interaction
surfaces without creating special node-edge APIs.

A custom line component receives the uniform line entry. Its live mirror owns
one geometry writer, and that writer may update multiple retained targets such
as a visible SVG path, a wider hit path, and an HTML label. Pure geometry does
not require framework renders.

### Initial geometry and aspirational SSR

Managed nodes receive one-shot initial `x`, `y`, and optional size values.
Lines receive complete start/end anchor geometry, not `initialX`/`initialY`.
Changing an initial seed after mount does not control live geometry; history,
load, and collaboration use an explicit batched geometry-restore command.

For eventual SSR:

- a line with saved geometry and `mirror: null` renders static markup;
- hydration attaches its mirror to the same keyed component and DOM;
- a line without initial geometry is omitted instead of painted at `(0, 0)`;
- saved connector and line geometry are representation snapshots, never
  topology or collision authority;
- full SSR remains aspirational until SnapEngine itself supports SSR.

## Earlier exploration — retained temporarily

The remainder of this file captures the path that led to the decisions above.
It contains superseded proposals, notably the generic `GraphChange` callback,
`initialDocument`, `bind:renderableLines`, and public preview-line lifecycle.
Do not implement those conflicting portions.

## Decision summary

| Area                 | Decision                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vocabulary           | Keep the existing `Line`, `LineMirror`, and `LineRecord` vocabulary; do not introduce an adapter-only `Edge` name.                                                     |
| Graph component      | Replace the headless framework `ControlledGraph` component with one real `NodeGraph` container as a clean pre-1.0 break.                                               |
| Composition          | Applications render explicit `<Line>` and `<Node>` children under `<NodeGraph>` using ordinary keyed loops and conditions.                                             |
| Node line rendering  | Remove hidden line rendering and renderer-selection props from `Node`; renderer selection belongs in normal framework control flow at graph level.                     |
| DOM ownership        | React and Svelte own structural DOM. SnapLine never inserts, removes, reparents, or reorders their graph elements.                                                     |
| Styling              | `NodeGraph` forwards native container attributes but provides no layout or positioning defaults. Application CSS owns positioning and stacking.                        |
| Line stacking        | Remove the built-in line `z-index`; application child order and CSS define graph layers.                                                                               |
| Node access          | Svelte exposes a bindable node-mirror output; React continues to use its forwarded ref. Application node dictionaries may keep the framework-native reference field.   |
| Rendered lines       | `NodeGraph` publishes every live line mirror: preview, staged, and settled. The same mirror survives an accepted preview-to-settled transition.                        |
| Canonical authority  | Framework arrays are the initial canonical topology source. Every post-mount topology change goes through one request/return transaction port.                         |
| Geometry             | SnapLine/SnapEngine own live node and line geometry. Geometry and CSS/property changes are not graph transactions.                                                     |
| Geometry persistence | `onGeometryCommit` remains a notification. Applications may save mount seeds, but those seeds never become live controlled props.                                      |
| History              | History is an optional attachable module observing finalized transactions, not hidden middleware. It may explicitly attach topology and geometry as separate channels. |
| SSR                  | Progressive activation and full render snapshots are aspirational. They are blocked on broader SnapEngine SSR work.                                                    |

## Ownership model

The API separates three channels that must not be conflated:

```text
Application topology       -> graph transaction callback
Preview/component lifetime -> renderable-line collection
Live geometry/properties   -> mirrors + CSS/transform writers
```

### Application-owned topology

The application owns the canonical graph document:

- which node IDs exist;
- which connector structures its node UI renders;
- which stable line IDs and endpoint pairs exist;
- application payloads used to choose node and line presentation.

SnapLine asks the application to change this document. It never silently
changes the arrays itself.

### Engine-owned representation

SnapLine owns runtime mirrors, gesture state, candidate state, selection,
group transforms, node geometry, connector measurement, and line geometry.
SnapEngine owns input, collision, transforms, and staged frame writes.

Moving or resizing a node is not a graph transaction. Updating an SVG path,
CSS transform, class, hover state, or selection style is not a graph
transaction. Those changes use retained mirrors and property writers so a
pointer move does not round-trip through a framework renderer.

### What counts as a graph change

A graph change changes canonical topology or application structure that
SnapLine must reconcile:

- adding or removing a node;
- adding or removing a connector through application node structure;
- connecting, disconnecting, replacing, or reconnecting a line;
- replacing the topology for load, collaboration, undo, or redo.

A connection remains a graph change even when the same preview `LineMirror`
and the same SVG element survive settlement. Conversely, mounting a transient
preview line is framework DOM work but not a canonical graph change; it is an
engine-owned representation lifetime communicated through `renderableLines`.

## Proposed topology types and transaction port

The exact operation union inside `GraphChange` remains to be specified, but
the authority boundary is accepted:

```ts
interface InitialNodeGeometry {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface GraphNodeRecord {
  id: NodeId;

  // A one-time mount/SSR seed. This is not live controlled geometry.
  initialGeometry: InitialNodeGeometry;
}

interface GraphDocument<TNode extends GraphNodeRecord = GraphNodeRecord> {
  nodes: readonly TNode[];
  lines: readonly LineRecord[];
}

interface GraphDocumentChangeRequest<
  TNode extends GraphNodeRecord = GraphNodeRecord,
> {
  current: GraphDocument<TNode>;
  change: GraphChange<TNode>;
}

interface GraphTransaction<TNode extends GraphNodeRecord = GraphNodeRecord> {
  before: GraphDocument<TNode>;
  request: GraphChange<TNode>;
  after: GraphDocument<TNode>;
}

interface GraphController<TNode extends GraphNodeRecord = GraphNodeRecord> {
  request(change: GraphChange<TNode>): GraphDocument<TNode>;
  onTransaction(
    observer: (transaction: GraphTransaction<TNode>) => void,
  ): () => void;
  flush(): void;
}
```

`NodeGraph` reads an explicitly named `initialDocument` once. It retains the
exact immutable document reference accepted by the application; it does not
clone or independently mutate a shadow application model.

Every post-mount topology source uses `GraphController.request()`:

- a connector gesture;
- an application command;
- load or reset;
- collaboration input;
- history undo or redo.

The required application callback receives the controller's current accepted
reference plus the proposed change. It accepts, rejects, or normalizes the
proposal by synchronously committing and returning the resulting document.
Passing `current` avoids stale-closure bookkeeping in React.

```ts
function decide<TNode extends GraphNodeRecord>({
  current,
  change,
}: GraphDocumentChangeRequest<TNode>): GraphDocument<TNode> {
  const next = applyGraphChange(current, change);
  commitFrameworkState(next);
  return next;
}
```

The framework adapter wraps that consumer callback in its synchronous commit
boundary. SnapLine reconciles only after the callback has committed the
application array and returned its decision.

There is no silent `setCanonicalGraph()` escape hatch on the component
controller. A load is an explicit replacement request through the same
authority port:

```ts
graph.request({
  kind: "replace",
  origin: "load",
  document: loadedDocument,
});
```

The final `GraphChange` operation schema still needs to decide how node and
connector structural changes are represented without standardizing arbitrary
application node payloads.

## Proposed component composition

### Svelte

```svelte
<script lang="ts">
  import {
    applyGraphChange,
    type GraphDocument,
    type GraphDocumentChangeRequest,
    type GraphNodeRecord,
    type LineMirror,
    type NodeMirror,
  } from "@snap-engine/snapline";
  import {
    Connector,
    Line,
    Node,
    NodeGraph,
  } from "@snap-engine/snapline/svelte";

  type EditorNode = GraphNodeRecord & {
    title: string;

    // Runtime-only. The application serializer must omit it.
    mirror: NodeMirror | null;
  };

  const initialDocument: GraphDocument<EditorNode> = {
    nodes: [
      {
        id: "input",
        title: "Input",
        initialGeometry: { x: 100, y: 100, width: 180, height: 120 },
        mirror: null,
      },
      {
        id: "output",
        title: "Output",
        initialGeometry: { x: 420, y: 160, width: 180, height: 120 },
        mirror: null,
      },
    ],
    lines: [],
  };

  let document = $state.raw(initialDocument);
  let renderableLines = $state.raw<readonly LineMirror[]>([]);
  let graph;

  function decide(event: GraphDocumentChangeRequest<EditorNode>) {
    const next = applyGraphChange(event.current, event.change);
    document = next;
    return next;
  }
</script>

<NodeGraph
  bind:this={graph}
  bind:renderableLines
  {initialDocument}
  onDocumentChangeRequest={decide}
  class="graph"
>
  {#each renderableLines as line (line.id)}
    {#if line.payload?.kind === "control"}
      <ControlLine {line} />
    {:else}
      <Line {line} />
    {/if}
  {/each}

  {#each document.nodes as item (item.id)}
    <Node id={item.id} bind:node={item.mirror}>
      <h2>{item.title}</h2>
      <Connector id={`${item.id}:input`} name="input" />
      <Connector id={`${item.id}:output`} name="output" />
    </Node>
  {/each}
</NodeGraph>
```

### React

```tsx
type EditorNode = GraphNodeRecord & {
  title: string;

  // Runtime-only. The application serializer must omit it.
  mirrorRef: RefObject<NodeMirror | null>;
};

const initialDocument: GraphDocument<EditorNode> = {
  nodes: [
    {
      id: "input",
      title: "Input",
      initialGeometry: { x: 100, y: 100, width: 180, height: 120 },
      mirrorRef: createRef(),
    },
    {
      id: "output",
      title: "Output",
      initialGeometry: { x: 420, y: 160, width: 180, height: 120 },
      mirrorRef: createRef(),
    },
  ],
  lines: [],
};

function Editor() {
  const graphRef = useRef<GraphController<EditorNode>>(null);
  const initialDocumentRef = useRef(initialDocument);
  const [document, setDocument] = useState(initialDocumentRef.current);
  const [renderableLines, setRenderableLines] = useState<readonly LineMirror[]>(
    [],
  );

  return (
    <NodeGraph
      ref={graphRef}
      initialDocument={initialDocumentRef.current}
      onDocumentChangeRequest={({ current, change }) => {
        const next = applyGraphChange(current, change);
        setDocument(next);
        return next;
      }}
      onRenderableLinesChange={setRenderableLines}
      className="graph"
    >
      {renderableLines.map((line) =>
        line.payload?.kind === "control" ? (
          <ControlLine key={line.id} line={line} />
        ) : (
          <Line key={line.id} line={line} />
        ),
      )}

      {document.nodes.map((item) => (
        <Node key={item.id} id={item.id} ref={item.mirrorRef}>
          <h2>{item.title}</h2>
          <Connector id={`${item.id}:input`} name="input" />
          <Connector id={`${item.id}:output`} name="output" />
        </Node>
      ))}
    </NodeGraph>
  );
}
```

The component declaration may contain arbitrary application children,
conditions, fragments, and keyed loops. `NodeGraph` does not inspect child
component types or enforce literal direct-child syntax.

## Node mirror references

The application may keep the mounted mirror reference on the same dictionary
it iterates. This avoids maintaining a second ID-to-mirror map.

- Svelte: `bind:node={item.mirror}` stores `NodeMirror | null` directly.
- React: `ref={item.mirrorRef}` stores it in the framework-native ref cell.
- Both references are populated on mount and cleared on unmount.
- These fields are runtime-only and must not be serialized as application
  graph data.

The Svelte adapter should remove the imperative `getNodeObject()` method in
favor of the bindable output. React already forwards `NodeMirror` through its
ref. Caller-supplied core objects remain a distinct input concern and must
retain an explicit ownership/destruction contract.

`NodeGraph` does not publish a second reactive node-mirror collection. The
application already owns and renders the node array; the mirror reference on
each dictionary is the access path. The read-only `query(engine).nodes()`
snapshot remains available for engine-wide inspection but is not the
application array.

## Explicit line rendering

`Node` stops rendering outgoing lines. Remove the framework adapter props and
helpers that implement hidden renderer selection:

- Svelte `LineSvelteComponent`;
- React `lineComponent`;
- both adapters' `resolveLineComponent`;
- the private per-node line collection and render loop.

Renderer selection becomes ordinary graph-level framework code based on
serializable line payload or mirror state. There is no `LineLayer`, resolver
registry, named snippet, or render-function abstraction.

The core node-level collection callback becomes obsolete. Remove
`NodeCallbacks.onLinesChanged`, `NodeLinesEvent`, `updateNodeLineList()`, and
their call sites once the graph-level line collection is the sole structural
render channel.

### Renderable-line collection contract

The graph registry maintains a registration-ordered collection of every live
`LineMirror`, including:

- free and candidate previews;
- staged gesture results awaiting the application decision;
- settled canonical lines.

`query(engine).lines()` remains settled-only. The read-only query surface
gains a distinct renderable-lines snapshot/subscription primitive. The
subscription is immediately primed and publishes a fresh readonly array when:

- a line becomes renderable;
- a line is destroyed;
- payload, phase, or another render-relevant semantic state changes.

Pure geometry writes do not republish the array. Pointer movement continues
through `LineMirror.bindGeometryWriter()` without framework rendering.

Line publication is coalesced until the current input task has initialized
the mirror's payload, phase, source position, and anchors. The framework
adapter commits the resulting line component before paint.

Framework keys use the mirror's unique runtime `line.id`, not only the
application `lineId`. Duplicate domain IDs can temporarily coexist while
diagnostics resolve them; the global render loop must still have unique keys.
The runtime key remains stable when an accepted preview becomes settled.

### Preview and settlement lifecycle

```text
Connector drag crosses threshold
        -> SnapLine creates and initializes a preview LineMirror
        -> registry publishes renderableLines
        -> framework mounts <Line line={mirror}>
        -> Line binds its SVG geometry writer
        -> pointer movement updates retained SVG properties directly
```

On drop:

- **Accepted:** the application adopts the proposed `lineId`; the same mirror
  settles and the same keyed component remains mounted.
- **Rejected:** SnapLine destroys the preview mirror; the next collection
  snapshot causes the framework to unmount the line component.
- **Reconnect:** the existing settled mirror remains mounted throughout.

## NodeGraph container behavior

`NodeGraph` is one real framework-owned `<div>`, not a headless bridge. It:

- renders ordinary children unchanged;
- forwards native attributes, classes, styles, data attributes, and events;
- creates/attaches the graph controller for the nearest engine;
- publishes renderable lines through `bind:renderableLines` in Svelte and
  `onRenderableLinesChange` in React;
- exposes the `GraphController` through the component instance/ref;
- disposes its controller and subscriptions on unmount.

It does not inject `position: relative`, dimensions, overflow, pointer policy,
or stacking. Examples explicitly supply the required application CSS.

The framework `ControlledGraph` components and compatibility aliases are
removed. The package is experimental and the design favors one clean API over
parallel migration paths. Whether the framework-neutral
`attachControlledGraph()` function is renamed or replaced remains open.

## Geometry contract

### Live authority

SnapLine retains its current high-performance geometry model:

- node drag and resize mutate `NodeMirror` state and retained DOM properties;
- line paths use a single-owner `bindGeometryWriter()`;
- passive consumers use `onGeometryInvalidated()` or semantic state
  observation rather than a second painter;
- CSS-only visual changes stay in CSS;
- no pointer-move geometry is sent through the graph document callback.

Imperative topology and representation APIs remain visibly different:

```ts
graph.request(topologyChange); // asks the application to change data

node.worldPosition = [x, y]; // changes engine-owned representation
node.scheduleGeometryWrite();

line.bindGeometryWriter(writeLinePath);
```

The exact property names above must follow the final core API; the separation
of authority is the decision being recorded.

### Initial and persisted geometry

`GraphNodeRecord.initialGeometry` is a one-time mount seed:

- `x` and `y` are required for deterministic initial/SSR placement;
- `width` and `height` may be omitted and supplied by rendered CSS;
- a newly mounted `NodeMirror` adopts the seed before its first measurement;
- later changes to the saved seed never control or overwrite the live mirror.

`onGeometryCommit` remains a notification. Applications may use it to save
the next startup seed for persistence or a future server render. Ignoring it
does not revert the mirror. Updating persisted geometry is not a topology
transaction.

## Optional history module

History is a separate module attached explicitly to observable controller
primitives. It is not part of `NodeGraph` state and is not an interceptor or
middleware chain.

```ts
const history = new GraphHistory<EditorNode>({
  capacity: 100,
  shouldRecord: (transaction) =>
    transaction.request.origin === "interaction" ||
    transaction.request.origin === "command",
});

const detach = history.attach(graph);
```

Accepted characteristics:

- it observes finalized `{ before, request, after }` transactions;
- it cannot rewrite, veto, or hide the application authority callback;
- `undo()` and `redo()` submit explicit replacement requests through
  `graph.request()`;
- the application callback still accepts, rejects, or normalizes history
  requests;
- it exposes undo, redo, clear, availability state, and disposal;
- retention capacity and record filtering are explicit configuration, not
  hidden defaults;
- topology and geometry are separate channels that a history instance may
  attach explicitly.

Geometry attachment does not turn geometry into a graph transaction. A future
geometry-history channel must observe committed geometry separately and issue
representation commands through mirrors. Its exact grouping, replay, and
multi-node semantics remain open.

Runtime mirror/ref fields must not leak into persisted history artifacts. The
history module still needs an explicit projection or snapshot policy for
generic application node dictionaries.

## Aspirational SSR direction

### Status and prerequisite

This section is a design direction only. SnapEngine and Asset Base currently
gate framework children until a browser engine exists, and SnapLine adapters
construct mirrors with browser/engine assumptions. SnapEngine-wide SSR
readiness must land before full SnapLine SSR work begins.

Do not add the following items to the first NodeGraph phase's acceptance
criteria merely because they are recorded here.

### Progressive activation

The chosen long-term activation model uses the same components on the server
and client:

1. The server and the client's first render output ordinary `Engine`,
   `NodeGraph`, `Node`, `Connector`, and application DOM without core mirrors.
2. Engine and node contexts are nullable reactive holders during SSR and
   hydration rather than constructors that throw or suppress children.
3. After hydration, mirrors are created in effects and attached to the
   existing DOM.
4. Nodes adopt their one-time geometry seeds, connectors measure, and the
   line reconciler activates without emitting topology requests.
5. Interaction starts only after real DOM measurement completes.

Stable application IDs are mandatory for SSR graph nodes and connectors.
Client-minted IDs cannot produce deterministic server/client markup.

### Minimum fallback

Without a saved representation snapshot, SSR renders nodes, connectors, and
application content. Canonical and preview line components mount after client
hydration and connector measurement. This is the selected safe fallback.

### Full graph SSR from a saved client snapshot

A completely visible SSR graph requires browser-derived representation data.
The selected source is a snapshot captured from a previous CSR session. A
first-ever full render is impossible for arbitrary CSS connector layouts
unless the application instead supplies a deterministic server geometry
provider.

The representation artifact is versioned and separate from canonical line
records:

```ts
// The serializable part of ConnectorGeometrySnapshot: a core geometry Rect
// (world space) plus the connector anchor.
interface SerializedConnectorGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  center: ConnectorAnchor;
}

interface GraphRenderSnapshot {
  graphId: string;
  topologyRevision: string;
  layoutRevision: string;
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  connectors: Readonly<Record<ConnectorId, SerializedConnectorGeometry>>;
  lines: Readonly<Record<LineId, LineGeometrySnapshot>>;
}
```

Node startup geometry remains on node records, as decided above. Connector
and resolved line geometry live in the separate render snapshot because
SnapLine has no canonical connector-record model and `LineRecord` should stay
topological.

Both connector and line layers are captured:

- connector boxes/centers seed and validate hydrated connector mirrors;
- resolved line start/end anchors are the exact server paint input;
- line geometry is necessary because custom anchor strategies may depend on
  peer, payload, hit data, or anchor normals; connector centers alone are not
  sufficient;
- saved geometry is paint data only and never becomes live collision or
  admission authority.

Capture must run in one SnapEngine read transaction so node transforms,
connector boxes, camera state, and line anchors describe the same frame. It
excludes previews and other transient interaction state.

```ts
const renderSnapshot = await graph.captureRenderSnapshot({
  topologyRevision: document.revision,
  layoutRevision: "editor-layout-v3",
  include: {
    camera: true,
    connectors: true,
    lines: true,
  },
});
```

The exact capture API is aspirational and not yet accepted as a public
signature.

### Hydration-safe line entry

Full line SSR eventually requires a universal render entry instead of a
component that can only accept a live `LineMirror`:

```ts
interface LineRenderEntry {
  renderKey: string;
  lineId: LineId;
  payload: unknown;
  geometry: LineGeometrySnapshot;
  mirror: LineMirror | null;
}
```

On the server, `mirror` is `null` and the line component renders a static SVG
from saved geometry. During hydration, the same keyed entry gains a mirror
and binds its geometry writer without replacing the SVG element. Preview
entries remain client-only.

This universal-entry decision belongs to the aspirational full-SSR design.
The first NodeGraph implementation still needs to decide whether adopting it
early is worth the extra API surface before SnapEngine SSR exists.

### Snapshot validation and fallback

The application supplies both `topologyRevision` and `layoutRevision`. The
latter invalidates snapshots after CSS, font, node-template, or line-renderer
changes.

Accepted fallback behavior:

- a topology/layout revision mismatch renders nodes and connectors but omits
  static lines;
- a canonical line missing resolved saved geometry is omitted until client
  hydration;
- SnapLine never silently joins saved connector centers because that would
  invent an anchor policy;
- hydration remeasures real DOM and corrects saved geometry in one scheduled
  reconciliation pass.

`graphId` must be stable so render keys and SVG marker/definition IDs are
deterministic and isolated across multiple graphs on one page.

## Rejected alternatives

- **Automatic line rendering inside `NodeGraph`:** shorter declaration, but it
  hides framework state, line selection, and DOM ownership.
- **Per-node hidden line rendering:** couples lines to source-node components
  and prevents graph-level layering and composition.
- **`LineLayer` render snippets/functions:** introduces a second composition
  abstraction when ordinary framework loops already express the behavior.
- **Canonical records rendered directly as live `<Line>` components:** a
  record cannot represent a gesture preview or provide live geometry.
- **Adapter-only `Edge` vocabulary:** produces two words for the same domain
  entity while core and package vocabulary remain `Line`.
- **Live controlled node geometry:** forces high-frequency interaction through
  framework state and creates a second writer beside SnapEngine.
- **Geometry inside topology transactions:** confuses representation with
  application graph structure and makes history implicitly capture motion.
- **Built-in hidden history:** obscures data ownership and transaction order.
- **History middleware:** plugin ordering could silently change application
  decisions; history should be a passive observer plus explicit commands.
- **Separate SSR-only graph components:** duplicates declaration APIs and
  complicates hydration; progressive activation is the preferred direction.
- **Deriving SSR lines from connector centers:** incorrect for custom anchor
  strategies unless the application explicitly supplies a resolver.

## Implementation slices

The work should remain separable even if it is eventually scheduled together.

### Slice A: NodeGraph composition

- Add graph-level renderable-line enumeration and subscription.
- Replace framework `ControlledGraph` with real `NodeGraph` containers.
- Move line loops and renderer selection from `Node` into demos/app examples.
- Normalize node mirror access and remove node-level line callbacks.
- Remove built-in line stacking and migrate application CSS.

### Slice B: topology transaction controller and history

- Generalize the current line-only controlled protocol into the accepted
  initial-document/request/return controller.
- Define the exact atomic `GraphChange` operation union.
- Route gestures, programmatic replacement, load, and history through the
  same authority callback.
- Add finalized transaction observation and the attachable history module.
- Specify serialization/projection of application records with runtime refs.

### Slice C: SSR prerequisites and progressive activation (future)

- Make SnapEngine/Asset Base children SSR-renderable without constructing a
  browser engine.
- Make SnapLine mirrors attach after hydration to existing DOM.
- Add deterministic ID, mount-seed, capture, revision, and fallback contracts.
- Adopt hydration-safe line entries only when full line SSR is scheduled.

## Verification targets

### Composition and ownership

- Preview, staged, and settled lines render under `NodeGraph`, never inside a
  `Node` DOM subtree.
- An accepted preview preserves its `LineMirror` and keyed line component.
- A rejected preview unmounts deterministically.
- Reconnect preserves the mirror; delete removes it.
- Custom payload-based line components work in ordinary Svelte/React branches.
- Node mirror references populate and clear on application dictionary entries.
- Geometry pointer moves do not trigger framework collection updates.
- `NodeGraph` forwards native attributes and injects no layout styles.
- Application CSS can place lines above or below nodes.

### Transactions and history

- Every gesture produces one atomic topology request and one decisive result.
- Load, reset, collaboration, undo, and redo use the same request port.
- Rejection returns the existing document and restores staged representation.
- History observes only finalized decisions and cannot veto them.
- New accepted work after undo clears redo according to the explicitly
  specified history policy.
- Geometry observation remains separate even when the same history instance
  explicitly attaches a geometry channel.

### Aspirational SSR

- Server rendering constructs no SnapEngine or SnapLine mirrors and accesses
  no browser globals.
- Server and first-client markup match for nodes, connectors, and saved lines.
- Hydration preserves existing DOM elements while attaching live mirrors.
- A captured CSR snapshot round-trips through serialization and SSR.
- Revision mismatch and missing-line geometry use the nodes-only fallback.
- Real client measurement replaces saved paint geometry before interaction.

## Open design questions

These were not decided in the discussion and must be resolved before an
implementation plan is decision-complete:

1. The exact `GraphChange<TNode>` operation union and its intent/origin names.
2. Whether connector structure receives a standard record shape or remains
   entirely application-defined inside node records/components.
3. The final framework-neutral attach/controller naming that replaces or
   evolves `attachControlledGraph()`.
4. The exact subscription method names and callback tense cleanup.
5. The history projection/serialization contract for node dictionaries that
   contain runtime mirror/ref fields.
6. Geometry-history replay, grouping, and multi-node transaction semantics.
7. Whether `LineRenderEntry` should be adopted in the first NodeGraph phase or
   deferred until SnapEngine SSR work is actually scheduled.
8. The exact representation-snapshot capture API and revision policy.
