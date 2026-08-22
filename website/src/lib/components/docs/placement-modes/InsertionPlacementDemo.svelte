<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type {
    CanDropEvent,
    ContainerCallbacks,
    DropPriorityEvent,
    GhostLifecycleEvent,
    ItemMoveEvent,
    RenderEntry,
    RenderTree,
  } from "@snap-engine/snapsort";
  import {
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import { Container, Ghost } from "@snap-engine/snapsort/svelte";
  import { insertionTreeMarkerOptions } from "./insertionTreeMarker";
  import InsertionPlacementTreeNode from "./InsertionPlacementTreeNode.svelte";
  import type { InsertionTreeItem } from "./InsertionPlacementTreeNode.svelte";
  import PlacementDemoShell from "./PlacementDemoShell.svelte";

  type TreeInput = InsertionTreeItem & { children?: TreeInput[] };

  const initialItems: TreeInput[] = [
    { id: "one", label: "Item 1", kind: "item" },
    { id: "two", label: "Item 2", kind: "item" },
    {
      id: "three",
      label: "Item 3",
      kind: "container",
      children: [
        { id: "four", label: "Item 4", kind: "item" },
        { id: "five", label: "Item 5", kind: "item" },
        {
          id: "six",
          label: "Item 6",
          kind: "container",
          children: [{ id: "seven", label: "Item 7", kind: "item" }],
        },
      ],
    },
    { id: "eight", label: "Item 8", kind: "item" },
  ];

  function createTree(nodes: readonly TreeInput[]): RenderTree<InsertionTreeItem> {
    return createRenderTree(
      nodes.map(({ children, ...item }) =>
        createRenderEntry(
          item,
          item.id,
          item.kind === "container" ? createTree(children ?? []) : null,
        ),
      ),
    );
  }

  function findEntry(
    tree: RenderTree<InsertionTreeItem>,
    itemId: string,
  ): Extract<RenderEntry<InsertionTreeItem>, { isGhost: false }> | null {
    for (const entry of tree.entries) {
      if (entry.isGhost) continue;
      if (entry.itemId === itemId) return entry;
      const nested = entry.childTree
        ? findEntry(entry.childTree, itemId)
        : null;
      if (nested) return nested;
    }
    return null;
  }

  let tree = $state.raw(createTree(initialItems));

  function reduce(event: ItemMoveEvent | GhostLifecycleEvent) {
    tree = reduceRenderTree(tree, event);
  }

  function canDropInTree(event: CanDropEvent): boolean {
    const containerId = event.containerMetadata.containerId;
    if (typeof containerId !== "string") return true;

    return event.itemIds.every((itemId) => {
      const entry = findEntry(tree, String(itemId));
      if (!entry) return true;
      return (
        entry.itemId !== containerId &&
        (!entry.childTree || !findEntry(entry.childTree, containerId))
      );
    });
  }

  function prioritizePointerDepth(event: DropPriorityEvent): number {
    const { pointer, containerRect, depth, staticPriority } = event;
    const containsPointer =
      pointer.x >= containerRect.x &&
      pointer.x <= containerRect.x + containerRect.width &&
      pointer.y >= containerRect.y &&
      pointer.y <= containerRect.y + containerRect.height;
    return containsPointer ? depth + 1 : staticPriority;
  }

  const nestedCallbacks = {
    canDrop: canDropInTree,
    getDropPriority: prioritizePointerDepth,
  } satisfies ContainerCallbacks;

  const rootCallbacks = {
    onItemMove: reduce,
    onGhostInsert: reduce,
    onGhostMove: reduce,
    onGhostRemove: reduce,
    ...nestedCallbacks,
  } satisfies ContainerCallbacks;
</script>

<PlacementDemoShell>
  <Engine id="placement-mode-insertion-default">
    <Container
      itemId="placement-insertion-default-root"
      className="insertion-demo-tree card"
      metadata={{ containerId: "root" }}
      config={{
        animation: defaultAnimations,
        mode: "insertion",
        direction: "column",
        callbacks: rootCallbacks,
      }}
    >
      {#each tree.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          {#if entry.ghost.type === "insertion-marker"}
            <Ghost
              ghost={entry.ghost}
              className="insertion-tree-marker"
              insertionMarker={insertionTreeMarkerOptions(entry.ghost)}
            />
          {:else}
            <Ghost ghost={entry.ghost} />
          {/if}
        {:else}
          <InsertionPlacementTreeNode
            {entry}
            callbacks={nestedCallbacks}
          />
        {/if}
      {/each}
    </Container>
  </Engine>
</PlacementDemoShell>

<style>
  :global(.insertion-demo-tree) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: min(100%, 24rem);
    margin: 0 auto;
    padding: var(--size-8) 0;
    gap: 0 !important;
    overflow: hidden;
    border-color: color-mix(
      in srgb,
      var(--color-background-dark) 22%,
      transparent
    );
    border-radius: var(--ui-radius);
    background: var(--color-background);
    box-shadow: 0 10px 30px
      color-mix(in srgb, var(--color-background-dark) 8%, transparent);
    box-sizing: border-box;
  }

  :global(.insertion-demo-tree [data-snapsort-ghost="insertion"]) {
    height: 0 !important;
    min-height: 0;
    padding: 0;
    border: 0 !important;
    border-top: 3px solid var(--color-primary) !important;
    border-radius: 999px !important;
    background: transparent !important;
    color: var(--color-primary) !important;
  }
</style>
