<script lang="ts">
  import { Camera, Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import {
    createRenderEntries,
    createRenderTree,
    reduceRenderTree,
    type ContainerCallbacks,
  } from "@snap-engine/snapsort";
  import { renderTreeCallbacks } from "../snapsort-render-tree";

  // A padded, bordered, wrapping SnapSort grid inside a zoomable Camera. Three
  // 120x40 cards with 8px margins exactly fill each row, so the drop
  // prediction has to measure world-space geometry to keep rows whole at any
  // zoom.
  const cards = Array.from({ length: 8 }, (_, index) => ({
    id: `card-${index + 1}`,
    label: `Card ${index + 1}`,
  }));
  let tree = $state.raw(
    createRenderTree(createRenderEntries(cards, (card) => card.id)),
  );
  const callbacks = {
    ...renderTreeCallbacks((event) => (tree = reduceRenderTree(tree, event))),
  } satisfies ContainerCallbacks;
</script>

<Engine id="snapsort-camera-canvas">
  <Camera
    id="snapsort-camera"
    cameraConfig={{ zoomBounds: { min: 0.2, max: 2 } }}
    pointerPanLock={true}
  >
    <div class="camera-layer">
      <Container
        itemId="camera-root"
        className="camera-grid"
        config={{ direction: "row", name: "camera-root", callbacks }}
        locked={true}
      >
        {#each tree.entries as entry (entry.itemId)}
          {#if entry.isGhost}
            <Ghost ghost={entry.ghost} className="camera-card camera-ghost" />
          {:else}
            <Item
              itemId={entry.itemId}
              className="camera-card"
              data-card-id={entry.itemId}
            >
              {entry.value.label}
            </Item>
          {/if}
        {/each}
      </Container>
    </div>
  </Camera>
</Engine>

<style>
  :global(#snapsort-camera-canvas) {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #f5f5f4;
  }

  .camera-layer {
    position: absolute;
    left: 40px;
    top: 40px;
  }

  :global(.camera-grid) {
    box-sizing: content-box;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 0;
    width: 408px;
    padding: 6px;
    border: 2px solid #3f3f46;
    background: white;
  }

  :global(.camera-card) {
    box-sizing: border-box;
    width: 120px;
    height: 40px;
    margin: 8px;
    border: 1px solid #a1a1aa;
    border-radius: 6px;
    background: #fafafa;
    font: 14px/38px system-ui, sans-serif;
    text-align: center;
    user-select: none;
  }

  :global(.camera-ghost) {
    border-style: dashed;
    background: transparent;
  }
</style>
