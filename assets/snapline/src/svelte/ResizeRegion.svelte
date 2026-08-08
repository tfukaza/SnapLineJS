<script lang="ts">
    import { ResizeRegionMirror, type ResizeHandle } from "@snap-engine/snapline";
    import { getContext, onDestroy, onMount, type Snippet } from "svelte";
    import type { HTMLAttributes } from "svelte/elements";
    import { resizeRegionOwnerContext, type ResizeRegionOwner } from "./resize-region-context";

    let {
        handle,
        children = undefined,
        style = undefined,
        ...elementProps
    }: Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
        handle: ResizeHandle;
        children?: Snippet;
    } = $props();

    const node = getContext<ResizeRegionOwner>(resizeRegionOwnerContext);
    if (!node) {
        throw new Error("ResizeRegion must be rendered inside a Node or Group.");
    }

    const region = new ResizeRegionMirror(node.engine, node, handle);
    let element: HTMLDivElement | null = null;

    onMount(() => {
        region.element = element;
    });

    onDestroy(() => {
        if (element) region.detachElement(element);
        region.destroy(false);
    });

    export function getResizeRegionObject() {
        return region;
    }
</script>

<div
    {...elementProps}
    bind:this={element}
    data-snapline-part="resize-region"
    data-handle={handle}
    {style}
    style:pointer-events="auto"
    style:touch-action="none"
>
    {@render children?.()}
</div>
