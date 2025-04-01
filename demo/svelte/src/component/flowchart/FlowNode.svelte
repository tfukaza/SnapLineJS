<script lang="ts">
    import { NodeComponent, LineComponent } from "../../lib/snapline.mjs";
    import FlowLine from "./FlowLine.svelte";
    import { onMount } from "svelte";
    let { nodeObject, className, children}: { nodeObject: NodeComponent, className: string, children: any} = $props();
    let nodeDOM: HTMLDivElement | null = null;
    let lineList: LineComponent[] = $state([]);

    let formattedLines = $derived(lineList.map(line => ({
        line: line,
        gid: line.gid,
        positionX: line.parent.positionX,
        positionY: line.parent.positionY,
        endPositionX: line.endWorldX,
        endPositionY: line.endWorldY
    })));

    // let nodeStyle = $state(nodeObject.getNodeStyle());

    // function updateNodeStyle(style: any) {
    //     nodeStyle = style;
    //     if (nodeDOM) {
    //         nodeDOM.style.transform = style.transform;
    //         nodeDOM.style.position = "absolute";
    //         nodeDOM.style.transformOrigin = "top left";
    //     }
    // }

    onMount(() => {
        // nodeObject.setRenderNodeCallback(updateNodeStyle);
        // nodeObject.setRenderLinesCallback(() => {
        //     lineList = nodeObject.getAllLines();
        // });
        nodeObject.addDom(nodeDOM);
        // nodeObject.submitRender();
        nodeObject.setLineListCallback((lines: LineComponent[]) => {
            // console.debug("Updating line list in Svelte", lines);
            lineList = lines;
        });
    });
    
</script>

{#each formattedLines as line (line.gid)}
    <FlowLine line={line} />
{/each}
<div bind:this={nodeDOM}  class="flow-node">
    {@render children()}
</div>


<style>
    .flow-node {
        width: 150px;
        user-select: none;
        padding: 10px;
        background-color: #fff;
        border: 1px solid #ccc;
        border-radius: 5px;
        box-sizing: border-box;
        position: absolute;
    }
</style>