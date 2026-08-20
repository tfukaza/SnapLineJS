<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    createRenderEntries,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type GhostLifecycleEvent,
    type ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  let emphasized = $state(true);
  let tasks = $state.raw(
    createRenderTree(
      createRenderEntries(
        [
          { id: "alpha", label: "Alpha" },
          { id: "beta", label: "Beta" },
        ],
        (task) => task.id,
      ),
    ),
  );

  function onItemMove(event: ItemMoveEvent) {
    tasks = reduceRenderTree(tasks, event);
  }

  function onGhostMove(event: GhostLifecycleEvent) {
    tasks = reduceRenderTree(tasks, event);
  }

  const callbacks = {
    onItemMove,
    onGhostInsert: onGhostMove,
    onGhostMove,
    onGhostRemove: onGhostMove,
  } satisfies ContainerCallbacks;
</script>

<div class="presentation-demo">
  <button type="button" aria-pressed={emphasized} onclick={() => emphasized = !emphasized}>
    Toggle emphasis
  </button>

  <Engine id="container-property-presentation">
    <Container
      itemId="container-property-presentation-root"
      class={emphasized ? "presentation-shell is-emphasized" : "presentation-shell"}
      className="presentation-list"
      style="--property-accent: #8b5cf6;"
      aria-label="Styled task list"
      data-example-kind="presentation"
      config={{ animation: defaultAnimations, callbacks }}
    >
      {#each tasks.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} />
        {:else}
          <Item itemId={entry.itemId} className="presentation-item">{entry.value.label}</Item>
        {/if}
      {/each}
    </Container>
  </Engine>
</div>

<style>
  .presentation-demo {
    display: grid;
    justify-items: center;
    gap: 0.8rem;
  }

  button {
    padding: 0.4rem 0.8rem;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 999px;
    background: white;
    color: inherit;
    cursor: pointer;
  }

  :global(.presentation-list) {
    gap: 0.5rem;
    width: min(100%, 22rem);
    padding: 0.75rem;
    border: 1px solid rgb(58 42 34 / 16%);
    border-radius: 10px;
    background: white;
    transition: border-color 160ms ease, box-shadow 160ms ease;
    box-sizing: border-box;
  }

  :global(.presentation-shell.is-emphasized) {
    border-color: var(--property-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--property-accent) 16%, transparent);
  }

  :global(.presentation-item) {
    align-items: flex-start !important;
    padding: 0.65rem 0.8rem !important;
    border-radius: 7px;
    background: var(--color-background-tint);
    cursor: grab;
  }
</style>
