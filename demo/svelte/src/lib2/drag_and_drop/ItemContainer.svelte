<script lang="ts">
    import { ItemContainer} from "../../../../../src/asset/drag_and_drop/container";
    import { onMount, getContext, setContext } from "svelte";
    import type { SnapLine } from "../../../../../src/index";

    let { direction, children }: { direction: "column" | "row", children: any } = $props();
    const engine:SnapLine = getContext("engine");
    let container: HTMLDivElement | null = null;
    let itemContainer: ItemContainer = new ItemContainer(engine.global, null);
    itemContainer.direction = direction;

    setContext("itemContainer", itemContainer);

    onMount(() => {
        itemContainer._containerDomElement = container;
        itemContainer.requestRead(true, true);
    });
    
</script>

<div class="container" bind:this={container} style="flex-direction: {direction}">
    {@render children()}
</div>

<style>
    .container {
      position: relative;
      display: flex;
      flex-wrap: wrap;
    }
</style>