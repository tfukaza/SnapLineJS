<script lang="ts">
    import { ItemContainer} from "../../../../../src/asset/drag_and_drop/container";
    import { onMount, getContext, setContext } from "svelte";
    import type { SnapLine } from "../../../../../src/index";

    // let { itemList }: { itemList: { id: number, text: string }[] } = $props();
    let { children }: { children: any } = $props();
    const engine:SnapLine = getContext("engine");
    let container: HTMLDivElement | null = null;
    let itemContainer: ItemContainer = new ItemContainer(engine.global, null);

    setContext("itemContainer", itemContainer);

    onMount(() => {
        itemContainer._containerDomElement = container;
    });
    
</script>

<div class="container" bind:this={container}>
    {@render children()}
</div>

<style>
    .container {
      position: relative;
    }
</style>