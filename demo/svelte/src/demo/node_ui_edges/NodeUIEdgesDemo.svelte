<script lang="ts">
  import { Engine } from "@snap-engine/asset-base-svelte";
  import { ControlledGraph, Select } from "@snap-engine/snapline-svelte";
  import { applyLineChange, query } from "@snap-engine/snapline";
  import type {
    LineChangeRequest,
    LineMirror,
    LineRecord,
  } from "@snap-engine/snapline";
  import type { Engine as CoreEngine } from "@snap-engine/core";
  import EdgeNode from "./EdgeNode.svelte";
  import LineLabel from "./LineLabel.svelte";

  // The application-owned line document: the single source of truth.
  // Connector ids are `${node}:${port}`; line ids are stable.
  let lines = $state.raw<LineRecord[]>([]);
  let graph: ControlledGraph;
  let engine = $state<CoreEngine | null>(null);
  // An overlay library discovers lines through the read-only query facade
  // rather than holding records. Settled mirrors appear one reconciliation
  // pass after the document changes, hence the microtask.
  let lineMirrors = $state<LineMirror[]>([]);

  // Changes with no originating request (toolbar buttons, the test hook) have
  // to be pushed; only a gesture's return value reaches SnapLine on its own.
  function commit(next: LineRecord[]): void {
    lines = next;
    graph?.setLines(next);
  }
  let connectIntents = $state(0);
  let disconnectIntents = $state(0);
  let intentLog = $state<string[]>([]);
  let rejectConnects = $state(false);
  let showNodeC = $state(true);

  function label(record: { fromConnectorId: string; toConnectorId: string }) {
    const node = (connectorId: string) => connectorId.split(":")[0];
    return `${node(record.fromConnectorId)}->${node(record.toConnectorId)}`;
  }

  function describe(request: LineChangeRequest): string {
    const byId = new Map(lines.map((record) => [record.id, record]));
    const removed = request.remove
      .map((id) => {
        const record = byId.get(id);
        return record ? label(record) : id;
      })
      .join(",");
    const added = request.add.map(label).join(",");
    const updated = request.update
      .map((update) => {
        const record = byId.get(update.id);
        return record
          ? label({ ...record, toConnectorId: update.toConnectorId })
          : update.id;
      })
      .join(",");
    switch (request.intent) {
      case "connect":
        return `connect:${added}`;
      case "disconnect":
        return `disconnect:${removed}`;
      case "reconnect":
        return `reconnect:${updated}`;
      case "replace":
        return `replace:-${removed}+${added || updated}`;
    }
  }

  function handleRequest(request: LineChangeRequest): readonly LineRecord[] {
    intentLog = [...intentLog, describe(request)];
    if (request.add.length > 0) connectIntents += 1;
    if (request.intent === "disconnect") disconnectIntents += 1;
    // Rejection is returning the document unchanged — explicit, and no longer
    // spelled the same way as forgetting to return at all.
    if (rejectConnects && request.add.length > 0) return lines;
    // Accept the atomic proposal — adopting the proposed ids settles the
    // staged lines in place.
    return (lines = applyLineChange(lines, request));
  }

  function addDocLine(record: LineRecord): void {
    if (lines.some((existing) => existing.id === record.id)) return;
    // Single-capacity inputs replace at the document level. This is the app's
    // own policy, not a request being applied, so it goes through commit().
    commit([
      ...lines.filter(
        (existing) => existing.toConnectorId !== record.toConnectorId,
      ),
      record,
    ]);
  }

  $effect(() => {
    void lines;
    queueMicrotask(() => {
      if (engine) lineMirrors = [...query(engine).lines()];
    });
  });

  // Test hook: lets the e2e mutate the document mid-drag without a second
  // pointer interaction breaking the gesture.
  $effect(() => {
    (window as unknown as { __addTestEdge?: () => void }).__addTestEdge = () =>
      addDocLine({
        id: "doc-a-c",
        fromConnectorId: "a:output",
        toConnectorId: "c:input",
      });
    return () => {
      delete (window as unknown as { __addTestEdge?: () => void }).__addTestEdge;
    };
  });
</script>

<div class="edges-toolbar">
  <button
    data-testid="add-edge"
    onclick={() =>
      addDocLine({
        id: "doc-a-c",
        fromConnectorId: "a:output",
        toConnectorId: "c:input",
      })}
  >Add A→C</button>
  <button
    data-testid="remove-edge"
    onclick={() => commit(lines.slice(0, -1))}
  >Remove last</button>
  <button data-testid="reset-doc" onclick={() => commit([])}>Reset</button>
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
  <span data-testid="edge-count">{lines.length}</span>
  <span data-testid="intent-log">{intentLog.join("|")}</span>
</div>

<Engine bind:engine id="node-ui-edges-canvas">
  <div id="node-ui-edges">
    <div id="sl-background"></div>
    <Select />
    {#each lineMirrors as mirror (mirror.lineId)}
      <LineLabel line={mirror} />
    {/each}
    <ControlledGraph bind:this={graph} onLineChangeRequest={handleRequest} />
    <EdgeNode nodeId="a" title="Node A" x={120} y={120} />
    <EdgeNode
      nodeId="b"
      title="Node B"
      x={440}
      y={170}
      maxIncoming={1}
      canResize
    />
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
