<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { ItemContainer} from "../../../../../src/asset/drag_and_drop/container"
    import { ItemObject } from "../../../../../src/asset/drag_and_drop/item"
    import type { SnapLine } from "../../../../../src/index";

    let {  children }: { children: any } = $props();
    const engine:SnapLine = getContext("engine");
    const itemContainer:ItemContainer = getContext("itemContainer");
    
    let item: HTMLDivElement | null = null;
    let itemObject: ItemObject = new ItemObject(engine.global, null);

    onMount(() => {
        itemObject.addDom(item as HTMLElement);
        engine.addObject(itemObject);
        itemContainer.addItem(itemObject);
    });

</script>

<div class="item" bind:this={item}>
    {@render children()}
</div>

<style>
    .item {
        font-size: 12px;
        font-family: 'Inter', sans-serif;
        font-weight: 600;
        color: rgb(255, 255, 255);
        width: 64px;
        height: 64px;
        margin: 5px;
        padding: 10px;
        user-select: none;
        background-color: rgb(52, 52, 52);
        border: 2px solid black;
    }
</style>