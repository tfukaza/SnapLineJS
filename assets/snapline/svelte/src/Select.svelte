<script lang="ts">
    import { RectSelectComponent, type SelectRect } from "@snap-engine/snapline";
    import type { Engine } from "@snap-engine/core";
    import { onDestroy, getContext } from "svelte";

    let { className = "" }: { className?: string } = $props();

    let engine: Engine = getContext("engine");
    let select = new RectSelectComponent(engine, null);

    // The selection box is framework-rendered: core reports the world-space rect
    // via onRectChange and this state draws it, so consumers can restyle or
    // replace the box entirely (override #select-container / pass a class).
    let rect = $state<SelectRect>({ x: 0, y: 0, width: 0, height: 0, visible: false });
    select.selectCallback.onRectChange = (r: SelectRect) => {
        rect = r;
    };

    onDestroy(() => {
        select.destroy();
    });

    export function getSelectObject() {
        return select;
    }
</script>

<div
    id="select-container"
    data-snapline-type="selection"
    class={className}
    style:display={rect.visible ? "block" : "none"}
    style:width={`${rect.width}px`}
    style:height={`${rect.height}px`}
    style:transform={`translate3d(${rect.x}px, ${rect.y}px, 0)`}
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
