<script lang="ts">
    import { Node, Connector, Line, ResizeRegion } from "@snap-engine/snapline/svelte";
    import type { ResizeHandle } from "@snap-engine/snapline";

    let { title = "Node", id = title, x = 0, y = 0, handles = [] }:
        { title?: string; id?: string; x?: number; y?: number; handles?: readonly ResizeHandle[] } = $props();
    let nodeComponent: any = $state(null);
</script>

<Node
    bind:this={nodeComponent}
    className="rnode"
    LineSvelteComponent={Line}
    {x}
    {y}
    minWidth={140}
    minHeight={90}
>
    <div class="rnode-header"><h3>{title}</h3></div>
    <div class="rnode-body">
        <div class="input-row">
            <div class="cw"><Connector id={`${id}:input`} name="input" rules={{ maxOutgoing: 0, maxIncoming: 1, onFull: "replace-oldest" }} /></div>
            <span>In</span>
        </div>
        <div class="output-row">
            <span>Out</span>
            <div class="cw"><Connector id={`${id}:output`} name="output" rules={{ maxIncoming: 0 }} /></div>
        </div>
    </div>
    {#each handles as handle}
        <ResizeRegion {handle} class="resize-region" />
    {/each}
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
    :global(.rnode .resize-region) {
        --thickness: 14px;
        position: absolute;
        z-index: 2;
    }
    :global(.rnode .resize-region[data-handle="n"]),
    :global(.rnode .resize-region[data-handle="s"]) {
        left: var(--thickness);
        right: var(--thickness);
        height: var(--thickness);
        cursor: ns-resize;
    }
    :global(.rnode .resize-region[data-handle="e"]),
    :global(.rnode .resize-region[data-handle="w"]) {
        top: var(--thickness);
        bottom: var(--thickness);
        width: var(--thickness);
        cursor: ew-resize;
    }
    :global(.rnode .resize-region[data-handle^="n"]) { top: calc(var(--thickness) / -2); }
    :global(.rnode .resize-region[data-handle^="s"]) { bottom: calc(var(--thickness) / -2); }
    :global(.rnode .resize-region[data-handle$="e"]) { right: calc(var(--thickness) / -2); }
    :global(.rnode .resize-region[data-handle$="w"]) { left: calc(var(--thickness) / -2); }
    :global(.rnode .resize-region[data-handle="ne"]),
    :global(.rnode .resize-region[data-handle="se"]),
    :global(.rnode .resize-region[data-handle="sw"]),
    :global(.rnode .resize-region[data-handle="nw"]) {
        width: var(--thickness);
        height: var(--thickness);
    }
    :global(.rnode .resize-region[data-handle="ne"]),
    :global(.rnode .resize-region[data-handle="sw"]) {
        cursor: nesw-resize;
    }
    :global(.rnode .resize-region[data-handle="nw"]),
    :global(.rnode .resize-region[data-handle="se"]) {
        cursor: nwse-resize;
    }
</style>
