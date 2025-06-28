<script lang="ts">
  import { ItemContainer } from "../../../../../../src/asset/drag_and_drop/container";
  import type { ItemContainerConfig } from "../../../../../../src/asset/drag_and_drop/container";

  import { getContext, setContext, onMount } from "svelte";
  import type { SnapLine } from "../../../../../../src/index";

  let { config, children }: { config: ItemContainerConfig; children: any } =
    $props();
  const engine: SnapLine = getContext("engine");
  let itemContainer: ItemContainer = new ItemContainer(engine.global, null, config);

  setContext("itemContainer", itemContainer);
</script>

<div
  class="container"
  style="flex-direction: {config.direction}"
  bind:this={itemContainer.element}
>
  {@render children()}
</div>

<style>
  .container {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    width: 100%;
  }
</style>
