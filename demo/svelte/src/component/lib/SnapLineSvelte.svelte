<script lang="ts">
    import { onMount } from "svelte";
    import { NodeComponent, SnapLine, Background } from "../../../../../src/index";
    import { getSnapline } from "./snapline.svelte";
    import Select from "./Select.svelte";

    let container: HTMLDivElement | null = null;
    let canvas: HTMLDivElement | null = null;
    let background: HTMLDivElement | null = null;
    // let selection: HTMLDivElement | null = null;

    interface ObjectData {
        class: typeof NodeComponent;
        component: typeof Event;
        positionX: number;
        positionY: number;
        prop: any;
        added: boolean;
    }


    let { nodes, config }: { nodes: ObjectData[], config?: any } = $props();
    // const sl = new SnapLine(config);
    const sl = getSnapline();

    let nodeObjectList: NodeComponent[] = $state([]);
    
    $effect(() => {
        for (let node of nodes) {
            if (!node.added) {
                let newObject = new node.class(sl.global);
                newObject.svelteComponent = node.component;
                newObject.worldPosition = [node.positionX, node.positionY];
                sl.addObject(newObject);
                node.added = true;
                nodeObjectList.push(newObject);
            }
        }
    });

    onMount(() => {         
        let bg = new Background(sl.global, null);
        bg.addDom(background);
        sl.assignDom(
            container,
            // canvas,
            // background,
            // selection,
        );
        sl.assignCameraControl(canvas);
    });
</script>


    <div id="sl-canvas-container" class="not-content" bind:this={container}> 
        <div id="sl-canvas" bind:this={canvas}>
            <div id="sl-background" bind:this={background}></div>   
            <Select global={sl.global} />
            {#each nodeObjectList as node}
                <node.svelteComponent nodeObject={node} /> 
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
        // background-size: 32px 32px;
        user-select: none;
    }
</style>
