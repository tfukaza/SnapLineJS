<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import MaterialSurface from "./MaterialSurface.svelte";
  import type { MaterialSettings } from "./materialSurface";

  type SlotProps = Omit<HTMLAttributes<HTMLSpanElement>, "children" | "class"> & {
    children: Snippet;
    width?: number;
    height?: number;
    radius?: number;
    material?: MaterialSettings;
    creviceOutline?: boolean;
    class?: string;
    className?: string;
  };

  let {
    children,
    width = 36,
    height = 22,
    radius,
    material,
    creviceOutline,
    class: classValue = "",
    className = "",
    ...slotProps
  }: SlotProps = $props();

  const mergedClass = $derived(`snap-slot ${classValue} ${className}`.trim());
  const surfaceRadius = $derived(
    radius ?? Math.min(Math.max(0, width), Math.max(0, height)) / 2,
  );
</script>

<MaterialSurface
  {...slotProps}
  depth="recessed"
  shape="rounded"
  {width}
  {height}
  radius={surfaceRadius}
  {material}
  {creviceOutline}
  class={mergedClass}
>
  {@render children()}
</MaterialSurface>
