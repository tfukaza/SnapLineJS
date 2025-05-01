<script lang="ts">
    import { NodeComponent, LineComponent, SnapLine } from "../../../../../src/index";
    import Line from "./Line.svelte";
    import { onMount, setContext, getContext } from "svelte";

    let { className, children}: { className: string, children: any} = $props();
    let nodeDOM: HTMLDivElement | null = null;
    let lineList: LineComponent[] = $state([]);
    let engine:SnapLine = getContext("engine");
    let nodeObject = new NodeComponent(engine.global, null);

    setContext("nodeObject", nodeObject);

    let formattedLines = $derived(lineList.map(line => ({
        line: line,
        gid: line.gid,
        positionX: line.parent.worldX,
        positionY: line.parent.worldY,
        endPositionX: line.endWorldX,
        endPositionY: line.endWorldY
    })));

    onMount(() => {
        nodeObject.element = nodeDOM as HTMLElement;
        nodeObject.setLineListCallback((lines: LineComponent[]) => {
            lineList = lines;
        });
    });

    export function addSetPropCallback(name: string, callback: (prop: any) => void) {
        nodeObject.addSetPropCallback(callback, name);
    }

    export function getNodeObject() {
        return nodeObject;
    }

</script>


{#each formattedLines as line (line.gid)}
    <Line {line} />
{/each}
<div bind:this={nodeDOM} class={className}>
    {@render children()}
</div>


<style>

</style>