<script lang="ts">
    import { onMount, getContext, onDestroy } from "svelte";
    import { ItemContainer} from "../../../../../src/asset/drag_and_drop/container"
    import { ItemObject } from "../../../../../src/asset/drag_and_drop/item"
    import type { SnapLine } from "../../../../../src/index";

    let {  children }: { children: any } = $props();
    const engine:SnapLine = getContext("engine");
    const itemContainer:ItemContainer = getContext("itemContainer");
    
    let itemObject: ItemObject = new ItemObject(engine.global, null);

    onMount(() => {
        engine.addObject(itemObject);
        itemContainer.addItem(itemObject);
    });

    onDestroy(() => {
        itemObject.destroy();
    });

</script>

<div class="item" bind:this={itemObject.element}>
    {@render children()}
</div>

<style>
    .item {
    
    }
</style>