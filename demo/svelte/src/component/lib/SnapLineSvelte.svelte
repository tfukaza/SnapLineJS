<script lang="ts">
    import { onMount, setContext } from "svelte";
    import { Background } from "../../../../../src/index";
    import { getSnapline } from "./snapline.svelte";
    import type { ObjectData } from "./snapline.svelte";
    import Select from "./Select.svelte";

    let { id, objects, config }: { id: string, objects: ObjectData[], config?: any } = $props();
    let container: HTMLDivElement | null = null;
    let canvas: HTMLDivElement | null = null;
    let background: HTMLDivElement | null = null;
    const sl = getSnapline(id);

    setContext("sl", sl);

    onMount(() => {         
        sl.assignDom(container);
        sl.assignCameraControl(canvas);
        let bg = new Background(sl.global, null);
        bg.addDom(background);
    });
</script>

<div id="sl-canvas-container" class="not-content" bind:this={container}> 
    <div id="sl-canvas" bind:this={canvas}>
        <div id="sl-background" bind:this={background}></div>   
        <Select />
        {#each objects as object}
            <object.svelteComponent />
        {/each}      
    </div>
</div>

<style lang="scss">
    #sl-canvas-container {
        width: 100%;
        height: 80svh;
        background-color: #fff;
        border: 2px solid rgb(215, 215, 215);
        border-radius: 10px;
        overflow: hidden;
        user-select: none;
    }
    #sl-canvas {
        width: 100%;
        height: 100%;
        background-color: #fff;
        user-select: none;
    }
    #sl-background {
        background-color: #fff;
        background-image: radial-gradient(circle, #cccccc 2px, transparent 1px);
        user-select: none;
    }
</style>
