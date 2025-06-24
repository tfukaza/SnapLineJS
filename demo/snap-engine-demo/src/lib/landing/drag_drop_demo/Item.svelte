<script lang="ts">
  import { onMount, getContext, onDestroy } from "svelte";
  import { ItemContainer } from "../../../../../../src/asset/drag_and_drop/container";
  import { ItemObject } from "../../../../../../src/asset/drag_and_drop/item";
  import type { SnapLine } from "../../../../../../src/index";
  import "../../../app.scss";

  let { children }: { children: any } = $props();
  const engine: SnapLine = getContext("engine");
  const itemContainer: ItemContainer = getContext("itemContainer");

  let itemObject: ItemObject = new ItemObject(engine.global, null);

  onMount(() => {
    itemContainer.addItem(itemObject);
  });

  onDestroy(() => {
    itemObject.destroy();
  });
</script>

<div class="item-wrapper" bind:this={itemObject.element}>
  <div class="card item">
    {@render children()}
  </div>
</div>

<style>
  .item-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0px var(--size-4);
    box-sizing: border-box;
    height: var(--item-height);
  }

  .item {
    padding: 8px 12px;
  }

  .card {
  }

  @media (max-width: 600px) and (min-width: 401px) {
    .item {
      padding: var(--size-8);
    }
  }

  @media (max-width: 400px) {
    .item {
      padding: 6px 8px 4px 8px;
      border-radius: 8px;
      :global(p) {
        font-size: 0.8rem;
      }
    }
  }
</style>
