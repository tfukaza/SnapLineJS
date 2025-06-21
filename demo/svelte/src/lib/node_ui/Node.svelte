<script lang="ts">
    import { NodeComponent, LineComponent, SnapLine } from "../../../../../src/index";
    import Line from "./Line.svelte";
    import { onMount, setContext, getContext, onDestroy } from "svelte";
    import { blur } from "svelte/transition";

    let { className, LineSvelteComponent, nodeObject, children}: { 
        className: string, 
        LineSvelteComponent: typeof Line, 
        nodeObject?: NodeComponent | null,
        children: any
    } = $props();
    let nodeDOM: HTMLDivElement | null = null;
    let engine:SnapLine = getContext("engine");
    if (!nodeObject) {
         nodeObject = new NodeComponent(engine.global, null);
    }
    let lineList: LineComponent[] = $state(nodeObject.getAllOutgoingLines());

    setContext("nodeObject", nodeObject);

    onMount(() => {
        nodeObject.element = nodeDOM as HTMLElement;
        nodeObject.setLineListCallback((lines: LineComponent[]) => {
            lineList = lines;
        });
    });

    onDestroy(() => {
        nodeObject.destroy();
    });

    export function addSetPropCallback(name: string, callback: (prop: any) => void) {
        nodeObject!.addSetPropCallback(callback, name);
    }

    export function getNodeObject() {
        return nodeObject;
    }

</script>


{#each lineList as line (line.gid)}
    <LineSvelteComponent {line} />
{/each}
<div bind:this={nodeDOM} class={className} style="position: absolute;" transition:blur|global={{duration: 200}}>
    {@render children()}
</div>


<style>

</style>