<script lang="ts">
    import { onMount, setContext } from "svelte";
    import { getSnapline } from "./snapline.svelte";

    let container: HTMLDivElement | null = null;
    let { id, children }: { id: string, children: any } = $props();
    const sl = getSnapline(id);

    setContext("sl", sl);

    onMount(() => {
        sl.assignDom(container);
    });

</script>

<div id="sl-canvas-container"  bind:this={container}> 
    {@render children()}
</div>


<style lang="scss">
    #sl-canvas-container {
        width: 100%;
        height: 80svh;
        background-color: #fff;
        border: 2px solid rgb(215, 215, 215);
        border-radius: 10px;
        overflow: hidden;
    }
</style>
