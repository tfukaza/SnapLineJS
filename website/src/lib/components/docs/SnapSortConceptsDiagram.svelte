<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { defaultAnimations, type CanDropEvent, type ItemMoveEvent } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";

  type DiagramItem = { id: string; kind: "item" };
  type DiagramContainer = { id: string; kind: "container" };
  type DiagramEntry = DiagramItem | DiagramContainer;

  let outerEntries = $state<DiagramEntry[]>([
    { id: "2", kind: "item" },
    { id: "3", kind: "item" },
    { id: "4", kind: "container" },
  ]);
  let nestedItems = $state<DiagramItem[]>([
    { id: "5", kind: "item" },
    { id: "6", kind: "item" },
  ]);

  function handleMove(event: ItemMoveEvent) {
    const itemId = String(event.itemId);
    const destination = event.to.containerMetadata.zone;
    if (destination !== "outer" && destination !== "nested") return;

    const movedEntry = [...outerEntries, ...nestedItems].find(
      (entry) => entry.id === itemId,
    );
    if (!movedEntry || (destination === "nested" && movedEntry.kind === "container")) return;

    outerEntries = outerEntries.filter((entry) => entry.id !== itemId);
    nestedItems = nestedItems.filter((item) => item.id !== itemId);

    if (destination === "outer") {
      const next = [...outerEntries];
      next.splice(Math.min(event.to.index, next.length), 0, movedEntry);
      outerEntries = next;
    } else {
      const next = [...nestedItems];
      next.splice(Math.min(event.to.index, next.length), 0, movedEntry as DiagramItem);
      nestedItems = next;
    }
  }

  function canDrop(event: CanDropEvent) {
    return !(
      event.itemIds.map(String).includes("4") &&
      event.containerMetadata.zone === "nested"
    );
  }

  const callbacks = { onItemMove: handleMove, canDrop };
</script>

<figure class="snapsort-concepts-diagram" aria-label="Interactive SnapSort hierarchy">
  <div class="snapsort-concepts-surface">
    <ClientDemoFrame className="snapsort-concepts-skeleton">
      <Engine id="snapsort-core-concepts">
        <div class="snapsort-concepts-engine slot shallow">
          <div class="snapsort-concepts-engine-label">Engine</div>
          <div class="snapsort-concepts-containers">
          <Container
            itemId="1"
            className="snapsort-concepts-container slot shallow"
            metadata={{ zone: "outer" }}
            config={{ animation: defaultAnimations, mode: "progressive", direction: "column", callbacks }}
            items={outerEntries}
          >
            {#snippet before()}
              <header><strong>Root Container</strong><code>itemId: 1</code></header>
            {/snippet}
            {#snippet entry(outerEntry)}
              {#if outerEntry.kind === "item"}
                <Item itemId={outerEntry.id} className="snapsort-concepts-item card shallow">
                  <span>Item</span><code>itemId: {outerEntry.id}</code>
                </Item>
              {:else}
                <Container
                  itemId={outerEntry.id}
                  locked={false}
                  className="snapsort-concepts-container is-nested slot shallow"
                  metadata={{ zone: "nested" }}
                  config={{ animation: defaultAnimations, mode: "progressive", direction: "column", callbacks }}
                  items={nestedItems}
                >
                  {#snippet before()}
                    <header><strong>Container</strong><code>itemId: {outerEntry.id}</code></header>
                  {/snippet}
                  {#snippet entry(item)}
                    <Item itemId={item.id} className="snapsort-concepts-item card shallow">
                      <span>Item</span><code>itemId: {item.id}</code>
                    </Item>
                  {/snippet}
                  {#snippet ghost(event)}
                    <Ghost {event} className="snapsort-concepts-ghost">
                      <span>ghost</span>
                    </Ghost>
                  {/snippet}
                </Container>
              {/if}
            {/snippet}
            {#snippet ghost(event)}
              <Ghost {event} className="snapsort-concepts-ghost">
                <span>ghost</span>
              </Ghost>
            {/snippet}
            </Container>
          </div>
        </div>
      </Engine>
    </ClientDemoFrame>
  </div>
</figure>
