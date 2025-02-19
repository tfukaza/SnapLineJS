<script lang="ts">
    import { onMount } from "svelte";
    import { NodeComponent, SnapLine } from "../../lib/snapline.mjs";
    let container: HTMLDivElement | null = null;
    let canvas: HTMLDivElement | null = null;
    let background: HTMLDivElement | null = null;
    let selection: HTMLDivElement | null = null;

    let { nodes, config }: { nodes: NodeComponent[], config?: any } = $props();
    const sl = new SnapLine(config);
    
    $effect(() => {
        for (let node of nodes) {
            if (node.g == null) {
                sl.addNode(node);
            }
        }
    });
    onMount(() => {         
        sl.init(
            container,
            canvas,
            background,
            selection,
        );
    });
</script>


    <div id="sl-canvas-container" class="not-content" bind:this={container}> 
        <div id="sl-canvas" bind:this={canvas}>
            <div id="sl-background" bind:this={background}></div>
            {#each nodes as node}
                <node._prop.nodeSvelteComponent nodeObject={node} />
            {/each}
        </div>
        <div id="sl-selection" bind:this={selection}></div>
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

    #sl-canvas {
        width: 100%;
        height: 100%;
        background-color: #fff;
    }
    #sl-background {
        background-color: #fff;
        background-image: radial-gradient(circle at 1px 1px, rgb(209, 212, 224) 1px, transparent 0);
        background-size: 32px 32px;
    }
</style>
