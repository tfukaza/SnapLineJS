<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { ItemMoveEvent } from "@snap-engine/snapsort";
  import { Container, Item } from "@snap-engine/snapsort/svelte";

  let emphasized = $state(true);
  let tasks = $state([
    { id: "alpha", label: "Alpha" },
    { id: "beta", label: "Beta" },
  ]);

  function onItemMove(event: ItemMoveEvent) {
    const task = tasks.find((entry) => entry.id === event.itemId);
    if (!task) return;
    const next = tasks.filter((entry) => entry.id !== event.itemId);
    next.splice(Math.min(event.to.index, next.length), 0, task);
    tasks = next;
  }
</script>

<div class="presentation-demo">
  <button type="button" aria-pressed={emphasized} onclick={() => emphasized = !emphasized}>
    Toggle emphasis
  </button>

  <Engine id="container-property-presentation">
    <Container
      class={emphasized ? "presentation-shell is-emphasized" : "presentation-shell"}
      className="presentation-list"
      style="--property-accent: #8b5cf6;"
      aria-label="Styled task list"
      data-example-kind="presentation"
      items={tasks}
      config={{ callbacks: { onItemMove } }}
    >
      {#snippet entry(task)}
        <Item itemId={task.id} className="presentation-item">{task.label}</Item>
      {/snippet}
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
