
<script lang="ts">
    import { RectSelectComponent, SnapLine } from "../../../../../src/index";
    import { onMount, getContext } from "svelte";

    let selectDOM: HTMLDivElement | null = null;
    let engine:SnapLine = getContext("engine");
    let select = new RectSelectComponent(engine.global, null);

    onMount(() => {
        select.addDom(selectDOM as HTMLElement);
    });
    
</script>

<div id="select-container" bind:this={selectDOM}></div>

<style>
    #select-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        background-color: rgba(0, 0, 0, 0.103);
    }
</style>