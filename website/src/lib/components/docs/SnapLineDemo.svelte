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

  const plusGridCells = Array.from({ length: 240 }, (_, index) => index);
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
    <div class="demo-shell slot shallow">
      {#if mode === "placement"}
        <button class="palette-button button small" type="button" onclick={beginPlacement}>
          Place a node
        </button>
      {/if}
      <Engine bind:engine id={`snapline-doc-${mode}`} className="demo-engine">
        <div class="grid" data-demo-background aria-hidden="true">
          {#each plusGridCells as cell (cell)}
            <span>+</span>
          {/each}
        </div>
        {#if mode === "connections"}
          <ControlledGraph {lines} onLineChangeRequest={applyRequest} />
          <Node className="doc-node card shallow" x={55} y={80}>
            <strong>Source</strong>
            <span>Drag the port</span>
            <div class="port right"><Connector id="source:value" name="value" rules={{ maxIncoming: 0 }} /></div>
          </Node>
          <Node className="doc-node card shallow" x={310} y={155}>
            <strong>Result</strong>
            <span>Drop it here</span>
            <div class="port left">
              <Connector id="result:value" name="value" rules={{ maxOutgoing: 0, maxIncoming: 1, onFull: "replace-oldest" }} />
            </div>
          </Node>
        {:else if mode === "selection"}
          <!-- minWidth/minHeight must match .doc-node.compact's CSS floor: the
               engine clamps against these, and a smaller clamp would let it
               author sizes the stylesheet refuses to render, drifting the
               anchored edge on a north or west resize. -->
          <Select className="doc-selection" />
          <Node className="doc-node compact card shallow" x={65} y={70} resizable minWidth={108} minHeight={54}><strong>One</strong></Node>
          <Node className="doc-node compact card shallow" x={245} y={105} resizable minWidth={108} minHeight={54}><strong>Two</strong></Node>
          <Node className="doc-node compact card shallow" x={155} y={210} resizable minWidth={108} minHeight={54}><strong>Three</strong></Node>
        {:else if mode === "groups"}
          <Group className="doc-group outer" x={28} y={35} width={430} height={245} title="Outer group" />
          <Group className="doc-group inner" x={90} y={95} width={235} height={130} title="Nested group" />
          <Node className="doc-node compact card shallow" x={130} y={145}><strong>Nested</strong></Node>
          <Node className="doc-node compact card shallow" x={350} y={150}><strong>Direct</strong></Node>
        {:else if mode === "placement"}
          {#if placement}
            <Placement controller={placement} cancelOnOutside={false}>
              {#snippet preview(snapshot)}
                <div class="placement-preview card shallow">Node</div>
              {/snippet}
            </Placement>
          {/if}
          {#each placedNodes as placed (placed.id)}
            <Node className="doc-node compact card shallow" x={placed.x} y={placed.y}>
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
    width: min(100%, var(--doc-reading-width, 700px));
    margin: var(--size-24) auto var(--size-48);
  }

  .demo-shell {
    position: relative;
    overflow: hidden;
    min-height: 22rem;
    border-radius: var(--ui-radius);
    background: var(--color-background-tint);
    color: var(--color-text);
    font-family: var(--font-body);
  }

  :global(.demo-engine) {
    min-height: 19rem;
    touch-action: none;
  }

  .grid {
    position: absolute;
    inset: var(--size-8);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
    grid-auto-rows: 36px;
    overflow: hidden;
    pointer-events: auto;
    color: rgb(0 0 0 / 8%);
    font-family: var(--font-label);
    font-size: 10px;
    font-weight: 300;
    line-height: 1;
    place-items: center;
    user-select: none;
    mask-image: linear-gradient(to bottom, rgb(0 0 0 / 78%), rgb(0 0 0 / 28%));
  }

  .grid span {
    margin: 0;
    color: inherit;
    font: inherit;
    pointer-events: none;
  }

  :global(.doc-node) {
    --card-color: var(--color-background);
    --card-radius: var(--ui-radius);

    box-sizing: border-box;
    display: grid;
    width: 145px;
    min-height: 72px;
    gap: var(--size-4);
    align-content: center;
    padding: var(--size-12) var(--size-16);
    color: var(--color-text);
    pointer-events: auto;
    user-select: none;
  }

  :global(.doc-node.compact) {
    width: 108px;
    min-height: 54px;
  }

  :global(.doc-node[data-selected="true"]) {
    outline: 3px solid color-mix(in srgb, var(--color-primary) 38%, transparent);
    outline-offset: 3px;
  }

  :global(.doc-node strong) {
    color: var(--color-text);
    font-family: var(--font-label);
    font-size: 0.9rem;
    font-weight: 350;
    line-height: var(--leading-label);
  }

  :global(.doc-node span) {
    color: var(--color-text-muted);
    font-family: var(--font-body);
    font-size: var(--type-caption);
    line-height: var(--leading-caption);
  }

  .port {
    position: absolute;
    top: calc(50% - 9px);
  }

  .port.left {
    left: -9px;
  }

  .port.right {
    right: -9px;
  }

  .snapline-demo :global([data-snapline-type="connector"]) {
    box-sizing: border-box;
    width: 18px;
    height: 18px;
    border: 3px solid var(--color-background);
    background: var(--color-primary);
    box-shadow:
      2px 2px 3px -1px rgb(31 30 41 / 28%),
      1px 1px 1px rgb(255 255 255 / 38%) inset;
  }

  .snapline-demo :global([data-snapline-type="connector"]:focus-visible) {
    outline: 2px solid var(--color-action);
    outline-offset: 3px;
  }

  .snapline-demo :global([data-snapline-type="connector-line"] path) {
    stroke: var(--color-primary);
    stroke-width: 3;
    filter: drop-shadow(1px 2px 1.5px rgb(31 30 41 / 18%));
  }

  .snapline-demo :global([data-snapline-type="connector-line"] marker polygon) {
    fill: var(--color-primary);
  }

  :global(.doc-group) {
    border: 1px solid color-mix(in srgb, var(--color-primary) 44%, transparent);
    border-radius: var(--ui-radius);
    background: color-mix(in srgb, var(--color-primary) 7%, transparent);
    user-select: none;
  }

  :global(.doc-group.inner) {
    border-color: color-mix(in srgb, var(--color-secondary-1) 44%, transparent);
    background: color-mix(in srgb, var(--color-secondary-1) 7%, transparent);
  }

  :global(.doc-group [data-snapline-part="group-header"]) {
    display: flex;
    width: 100%;
    min-height: 30px;
    align-items: center;
    padding: 0 var(--size-12);
    border-radius: calc(var(--ui-radius) - 1px) calc(var(--ui-radius) - 1px) 0 0;
    background: var(--color-primary);
    color: white;
    font-family: var(--font-label);
    font-size: 0.8rem;
    font-weight: 350;
    line-height: var(--leading-label);
    box-sizing: border-box;
    box-shadow:
      1px 1px 1px rgb(255 255 255 / 35%) inset,
      2px 2px 4px -2px rgb(31 30 41 / 30%);
    user-select: none;
  }

  :global(.doc-group.inner [data-snapline-part="group-header"]) {
    background: var(--color-secondary-1);
  }

  :global(.doc-selection) {
    border: 1px solid var(--color-primary);
    border-radius: var(--size-4);
    background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  }

  .palette-button {
    position: absolute;
    z-index: 5;
    top: var(--size-12);
    left: var(--size-12);
    font-family: var(--font-body);
  }

  .placement-preview {
    --card-color: color-mix(in srgb, var(--color-background) 92%, transparent);
    --card-radius: var(--ui-radius);

    position: absolute;
    z-index: 4;
    display: grid;
    width: 108px;
    height: 54px;
    place-items: center;
    padding: 0;
    border: 1px dashed var(--color-primary);
    color: var(--color-text);
    font-family: var(--font-label);
    font-size: 0.9rem;
    font-weight: 350;
    pointer-events: none;
  }

  :global([data-snapline-type="placement-preview"][data-allowed="false"]) .placement-preview {
    border-color: var(--color-secondary-1);
    color: color-mix(in srgb, var(--color-secondary-1) 72%, var(--color-text));
  }

  .hint {
    min-height: 3rem;
    margin: 0;
    padding: var(--size-12) var(--size-16);
    border-top: 1px solid
      color-mix(in srgb, var(--color-background-dark) 18%, transparent);
    background: color-mix(in srgb, var(--color-background) 72%, transparent);
    color: var(--color-text-muted);
    font-family: var(--font-body);
    font-size: var(--type-caption);
    line-height: var(--leading-caption);
    box-sizing: border-box;
  }

  @media (max-width: 640px) {
    .snapline-demo {
      margin-bottom: var(--size-32);
    }

    .demo-shell {
      min-height: 20rem;
    }

    :global(.demo-engine) {
      min-height: 17rem;
    }
  }
</style>
