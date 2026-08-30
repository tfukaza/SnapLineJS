<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import MaterialSurface from "./MaterialSurface.svelte";
  import type { MaterialSettings } from "./materialSurface";

  type SquareProps = Omit<HTMLAttributes<HTMLSpanElement>, "children" | "class"> & {
    size?: number;
    radius?: number;
    material?: MaterialSettings;
    creviceOutline?: boolean;
    class?: string;
    className?: string;
  };

  let {
    size = 40,
    radius = 2,
    material,
    creviceOutline,
    class: classValue = "",
    className = "",
    ...squareProps
  }: SquareProps = $props();

  const mergedClass = $derived(`square ${classValue} ${className}`.trim());
</script>

<MaterialSurface
  {...squareProps}
  depth="raised"
  shape="rounded"
  width={size}
  height={size}
  {radius}
  {material}
  {creviceOutline}
  class={mergedClass}
/>
