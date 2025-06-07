<script lang="ts">
    import { ItemContainer} from "../../../../../src/asset/drag_and_drop/container";
    import { getContext, setContext } from "svelte";
    import type { SnapLine } from "../../../../../src/index";

    let { direction, children }: { direction: "column" | "row", children: any } = $props();
    const engine:SnapLine = getContext("engine");
    let itemContainer: ItemContainer = new ItemContainer(engine.global, null);
    itemContainer.direction = direction;

    setContext("itemContainer", itemContainer);

    
</script>

<div class="container" style="flex-direction: {direction}" bind:this={itemContainer.element}>
    {@render children()}
</div>

<style>
    .container {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
    }
</style>