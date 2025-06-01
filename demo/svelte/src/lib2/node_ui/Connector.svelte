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
        lineClass?: typeof LineComponent | null,
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
    connector.element = connectorDOM as HTMLElement;
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
        fill: #FFF;
        box-shadow: 3px 3px 4px 0px rgba(40, 24, 28, 0.31) inset;
        border-radius: 50%;
        margin: 12px;
    }
</style>