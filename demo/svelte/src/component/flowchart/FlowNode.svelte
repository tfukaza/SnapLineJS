<script lang="ts">
    import { NodeComponent, LineComponent } from "../../lib/snapline.mjs";
    import FlowLine from "./FlowLine.svelte";
    import { onMount } from "svelte";
    let { nodeObject, className, children}: { nodeObject: NodeComponent, className: string, children: any} = $props();
    let nodeDOM: HTMLDivElement | null = null;
    let lineList: LineComponent[] = $state(nodeObject.getAllLines());

    let formattedLines = $derived(lineList.map(line => ({
        line: line,
        x_start: line.x_start,
        y_start: line.y_start,
        x_end: line.x_end,
        y_end: line.y_end
    })));

    let nodeStyle = $state(nodeObject.getNodeStyle());

    function updateNodeStyle(style: any) {
        nodeStyle = style;
        if (nodeDOM) {
            nodeDOM.style.transform = style.transform;
            nodeDOM.style.position = "absolute";
            nodeDOM.style.transformOrigin = "top left";
        }
    }

    onMount(() => {
        nodeObject.setRenderNodeCallback(updateNodeStyle);
        nodeObject.setRenderLinesCallback(() => {
            lineList = nodeObject.getAllLines();
        });
        nodeObject.init(nodeDOM);
    });
    
</script>

{#each formattedLines as line}
    <FlowLine {line} />
{/each}
<div bind:this={nodeDOM} data-snapline-state={nodeStyle._focus ? "focus" : "idle"} class={className}>
    {@render children()}
</div>


<style>

</style>