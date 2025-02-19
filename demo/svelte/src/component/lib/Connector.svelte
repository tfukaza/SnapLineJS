<script lang="ts">
    import { NodeComponent, ConnectorComponent } from "../../lib/snapline.mjs";
    import { onMount } from "svelte";
    let { 
        nodeObject, 
        name, 
        maxConnectors = 1, 
        allowDragOut = true,
    }: { 
        nodeObject: NodeComponent,
        name: string, 
        maxConnectors?: number, 
        allowDragOut?: boolean
    } = $props();
    let connectorDOM: HTMLSpanElement | null = null;

    onMount(() => {
        let connector = new ConnectorComponent(connectorDOM as any, nodeObject.g, {
            name: name,
            maxConnectors: maxConnectors,
            allowDragOut: allowDragOut,
        });
        nodeObject.addConnectorObject(connector);
    });
    
</script>

<span class="sl-connector" bind:this={connectorDOM}></span>

<style>

</style>