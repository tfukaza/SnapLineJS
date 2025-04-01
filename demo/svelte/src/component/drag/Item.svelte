<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { getSnapline } from "../lib/snapline.svelte";
    import { ItemContainer, ItemObject } from "./def";
    import type { SnapLine } from "../../../../../src/index";

    let {  children }: { children: any } = $props();
    const sl:SnapLine = getContext("sl");
    const itemContainer:ItemContainer = getContext("itemContainer");
    
    let item: HTMLDivElement | null = null;
    let itemObject: ItemObject | null = null;

    onMount(() => {
        itemObject = new ItemObject(sl.global, null);
        itemObject.addDom(item);
        sl.addObject(itemObject);
        itemContainer.addItem(itemObject as ItemObject);
    });

</script>

<div class="item" bind:this={item}>
    {@render children()}
</div>

<style>
    .item {
        font-size: 24px;
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        color: rgb(100, 100, 100);
        width: 200px;
        height: 40px;
        margin: 5px;
        padding: 10px;
        user-select: none;
        background-color: rgb(236, 236, 236);
        border: 2px solid black;
    }
</style>
