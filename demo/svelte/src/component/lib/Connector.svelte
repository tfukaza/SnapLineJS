<script lang="ts">
    import { NodeComponent, ConnectorComponent, LineComponent } from "../../lib/snapline.mjs";
    import { onMount } from "svelte";
    let { 
        nodeObject, 
        name, 
        maxConnectors = 1, 
        allowDragOut = true,
        lineClass = null,
    }: { 
        nodeObject: NodeComponent,
        name: string, 
        maxConnectors?: number, 
        allowDragOut?: boolean,
        lineClass?: typeof LineComponent,
    } = $props();
    let connectorDOM: HTMLSpanElement | null = null;
    let connectorInnerDOM: HTMLDivElement | null = null;
    let connector = new ConnectorComponent(nodeObject.global, nodeObject, {
        name: name,
        maxConnectors: maxConnectors,
        allowDragOut: allowDragOut,
        lineClass: lineClass,
    });  
    nodeObject.addConnectorObject(connector);

    onMount(() => { 
        connector.addDom(connectorDOM);
        // connector.addRigidBody(connectorInnerDOM);
    });
    
</script>

<div class="sl-connector" bind:this={connectorDOM}><div class="sl-connector-inner" bind:this={connectorInnerDOM}></div></div>

<style>
    .sl-connector {
        width: 10px;
        height: 10px;
        background-color: rgb(0, 0, 255);
        border-radius: 50%;
    }
    .sl-connector-inner {   
        /* display: none; */
        width: 10px;
        height: 10px;
        background-color: rgba(0, 255, 17, 0.183);
        border-radius: 50%;
        transform: scale(1);
    }
    :global(.snap) {
        .sl-connector-inner {
            /* transform: scale(5); */
        }
    }
</style>