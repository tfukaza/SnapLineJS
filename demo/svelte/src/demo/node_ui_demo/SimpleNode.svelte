<script lang="ts">
    import { Node, Connector, Line } from "@snap-engine/snapline-svelte";
    
    let { title = "Node", x = 0, y = 0, maxIncoming = 1 } = $props();
    let nodeComponent: any = $state(null);
</script>

<Node bind:this={nodeComponent} className="card node" LineSvelteComponent={Line} {x} {y}>
    <div class="node-header">
        <h3>{title}</h3>
    </div>
    <div class="node-body">
        <div class="input-row">
            <div class="connector-wrapper">
                <Connector name="input" rules={{ maxOutgoing: 0, maxIncoming: maxIncoming === -1 ? "unlimited" : maxIncoming, onFull: "replace-oldest" }} />
            </div>
            <span>Input</span>
        </div>
        <div class="output-row">
            <span>Output</span>
            <div class="connector-wrapper">
                <Connector name="output" rules={{ maxIncoming: 0 }} />
            </div>
        </div>
    </div>
</Node>

<style>
    :global(.node) {
        width: 200px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        display: flex;
        flex-direction: column;
    }
    .node-header {
        padding: 10px;
        border-bottom: 1px solid #eee;
        background-color: #f9f9f9;
        border-radius: 8px 8px 0 0;
    }
    .node-header h3 {
        margin: 0;
        font-size: 16px;
    }
    .node-body {
        padding: 10px;
    }
    .input-row, .output-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        height: 24px;
    }
    .output-row {
        justify-content: flex-end;
    }
    .connector-wrapper {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
