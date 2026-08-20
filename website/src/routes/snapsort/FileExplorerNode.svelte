<script lang="ts" module>
  export type FileExplorerNodeData = {
    id: string;
    name: string;
    kind: "folder" | "file";
    open?: boolean;
    active?: boolean;
  };
</script>

<script lang="ts">
  import {
    Container,
    Ghost,
    Item,
  } from "@snap-engine/snapsort/svelte";
  import type { ContainerCallbacks, RenderEntry } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import FileExplorerNode from "./FileExplorerNode.svelte";

  let {
    entry,
    depth = 0,
    callbacks,
    onToggleFolder,
    selectedIds,
    onSelectNode,
  }: {
    entry: Extract<RenderEntry<FileExplorerNodeData>, { isGhost: false }>;
    depth?: number;
    callbacks: Pick<ContainerCallbacks, "canDrop">;
    onToggleFolder: (nodeId: string) => void;
    selectedIds: Set<string>;
    onSelectNode: (nodeId: string, event: MouseEvent | KeyboardEvent) => void;
  } = $props();

  const node = $derived(entry.value);

  const fileTreeAnimation = {
    duration: 260,
    timing_function: "cubic-bezier(0.2, 0, 0, 1)",
  };

  const isSelected = $derived(selectedIds.has(node.id));

  function handleChevronPointerDown(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleChevronClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onToggleFolder(node.id);
  }

  function handleRowClick(event: MouseEvent) {
    onSelectNode(node.id, event);
  }

  function handleRowKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectNode(node.id, event);
  }
</script>

{#if node.kind === "folder"}
  <Container
    className={`tree-node tree-folder depth-${depth}${node.active ? " active" : ""}`}
    config={{
      mode: "insertion",
      direction: "column",
      name: `website-file-explorer-${node.id}`,
      callbacks: {
        canDrop: node.open === false ? rejectDrop : callbacks.canDrop,
      },
      animation: {
        reorder: fileTreeAnimation,
        drop: fileTreeAnimation,
      },
    }}
    locked={false}
    selected={isSelected}
    itemId={entry.itemId}
    metadata={{
      containerId: node.id,
    }}
  >
    <div
      class="tree-row folder-row"
      class:selected={isSelected}
      style={`--depth: ${depth}`}
      onclick={handleRowClick}
      onkeydown={handleRowKeydown}
      role="button"
      tabindex="0"
    >
      <span class="indent" aria-hidden="true"></span>
      <button
        type="button"
        class:open={node.open !== false}
        class="chevron"
        aria-label={node.open !== false ? `Collapse ${node.name}` : `Expand ${node.name}`}
        onpointerdown={handleChevronPointerDown}
        onclick={handleChevronClick}
      ></button>
      <span class="folder-icon" aria-hidden="true"></span>
      <span class="row-name">{node.name}</span>
    </div>

    {#if node.open !== false && entry.childTree}
      {#each entry.childTree.entries as child (child.itemId)}
        {#if child.isGhost}
          {#if child.ghost.type === "insertion-marker"}
            <Ghost
              ghost={child.ghost}
              insertionMarker={{
                thickness: 3,
                startInset: 8,
                endInset: 8,
              }}
            />
          {:else}
            <Ghost ghost={child.ghost} />
          {/if}
        {:else}
          <FileExplorerNode entry={child} depth={depth + 1} {callbacks} {onToggleFolder} {selectedIds} {onSelectNode} />
        {/if}
      {/each}
    {/if}
  </Container>
{:else}
  <Item
    itemId={entry.itemId}
    className={`tree-row file-row depth-${depth}${node.active ? " active" : ""}${isSelected ? " selected" : ""}`}
    selected={isSelected}
    onclick={handleRowClick}
    style={`--depth: ${depth}`}
  >
    <span class="indent" aria-hidden="true"></span>
    <span class="chevron-spacer" aria-hidden="true"></span>
    <span class="file-icon" aria-hidden="true"></span>
    <span class="row-name">{node.name}</span>
  </Item>
{/if}
