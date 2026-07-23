<script lang="ts">
    import { Node, Connector, Line } from "@snap-engine/snapline-svelte";

    let { title = "Node", x = 0, y = 0, resizable = false, resizeAnchor = undefined } = $props();
    let nodeComponent: any = $state(null);
</script>

<Node
    bind:this={nodeComponent}
    className="rnode"
    LineSvelteComponent={Line}
    {x}
    {y}
    {resizable}
    {resizeAnchor}
    minWidth={140}
    minHeight={90}
>
    <div class="rnode-header"><h3>{title}</h3></div>
    <div class="rnode-body">
        <div class="input-row">
            <div class="cw"><Connector name="input" maxConnectors={1} allowDragOut={false} /></div>
            <span>In</span>
        </div>
        <div class="output-row">
            <span>Out</span>
            <div class="cw"><Connector name="output" maxConnectors={-1} allowDragOut={true} /></div>
        </div>
    </div>
</Node>

<style>
    /* Initial width; once resized, the adapter's onSizeChange state renders
       an inline width/height that overrides this. */
    :global(.rnode) {
        width: 180px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .rnode-header {
        padding: 8px 10px;
        border-bottom: 1px solid #eee;
        background: #f7f7f7;
    }
    .rnode-header h3 {
        margin: 0;
        font-size: 14px;
    }
    .rnode-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
    }
    .input-row,
    .output-row {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 20px;
    }
    .output-row {
        justify-content: flex-end;
    }
    .cw {
        width: 14px;
        height: 14px;
    }
    :global(.rnode .snapline-node-resize) {
        background: rgb(80 130 255 / 55%);
        border-radius: 0 0 8px 0;
    }
</style>
