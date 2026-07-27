<script lang="ts">
    import { Node, Connector, Line } from "@snap-engine/snapline-svelte";

    let { nodeId, title, x = 0, y = 0, maxIncoming = 1 } = $props();
</script>

<Node className="card node" LineSvelteComponent={Line} {x} {y}>
    <div class="node-header">
        <h3>{title}</h3>
    </div>
    <div class="node-body">
        <div class="input-row">
            <div class="connector-wrapper">
                <Connector
                    id={`${nodeId}:input`}
                    name="input"
                    rules={{ maxOutgoing: 0, maxIncoming: maxIncoming === -1 ? "unlimited" : maxIncoming, onFull: "replace-oldest" }}
                />
            </div>
            <span>Input</span>
        </div>
        <div class="output-row">
            <span>Output</span>
            <div class="connector-wrapper">
                <Connector
                    id={`${nodeId}:output`}
                    name="output"
                    rules={{ maxIncoming: 0 }}
                />
            </div>
        </div>
    </div>
</Node>

<style>
    :global(.node) {
        width: 200px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
    }
    .node-header {
        padding: 10px;
        border-bottom: 1px solid #eee;
        background-color: #f9f9f9;
    }
    .node-body {
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .input-row,
    .output-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .output-row {
        justify-content: flex-end;
    }
    .connector-wrapper {
        width: 14px;
        height: 14px;
    }
</style>
