<script lang="ts">
  import { Engine } from "@snap-engine/asset-base-svelte";
  import type { Engine as CoreEngine } from "@snap-engine/core";
  import { PlacementController } from "@snap-engine/snapline";
  import {
    Connector,
    Group,
    Node,
    Placement,
    Select,
  } from "@snap-engine/snapline-svelte";
  import { ControlledGraph } from "@snap-engine/snapline-svelte";
  import type { LineChangeRequest, LineRecord } from "@snap-engine/snapline";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";

  let {
    mode,
  }: {
    mode: "connections" | "selection" | "groups" | "placement";
  } = $props();

  let engine = $state<CoreEngine | null>(null);
  // Topology is always controlled: the demo owns its line document and
  // accepts every atomic proposal.
  let lines = $state<LineRecord[]>([]);
  function applyRequest(request: LineChangeRequest): void {
    lines = [
      ...lines
        .filter((record) => !request.remove.includes(record.id))
        .map((record) => {
          const update = request.update.find((entry) => entry.id === record.id);
          return update
            ? { ...record, toConnectorId: update.toConnectorId }
            : record;
        }),
      ...request.add,
    ];
  }
  let placement = $state<PlacementController<string> | null>(null);
  let placedNodes = $state<Array<{ id: number; x: number; y: number }>>([]);
  let nextPlacedId = 1;

  $effect(() => {
    if (!engine || placement) return;
    placement = new PlacementController<string>({
      screenToWorld(screen) {
        if (!engine?.camera) return null;
        const camera = engine.camera.getCameraFromScreen(screen.x, screen.y);
        const world = engine.camera.getWorldFromCamera(camera[0], camera[1]);
        return { x: world[0], y: world[1] };
      },
      callbacks: {
        canPlace(event) {
          const bounds = engine?.containerElement?.getBoundingClientRect();
          return Boolean(
            bounds &&
              event.screen.x >= bounds.left &&
              event.screen.x <= bounds.right &&
              event.screen.y >= bounds.top &&
              event.screen.y <= bounds.bottom,
          );
        },
        onCommit(event) {
          placedNodes = [
            ...placedNodes,
            {
              id: nextPlacedId++,
              x: event.position.x,
              y: event.position.y,
            },
          ];
        },
      },
    });
  });

  function beginPlacement(event: MouseEvent): void {
    placement?.begin("Node", { width: 108, height: 54 }, {
      screen: { x: event.clientX, y: event.clientY },
    });
  }
</script>

<figure class="snapline-demo" aria-label={`Interactive SnapLine ${mode} example`}>
  <ClientDemoFrame className="snapline-demo-skeleton">
    <div class="demo-shell">
      {#if mode === "placement"}
        <button class="palette-button" type="button" onclick={beginPlacement}>
          Place a node
        </button>
      {/if}
      <Engine bind:engine id={`snapline-doc-${mode}`} className="demo-engine">
        <div class="grid" data-demo-background></div>
        {#if mode === "connections"}
          <ControlledGraph {lines} onLineChangeRequest={applyRequest} />
          <Node className="doc-node" x={55} y={80}>
            <strong>Source</strong>
            <span>Drag the port</span>
            <div class="port right"><Connector id="source:value" name="value" rules={{ maxIncoming: 0 }} /></div>
          </Node>
          <Node className="doc-node" x={310} y={155}>
            <strong>Result</strong>
            <span>Drop it here</span>
            <div class="port left">
              <Connector id="result:value" name="value" rules={{ maxOutgoing: 0, maxIncoming: 1, onFull: "replace-oldest" }} />
            </div>
          </Node>
        {:else if mode === "selection"}
          <Select className="doc-selection" />
          <Node className="doc-node compact" x={65} y={70} resizable><strong>One</strong></Node>
          <Node className="doc-node compact" x={245} y={105} resizable><strong>Two</strong></Node>
          <Node className="doc-node compact" x={155} y={210} resizable><strong>Three</strong></Node>
        {:else if mode === "groups"}
          <Group className="doc-group outer" x={28} y={35} width={430} height={245} title="Outer group" />
          <Group className="doc-group inner" x={90} y={95} width={235} height={130} title="Nested group" />
          <Node className="doc-node compact" x={130} y={145}><strong>Nested</strong></Node>
          <Node className="doc-node compact" x={350} y={150}><strong>Direct</strong></Node>
        {:else if mode === "placement"}
          {#if placement}
            <Placement controller={placement} cancelOnOutside={false}>
              {#snippet preview(snapshot)}
                <div class="placement-preview">Node</div>
              {/snippet}
            </Placement>
          {/if}
          {#each placedNodes as placed (placed.id)}
            <Node className="doc-node compact" x={placed.x} y={placed.y}>
              <strong>Node {placed.id}</strong>
            </Node>
          {/each}
        {/if}
      </Engine>
      <p class="hint">
        {mode === "connections"
          ? "Drag the source port to the input port."
          : mode === "selection"
            ? "Drag empty space to select; use a selected node's edges to resize."
            : mode === "groups"
              ? "Drag either group header; the outer group carries the complete subtree."
              : "Choose Place a node, move over the canvas, then click to commit."}
      </p>
    </div>
  </ClientDemoFrame>
</figure>

<style>
  .snapline-demo {
    margin: 1.5rem 0;
  }

  .demo-shell {
    position: relative;
    overflow: hidden;
    min-height: 22rem;
    border: 1px solid rgb(70 62 54 / 18%);
    border-radius: 14px;
    background: #f8f7f2;
  }

  :global(.demo-engine) {
    min-height: 19rem;
    touch-action: none;
  }

  .grid {
    position: absolute;
    inset: 0;
    pointer-events: auto;
    background-image:
      linear-gradient(rgb(45 60 80 / 6%) 1px, transparent 1px),
      linear-gradient(90deg, rgb(45 60 80 / 6%) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  :global(.doc-node) {
    box-sizing: border-box;
    display: grid;
    width: 145px;
    min-height: 72px;
    gap: 0.25rem;
    align-content: center;
    padding: 0.85rem 1rem;
    border: 1px solid #4d67a4;
    border-radius: 10px;
    background: #fff;
    color: #26324b;
    box-shadow: 0 7px 18px rgb(35 45 70 / 13%);
    pointer-events: auto;
    user-select: none;
  }

  :global(.doc-node.compact) {
    width: 108px;
    min-height: 54px;
  }

  :global(.doc-node[data-selected="true"]) {
    outline: 3px solid rgb(76 111 215 / 35%);
  }

  :global(.doc-node span) {
    color: #65708a;
    font-size: 0.78rem;
  }

  .port {
    position: absolute;
    top: calc(50% - 8px);
  }

  .port.left {
    left: -8px;
  }

  .port.right {
    right: -8px;
  }

  :global(.doc-group) {
    border: 1px solid rgb(94 91 180 / 55%);
    border-radius: 12px;
    background: rgb(120 112 210 / 8%);
  }

  :global(.doc-group.inner) {
    border-color: rgb(45 139 116 / 65%);
    background: rgb(65 168 139 / 10%);
  }

  :global(.doc-group [data-snapline-part="group-header"]) {
    display: inline-flex;
    min-height: 30px;
    align-items: center;
    padding: 0 0.75rem;
    border-radius: 9px 9px 0 0;
    background: #5f5aa8;
    color: white;
    font-size: 0.78rem;
  }

  :global(.doc-group.inner [data-snapline-part="group-header"]) {
    background: #348c74;
  }

  :global(.doc-selection) {
    border: 1px solid #5875d6;
    background: rgb(88 117 214 / 14%);
  }

  .palette-button {
    position: absolute;
    z-index: 5;
    top: 0.75rem;
    left: 0.75rem;
    padding: 0.55rem 0.75rem;
    border: 1px solid #536ba8;
    border-radius: 8px;
    background: white;
    color: #29385c;
    cursor: pointer;
  }

  .placement-preview {
    position: absolute;
    z-index: 4;
    display: grid;
    width: 108px;
    height: 54px;
    place-items: center;
    border: 1px dashed #536ba8;
    border-radius: 9px;
    background: rgb(255 255 255 / 75%);
    color: #29385c;
    pointer-events: none;
  }

  :global([data-snapline-type="placement-preview"][data-allowed="false"]) .placement-preview {
    border-color: #b14f4f;
    color: #8b3030;
  }

  .hint {
    min-height: 3rem;
    margin: 0;
    padding: 0.75rem 1rem;
    border-top: 1px solid rgb(70 62 54 / 12%);
    color: #665f57;
    font-size: 0.82rem;
  }
</style>
