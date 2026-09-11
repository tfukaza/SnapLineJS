<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import {
    createRenderEntries,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type Container as SnapSortContainer,
    type ContainerCallbacks,
    type Item as SnapSortItem,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { renderTreeCallbacks } from "../snapsort-render-tree";

  type FixtureCard = { id: string; label: string };

  let cards = $state.raw(
    createRenderTree(
      createRenderEntries<FixtureCard>(
        [
          { id: "resize-dragged", label: "Resize me" },
          { id: "resize-target", label: "Target" },
        ],
        (card) => card.id,
      ),
    ),
  );
  let rootContainer = $state<SnapSortContainer | null>(null);
  let draggedItem = $state<SnapSortItem | null>(null);

  function applyEvent(event: RenderTreeEvent): void {
    cards = reduceRenderTree(cards, event);
  }

  const callbacks = {
    ...renderTreeCallbacks(applyEvent),
    onDragStart(event) {
      event.session.dragVisual = "item";
    },
  } satisfies ContainerCallbacks;

  function startMove(): void {
    if (!draggedItem || !rootContainer) return;
    const session = draggedItem.beginDirectDrag();
    if (!session) return;

    const moveWhenActive = () => {
      if (session.status === "ended") return;
      if (
        session.status === "pending" ||
        draggedItem?.element?.dataset.snapsortDragging !== "true"
      ) {
        requestAnimationFrame(moveWhenActive);
        return;
      }
      if (
        session.status === "active" &&
        session.input.inputType === "direct" &&
        rootContainer
      ) {
        requestAnimationFrame(() => {
          if (
            session.status === "active" &&
            session.input.inputType === "direct" &&
            rootContainer
          ) {
            session.input.moveTo(rootContainer, 1);
          }
        });
      }
    };
    requestAnimationFrame(moveWhenActive);
  }
</script>

<main class="resize-fixture" data-direct-resize-fixture>
  <button type="button" data-start-direct-resize onclick={startMove}>Start move</button>
  <Engine id="direct-resize-engine" style="height:auto;">
    <Container
      itemId="direct-resize-root"
      bind:container={rootContainer}
      className="resize-board"
      config={{
        mode: "swap",
        direction: "row",
        wrap: "nowrap",
        animation: {
          ...defaultAnimations,
          reorder: { duration: 320, timing_function: "linear" },
        },
        callbacks,
      }}
      locked={true}
    >
      {#each cards.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} className="resize-ghost" />
        {:else if entry.childTree}
          <Container itemId={entry.itemId} />
        {:else if entry.itemId === "resize-dragged"}
          <Item
            itemId={entry.itemId}
            bind:item={draggedItem}
            className={`resize-card ${entry.itemId}`}
            data-resize-card={entry.itemId}
          >
            {entry.value.label}
          </Item>
        {:else}
          <Item
            itemId={entry.itemId}
            className={`resize-card ${entry.itemId}`}
            data-resize-card={entry.itemId}
          >
            {entry.value.label}
          </Item>
        {/if}
      {/each}
    </Container>
  </Engine>
</main>

<style>
  .resize-fixture {
    box-sizing: border-box;
    min-height: 100vh;
    padding: 80px;
    background: #f5f5f4;
  }

  .resize-fixture > button {
    margin-bottom: 24px;
  }

  :global(.resize-board) {
    display: flex;
    align-items: flex-start;
    gap: 100px;
  }

  :global(.resize-card),
  :global(.resize-ghost) {
    flex: none;
    box-sizing: border-box;
  }

  :global(.resize-card) {
    padding: 18px;
    border: 1px solid #ccc;
    border-radius: 12px;
    background: white;
  }

  :global(.resize-dragged) {
    width: 280px;
    height: 72px;
  }

  :global(.resize-target) {
    width: 140px;
    height: 132px;
    margin-top: 40px;
  }
</style>
