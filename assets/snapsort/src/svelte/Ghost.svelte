<script lang="ts">
  import type { GhostInsertEvent } from "@snap-engine/snapsort";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type GhostProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    event: GhostInsertEvent;
    children?: Snippet;
    className?: string;
  };

  let {
    event,
    children,
    class: classValue = "",
    className = "",
    style = "",
    id = "spacer",
    ...divProps
  }: GhostProps = $props();

  const ghostStyle = $derived.by(() => {
    const origProp = event.original.dragSnapshot?.box ?? event.original.currentDomProperty;
    const width = event.ghostRect?.width ?? origProp.width;
    const height = event.ghostRect?.height ?? origProp.height;
    if (event.kind === "marker") {
      const containerProp =
        event.container.dragSnapshot?.box ?? event.container.currentDomProperty;
      const insetLeft = event.ghostRect?.insetLeft ?? 0;
      const insetRight = event.ghostRect?.insetRight ?? 0;
      const left =
        (event.ghostRect?.x ?? origProp.x) -
        containerProp.x +
        (event.role === "pointer" ? 0 : insetLeft);
      const top = (event.ghostRect?.y ?? origProp.y) - containerProp.y;
      const markerWidth = Math.max(0, width - insetLeft - insetRight);
      return (
        `position:absolute;left:${left}px;top:${top}px;width:${markerWidth}px;` +
        `height:${event.role === "pointer" ? height : 0}px;margin:0;` +
        "pointer-events:none;box-sizing:border-box;z-index:1000;" +
        (event.role === "pointer"
          ? ""
          : "border-radius:999px;border-top:3px solid currentColor;background:currentColor;color:rgb(37, 99, 235);")
      );
    }
    return (
      `width:${width}px;height:${height}px;` +
      `margin:${origProp.margin.top}px ${origProp.margin.right}px ${origProp.margin.bottom}px ${origProp.margin.left}px;` +
      "box-sizing:border-box;"
    );
  });
  const mergedStyle = $derived(`${ghostStyle}${style}`);
  const mergedClass = $derived(`${classValue} ${className}`.trim());

  function bindGhostElement(node: HTMLElement) {
    event.ghostItem.element = node;
    return {
      destroy() {
        if (event.ghostItem.element === node) {
          event.ghostItem.destroyDom(false);
        }
      },
    };
  }
</script>

<div
  {...divProps}
  {id}
  class={mergedClass || undefined}
  data-snapsort-ghost={event.role === "pointer" ? "pointer" : event.kind === "marker" ? "insertion" : undefined}
  data-snapsort-ghost-entry={event.kind}
  style={mergedStyle}
  use:bindGhostElement
>
  {@render children?.()}
</div>
