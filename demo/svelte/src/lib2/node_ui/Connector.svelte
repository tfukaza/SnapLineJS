<script lang="ts">
    import { NodeComponent, ConnectorComponent, LineComponent, SnapLine } from "../../../../../src/index";
    import { onMount, getContext, onDestroy } from "svelte";

    let { 
        name, 
        maxConnectors = 1, 
        allowDragOut = true,
        lineClass = null,
    }: { 
        name: string, 
        maxConnectors?: number, 
        allowDragOut?: boolean,
        lineClass?: typeof LineComponent,
    } = $props();

    let engine:SnapLine = getContext("engine");
    let nodeObject: NodeComponent = getContext("nodeObject");
    let connectorDOM: HTMLSpanElement | null = null;
    let connector = new ConnectorComponent(engine.global, nodeObject, {
        name: name,
        maxConnectors: maxConnectors,
        allowDragOut: allowDragOut,
        lineClass: lineClass,
    });  
    
    nodeObject.addConnectorObject(connector);

    onMount(() => { 
        connector.addDom(connectorDOM as HTMLElement);
    });

    onDestroy(() => {       
        connector.delete(connector.getCurrentStats());
    });
    
</script>

<div class="sl-connector" bind:this={connectorDOM}></div>

<style>
    .sl-connector {
        width: 10px;
        height: 10px;
        background-color: rgb(0, 0, 255);
        border-radius: 50%;
    }
</style>