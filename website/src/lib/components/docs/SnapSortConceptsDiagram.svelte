<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type DropPriorityEvent,
    type GhostLifecycleEvent,
    type ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";

  type DiagramItem = { id: string; kind: "item" };
  type DiagramContainer = { id: string; kind: "container" };
  type DiagramEntry = DiagramItem | DiagramContainer;

  let diagram = $state.raw(
    createRenderTree<DiagramEntry>([
      createRenderEntry({ id: "2", kind: "item" }, "2"),
      createRenderEntry({ id: "3", kind: "item" }, "3"),
      createRenderEntry(
        { id: "4", kind: "container" },
        "4",
        createRenderTree(
          createRenderEntries<DiagramEntry>(
            [
              { id: "5", kind: "item" },
              { id: "6", kind: "item" },
            ],
            (item) => item.id,
          ),
        ),
      ),
    ]),
  );

  function handleMove(event: ItemMoveEvent) {
    diagram = reduceRenderTree(diagram, event);
  }

  function handleGhost(event: GhostLifecycleEvent) {
    diagram = reduceRenderTree(diagram, event);
  }

  function getDropPriority(event: DropPriorityEvent) {
    const rejected =
      event.itemIds.includes("4") &&
      event.containerMetadata.zone === "nested";
    return rejected ? rejectDrop(event) : undefined;
  }

  const callbacks = {
    onItemMove: handleMove,
    onGhostInsert: handleGhost,
    onGhostMove: handleGhost,
    onGhostRemove: handleGhost,
    getDropPriority,
  } satisfies ContainerCallbacks;
</script>

<figure class="snapsort-concepts-diagram" aria-label="Interactive SnapSort hierarchy">
  <div class="snapsort-concepts-surface">
    <ClientDemoFrame className="snapsort-concepts-skeleton">
      <Engine id="snapsort-core-concepts">
        <div class="snapsort-concepts-engine slot shallow">
          <div class="snapsort-concepts-engine-label">Engine</div>
          <div class="snapsort-concepts-containers">
          <Container
            itemId="concepts-root"
            className="snapsort-concepts-container slot shallow"
            metadata={{ zone: "outer" }}
            config={{ animation: defaultAnimations, mode: "progressive", direction: "column", callbacks }}
          >
            <header><strong>Root Container</strong><code>itemId: concepts-root</code></header>
            {#each diagram.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} className="snapsort-concepts-ghost">
                  <span>ghost</span>
                </Ghost>
              {:else if entry.childTree}
                <Container
                  itemId={entry.itemId}
                  locked={false}
                  className="snapsort-concepts-container is-nested slot shallow"
                  metadata={{ zone: "nested" }}
                  config={{ animation: defaultAnimations, mode: "progressive", direction: "column", callbacks: { getDropPriority } }}
                >
                  <header><strong>Container</strong><code>itemId: {entry.itemId}</code></header>
                  {#each entry.childTree.entries as child (child.itemId)}
                    {#if child.isGhost}
                      <Ghost ghost={child.ghost} className="snapsort-concepts-ghost">
                        <span>ghost</span>
                      </Ghost>
                    {:else if child.childTree}
                      <Container itemId={child.itemId} />
                    {:else}
                      <Item itemId={child.itemId} className="snapsort-concepts-item card shallow">
                        <span>Item</span><code>itemId: {child.itemId}</code>
                      </Item>
                    {/if}
                  {/each}
                </Container>
              {:else}
                <Item itemId={entry.itemId} className="snapsort-concepts-item card shallow">
                  <span>Item</span><code>itemId: {entry.itemId}</code>
                </Item>
              {/if}
            {/each}
            </Container>
          </div>
        </div>
      </Engine>
    </ClientDemoFrame>
  </div>
</figure>
