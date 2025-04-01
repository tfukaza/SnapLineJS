<script lang="ts">
    import { ItemContainer} from "./def";
    import Item from "./Item.svelte";
    import { onMount, getContext, setContext } from "svelte";
    import type { SnapLine } from "../../../../../src/index";

    let { itemList }: { itemList: { id: number, text: string }[] } = $props();
    const sl:SnapLine = getContext("sl");
    let container: HTMLDivElement | null = null;
    let itemContainer: ItemContainer = new ItemContainer(sl.global, null);

    setContext("itemContainer", itemContainer);

    onMount(() => {
        itemContainer._containerDomElement = container;
    });
    
</script>

<div class="container" bind:this={container}>
    {#each itemList as item}
        <Item>
            <div class="drag-drop-demo">{item.text}</div>
        </Item>
    {/each}
</div>

<style>
    .container {
      position: relative;
    }
</style>