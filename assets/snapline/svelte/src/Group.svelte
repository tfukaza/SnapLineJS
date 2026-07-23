<script lang="ts">
    import { GroupNodeComponent, DEFAULT_RESIZE_HANDLE_RADIUS } from "@snap-engine/snapline";
    import type { Engine } from "@snap-engine/core";
    import { onMount, onDestroy, getContext, tick } from "svelte";

    let {
        className = "",
        groupObject = null,
        x = 0,
        y = 0,
        width = 400,
        height = 300,
        title = "Group",
        // Min sizes default in core (DEFAULT_GROUP_CONFIG); undefined passes through.
        minWidth = undefined,
        minHeight = undefined,
        onMemberEnter = undefined,
        onMemberLeave = undefined,
        onResizeCommit = undefined,
        onDragCommit = undefined,
        children = undefined,
    }: {
        className?: string;
        groupObject?: GroupNodeComponent | null;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        title?: string;
        minWidth?: number;
        minHeight?: number;
        onMemberEnter?: (node: any) => void;
        onMemberLeave?: (node: any) => void;
        onResizeCommit?: (w: number, h: number) => void;
        onDragCommit?: () => void;
        children?: any;
    } = $props();

    let boxDOM: HTMLDivElement | null = null;
    let headerEl: HTMLElement | null = null;
    let engine: Engine = getContext("engine");
    const ownsGroup = groupObject == null;
    if (!groupObject) {
        groupObject = new GroupNodeComponent(engine, null, { width, height, minWidth, minHeight });
    }

    // The box's width/height are framework-owned: seeded from props in the first
    // markup pass, updated live by core's onSizeChange during a resize drag.
    let boxW = $state(width);
    let boxH = $state(height);

    onMount(() => {
        groupObject!.worldTransform = { x, y };
        groupObject!.element = boxDOM as HTMLElement;
        groupObject!.writeTransform();
        groupObject!.groupCallback.onMemberEnter = (node) => onMemberEnter?.(node);
        groupObject!.groupCallback.onMemberLeave = (node) => onMemberLeave?.(node);
        groupObject!.groupCallback.onDragCommit = () => onDragCommit?.();
        // Resize is handled by the core BR resize hitbox; the framework renders
        // the live size, and the consumer persists the committed size.
        groupObject!.nodeCallback.onSizeChange = (w: number, h: number) => {
            boxW = w;
            boxH = h;
        };
        groupObject!.nodeCallback.onResizeCommit = (w: number, h: number) => onResizeCommit?.(w, h);
        // Header is the only move surface; wait a tick so the alias wins over the
        // element registration. setSizeState seeds the collision footprint (the
        // DOM size is already rendered from props above).
        void tick().then(() => {
            if (headerEl) groupObject!.addInputAlias(headerEl);
            groupObject!.setSizeState(boxW, boxH);
            // Seed membership once siblings have mounted, positioned, and had their
            // hit boxes measured (a WRITE stage runs after READ_1's measure).
            groupObject!.schedule(() => groupObject!.refreshMembership(true), {
                stage: "WRITE_3",
                queueId: `${groupObject!.id}-seed`,
            });
        });
    });

    onDestroy(() => {
        if (ownsGroup) groupObject!.destroy();
    });

    export function getNodeObject() {
        return groupObject;
    }
</script>

<div
    bind:this={boxDOM}
    data-snapline-type="group"
    class={`snapline-group ${className}`}
    style="position: absolute; transform-origin: top left; will-change: transform;"
    style:width={`${boxW}px`}
    style:height={`${boxH}px`}
>
    <header bind:this={headerEl} class="snapline-group-header" data-snapline-part="group-header">
        <span>{title}</span>
    </header>
    <div class="snapline-group-body">
        {@render children?.()}
    </div>
    <!-- Visual cue only: the core resize hitbox (a collider straddling the BR
         corner) does the hitting, so this takes no pointer events. Sized from
         the same config value as the hitbox radius. -->
    <div
        class="snapline-group-resize"
        data-snapline-part="group-resize"
        style:width={`${groupObject!.config.resizeHandleRadius ?? DEFAULT_RESIZE_HANDLE_RADIUS}px`}
        style:height={`${groupObject!.config.resizeHandleRadius ?? DEFAULT_RESIZE_HANDLE_RADIUS}px`}
    ></div>
</div>

<style>
    /* The box sits behind its members and must not steal their pointer events:
       only the header (move surface) is interactive; the resize hitbox is virtual. */
    .snapline-group {
        box-sizing: border-box;
        pointer-events: none;
    }
    .snapline-group-header {
        pointer-events: auto;
        cursor: grab;
    }
    .snapline-group-body {
        pointer-events: none;
    }
    .snapline-group-resize {
        position: absolute;
        right: 0;
        bottom: 0;
        pointer-events: none;
        cursor: nwse-resize;
    }
</style>
