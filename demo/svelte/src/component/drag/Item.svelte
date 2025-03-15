<script lang="ts">
    import { onMount } from "svelte";
    import { getSnapline } from "../lib/snapline.svelte";
    import { ItemContainer, ItemObject } from "./def";

    let { itemContainer, children }: { itemContainer: ItemContainer, children: any } = $props();
    const sl = getSnapline();
    let item: HTMLDivElement | null = null;
    let itemObject: ItemObject | null = null;
    onMount(() => {
        console.log("Item mounted", sl);
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
        width: 100px;
        height: 100px;
        margin: 10px;
        padding: 10px;
        user-select: none;
        background-color: red;
    }
</style>
