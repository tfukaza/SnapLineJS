<script lang="ts" module>
  export type TreeNodeData = {
    id: string;
    name: string;
    kind: "folder" | "file";
    open?: boolean;
    active?: boolean;
    children?: TreeNodeData[];
  };
</script>

<script lang="ts">
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import type { RenderTree } from "@snap-engine/snapsort";
  import FileTreeNode from "./FileTreeNode.svelte";

  let {
    node,
    tree,
    depth = 0,
    onToggleFolder,
  }: {
    node: TreeNodeData;
    tree: RenderTree<TreeNodeData> | null;
    depth?: number;
    onToggleFolder: (nodeId: string) => void;
  } = $props();

  const treeAnimation = {
    duration: 260,
    timing_function: "cubic-bezier(0.2, 0, 0, 1)",
  };

  function handleChevronPointerDown(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleChevronClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onToggleFolder(node.id);
  }
</script>

{#if node.kind === "folder"}
  <Container
    itemId={node.id}
    className={`tree-node tree-folder depth-${depth}${node.active ? " active" : ""}`}
    config={{
      mode: "insertion",
      direction: "column",
      name: `code-file-tree-${node.id}`,
      callbacks: node.open === false ? { canDrop: rejectDrop } : undefined,
      animation: {
        reorder: treeAnimation,
        drop: treeAnimation,
      },
    }}
    locked={false}
    metadata={{
      containerId: node.id,
    }}
  >
    <div class="tree-row folder-row" style={`--depth: ${depth}`}>
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

    {#if node.open !== false && tree}
      {#each tree.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          {#if entry.ghost.type === "insertion-marker"}
            <Ghost
              ghost={entry.ghost}
              insertionMarker={{
                thickness: 3,
                startInset: 8,
                endInset: 8,
              }}
            />
          {:else}
            <Ghost ghost={entry.ghost} />
          {/if}
        {:else if entry.childTree}
          <FileTreeNode node={entry.value} tree={entry.childTree} depth={depth + 1} {onToggleFolder} />
        {:else}
          <FileTreeNode node={entry.value} tree={null} depth={depth + 1} {onToggleFolder} />
        {/if}
      {/each}
    {/if}
  </Container>
{:else}
  <Item
    itemId={node.id}
    className={`tree-row file-row depth-${depth}${node.active ? " active" : ""}`}
    style={`--depth: ${depth}`}
  >
    <span class="indent" aria-hidden="true"></span>
    <span class="chevron-spacer" aria-hidden="true"></span>
    <span class="file-icon" aria-hidden="true"></span>
    <span class="row-name">{node.name}</span>
  </Item>
{/if}
