<script lang="ts">
  import { Engine } from "@snap-engine/asset-base-svelte";
  import { EdgeSync, Select } from "@snap-engine/snapline-svelte";
  import type { ConnectorMirror, EdgeLike } from "@snap-engine/snapline";
  import EdgeNode from "./EdgeNode.svelte";

  // The application-owned edge document: the single source of truth.
  let edges = $state<EdgeLike[]>([]);
  let connectIntents = $state(0);
  let disconnectIntents = $state(0);
  let intentLog = $state<string[]>([]);
  let rejectConnects = $state(false);
  let showNodeC = $state(true);

  function identity(connector: ConnectorMirror) {
    const metadata = connector.metadata as { node?: string; port?: string };
    return typeof metadata.node === "string" && typeof metadata.port === "string"
      ? { node: metadata.node, port: metadata.port }
      : null;
  }

  function edgeEquals(a: EdgeLike, b: EdgeLike): boolean {
    return (
      a.from.node === b.from.node &&
      a.from.port === b.from.port &&
      a.to.node === b.to.node &&
      a.to.port === b.to.port
    );
  }

  // Test hook: lets the e2e mutate the document mid-drag without a second
  // pointer interaction breaking the gesture.
  $effect(() => {
    (window as unknown as { __addTestEdge?: () => void }).__addTestEdge = () =>
      addEdge({ from: { node: "a", port: "output" }, to: { node: "c", port: "input" } });
    return () => {
      delete (window as unknown as { __addTestEdge?: () => void }).__addTestEdge;
    };
  });

  function addEdge(edge: EdgeLike): void {
    if (edges.some((existing) => edgeEquals(existing, edge))) return;
    // Single-capacity inputs replace at the document level.
    edges = [
      ...edges.filter(
        (existing) =>
          !(existing.to.node === edge.to.node && existing.to.port === edge.to.port),
      ),
      edge,
    ];
  }
</script>

<div class="edges-toolbar">
  <button
    data-testid="add-edge"
    onclick={() => addEdge({ from: { node: "a", port: "output" }, to: { node: "c", port: "input" } })}
  >Add A→C</button>
  <button
    data-testid="remove-edge"
    onclick={() => (edges = edges.slice(0, -1))}
  >Remove last</button>
  <button data-testid="reset-doc" onclick={() => (edges = [])}>Reset</button>
  <button
    data-testid="reject-connects"
    aria-pressed={rejectConnects}
    onclick={() => (rejectConnects = !rejectConnects)}
  >Reject: {rejectConnects ? "on" : "off"}</button>
  <button
    data-testid="show-node-c"
    aria-pressed={showNodeC}
    onclick={() => (showNodeC = !showNodeC)}
  >Node C: {showNodeC ? "on" : "off"}</button>
  <span data-testid="connect-intents">{connectIntents}</span>
  <span data-testid="disconnect-intents">{disconnectIntents}</span>
  <span data-testid="edge-count">{edges.length}</span>
  <span data-testid="intent-log">{intentLog.join("|")}</span>
</div>

<Engine id="node-ui-edges-canvas">
  <div id="node-ui-edges">
    <div id="sl-background"></div>
    <Select />
    <EdgeSync
      {edges}
      {identity}
      onEdgeConnect={({ from, to }) => {
        connectIntents += 1;
        intentLog = [...intentLog, `connect:${from.node}->${to.node}`];
        if (!rejectConnects) addEdge({ from, to });
      }}
      onEdgeDisconnect={({ from, to, reason }) => {
        disconnectIntents += 1;
        intentLog = [...intentLog, `disconnect(${reason}):${from.node}->${to.node}`];
        edges = edges.filter(
          (existing) => !edgeEquals(existing, { from, to }),
        );
      }}
    />
    <EdgeNode nodeId="a" title="Node A" x={120} y={120} />
    <EdgeNode nodeId="b" title="Node B" x={440} y={170} maxIncoming={1} />
    {#if showNodeC}
      <EdgeNode nodeId="c" title="Node C" x={280} y={380} />
    {/if}
  </div>
</Engine>

<style>
  .edges-toolbar {
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 10;
    display: flex;
    gap: 8px;
    align-items: center;
    background: rgba(255, 255, 255, 0.9);
    padding: 4px 8px;
  }
  #node-ui-edges {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  :global(.node) {
    pointer-events: auto;
  }
  #sl-background {
    position: absolute;
    inset: 0;
    pointer-events: auto;
  }
</style>
