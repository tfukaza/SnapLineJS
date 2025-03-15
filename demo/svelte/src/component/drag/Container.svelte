<script lang="ts">
    import { ItemContainer, ItemObject } from "./def";
    import Item from "./Item.svelte";
    import { getSnapline } from "../lib/snapline.svelte";
    import { onMount } from "svelte";
    let { itemList }: { itemList: { id: number, text: string }[] } = $props();
    const sl = getSnapline();
    let container: HTMLDivElement | null = null;
    let itemContainer: ItemContainer = new ItemContainer(sl.global, null);
    // $effect(() => {
    //     container = new ItemContainer(global, null);
    //     itemList.forEach((item) => {
    //         container.addItem(item);
    //     });
    // });
    onMount(() => {
        itemContainer._containerDomElement = container;
    });
</script>

<div class="container" bind:this={container}>
    {#each itemList as item}
        <Item itemContainer={itemContainer} >
            <div class="drag-drop-demo">{item.text}</div>
        </Item>
    {/each}
</div>

<style>
    .container {
      position: relative;
    }

    :global(.shrink-animation-before-item) {
        height: 100px;
        /* Play once and stop */
        animation: shrink 0.1s ease-in-out;
        animation-fill-mode: forwards;
        background-color: rgba(0, 26, 255, 0.176);
    }

    :global(.expand-animation-before-item) {
        height: 0px;
        animation: expand 0.1s ease-in-out;
        animation-fill-mode: forwards;
        background-color: rgba(0, 26, 255, 0.176);
    }

    @keyframes shrink {
        from {
            height: 100px;
        }
        to {
            height: 0px;
        }
    }

    @keyframes expand {
        from {
            height: 0px;
        }
        to {
            height: 100px;
        }
    }
</style>