<script lang="ts">
    import { onMount, setContext } from "svelte";
    import { getEngine } from "./engine.svelte";

    let { id, children }: { id: string, children: any } = $props();
    let canvas: HTMLDivElement | null = null;

    const engine = getEngine(id);
    setContext("engine", engine);       

    onMount(() => {         
        engine.assignDom(canvas);
    });
</script>

<div id="snap-canvas" bind:this={canvas}> 
   {@render children()}
</div>

<style lang="scss">
    #snap-canvas {

        position: relative;
        background-color: #fff;
        border: 2px solid rgb(215, 215, 215);
        border-radius: 10px;
        overflow: hidden;
        user-select: none;
    }
</style>