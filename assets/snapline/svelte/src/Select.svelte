<script lang="ts">
    import { RectSelectController, type SelectCallbacks } from "@snap-engine/snapline";
    import type { Engine } from "@snap-engine/core";
    import { onDestroy, onMount, getContext } from "svelte";

    let { className = "", callbacks = {} }: { className?: string; callbacks?: SelectCallbacks } = $props();

    let engine: Engine = getContext("engine");
    let select = new RectSelectController(engine, null, { callbacks });

    let selectDOM: HTMLDivElement | null = null;
    let unbindGeometry: (() => void) | null = null;

    onMount(() => {
        unbindGeometry = select.bindGeometryWriter((rect) => {
            if (!selectDOM) return;
            selectDOM.style.display = rect.visible ? "block" : "none";
            selectDOM.style.width = `${rect.width}px`;
            selectDOM.style.height = `${rect.height}px`;
            selectDOM.style.transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`;
        });
    });

    onDestroy(() => {
        unbindGeometry?.();
        select.destroy(false);
    });

    export function getSelectObject() {
        return select;
    }
</script>

<div
    id="select-container"
    bind:this={selectDOM}
    data-snapline-type="selection"
    class={className}
    style:display="none"
    style:width="0px"
    style:height="0px"
    style:transform="translate3d(0px, 0px, 0)"
></div>

<style>
    #select-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        transform-origin: top left;
        pointer-events: none;
        background-color: rgba(0, 0, 0, 0.103);
    }
</style>
