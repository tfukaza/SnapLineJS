<script lang="ts" module>
  export type InsertionTreeItem = {
    id: string;
    label: string;
    kind: "container" | "item";
  };
</script>

<script lang="ts">
  import type { ContainerCallbacks, RenderEntry } from "@snap-engine/snapsort";
  import { defaultAnimations } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import { insertionTreeMarkerOptions } from "./insertionTreeMarker";
  import InsertionPlacementTreeNode from "./InsertionPlacementTreeNode.svelte";

  let {
    entry,
    depth = 0,
    callbacks,
  }: {
    entry: Extract<RenderEntry<InsertionTreeItem>, { isGhost: false }>;
    depth?: number;
    callbacks: Pick<ContainerCallbacks, "canDrop" | "getDropPriority">;
  } = $props();

  const value = $derived(entry.value);
  const nodeIndent = $derived(depth === 0 ? "0px" : "var(--size-20)");
  const guideOpacity = $derived(depth === 0 ? 0 : 1);
</script>

{#if value.kind === "container"}
  <Container
    itemId={entry.itemId}
    data-placement-tree-id={entry.itemId}
    className="insertion-tree-group"
    style={`--tree-node-indent: ${nodeIndent}; --tree-guide-opacity: ${guideOpacity}`}
    locked={false}
    metadata={{ containerId: entry.itemId }}
    config={{
      mode: "insertion",
      direction: "column",
      callbacks,
      animation: defaultAnimations,
    }}
  >
    <div class="insertion-tree-row insertion-tree-group-row">
      <span class="insertion-tree-guide" aria-hidden="true"></span>
      <span class="insertion-tree-chevron" aria-hidden="true"></span>
      <span class="insertion-tree-container-icon" aria-hidden="true"></span>
      <span class="insertion-tree-label">{value.label}</span>
    </div>

    {#if entry.childTree}
      {#each entry.childTree.entries as child (child.itemId)}
        {#if child.isGhost}
          {#if child.ghost.type === "insertion-marker"}
            <Ghost
              ghost={child.ghost}
              className="insertion-tree-marker"
              insertionMarker={insertionTreeMarkerOptions(child.ghost)}
            />
          {:else}
            <Ghost ghost={child.ghost} />
          {/if}
        {:else}
          <InsertionPlacementTreeNode
            entry={child}
            depth={depth + 1}
            {callbacks}
          />
        {/if}
      {/each}
    {/if}
  </Container>
{:else}
  <Item
    itemId={entry.itemId}
    metadata={{ label: value.label }}
    className="insertion-tree-row insertion-tree-item"
    style={`--tree-node-indent: ${nodeIndent}; --tree-guide-opacity: ${guideOpacity}`}
  >
    <span class="insertion-tree-guide" aria-hidden="true"></span>
    <span class="insertion-tree-chevron-spacer" aria-hidden="true"></span>
    <span class="insertion-tree-item-icon" aria-hidden="true"></span>
    <span class="insertion-tree-label">{value.label}</span>
  </Item>
{/if}

<style>
  :global(.insertion-tree-group) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: calc(100% - var(--tree-node-indent)) !important;
    margin: 0 0 0 var(--tree-node-indent) !important;
    padding: 0;
    gap: 0 !important;
    border: 0 !important;
    border-radius: 0;
    background: transparent;
    box-sizing: border-box;
  }

  :global(.insertion-tree-row) {
    position: relative;
    display: grid !important;
    grid-template-columns: 14px 16px minmax(0, 1fr);
    align-items: center !important;
    justify-content: initial !important;
    width: 100% !important;
    min-height: 30px;
    margin: 0 !important;
    padding: 3px var(--size-8) !important;
    border: 0 !important;
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    box-sizing: border-box;
    cursor: grab;
    touch-action: none;
  }

  :global(.insertion-tree-item) {
    width: calc(100% - var(--tree-node-indent)) !important;
    margin-left: var(--tree-node-indent) !important;
  }

  :global(.insertion-tree-row:hover) {
    background: color-mix(in srgb, var(--color-primary) 9%, transparent);
  }

  :global(.insertion-tree-item[data-snapsort-dragging="true"]),
  :global(
      .insertion-tree-group[data-snapsort-dragging="true"]
        > .insertion-tree-group-row
    ) {
    background: color-mix(
      in srgb,
      var(--color-primary) 16%,
      var(--color-background)
    );
    color: var(--color-action);
    cursor: grabbing;
  }

  :global(.insertion-tree-guide) {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(0px - var(--size-12));
    width: 1px;
    background: color-mix(
      in srgb,
      var(--color-background-dark) 18%,
      transparent
    );
    opacity: var(--tree-guide-opacity);
    pointer-events: none;
  }

  :global(.insertion-tree-chevron),
  :global(.insertion-tree-chevron-spacer) {
    position: relative;
    width: 14px;
    height: 14px;
  }

  :global(.insertion-tree-chevron::before) {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 6px;
    height: 6px;
    border-right: 1.5px solid var(--color-text-subtle);
    border-bottom: 1.5px solid var(--color-text-subtle);
    transform: rotate(45deg);
  }

  :global(.insertion-tree-container-icon),
  :global(.insertion-tree-item-icon) {
    position: relative;
    width: 14px;
    height: 14px;
  }

  :global(.insertion-tree-container-icon::before) {
    content: "";
    position: absolute;
    inset: 2px;
    border: 1.5px solid var(--color-action);
    border-radius: var(--size-2);
    box-shadow:
      3px 3px 0 -1px var(--color-background),
      3px 3px 0 0
        color-mix(in srgb, var(--color-action) 55%, transparent);
  }

  :global(.insertion-tree-item-icon::before) {
    content: "";
    position: absolute;
    inset: 3px;
    border: 1.5px solid
      color-mix(in srgb, var(--color-text-subtle) 72%, transparent);
    border-radius: var(--size-2);
    transform: rotate(45deg);
  }

  :global(.insertion-tree-label) {
    min-width: 0;
    overflow: hidden;
    color: inherit;
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.76rem;
    font-weight: 350;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
