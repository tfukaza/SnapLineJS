<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import MaterialSurface from "./MaterialSurface.svelte";
  import type { MaterialSettings } from "./materialSurface";

  type CircleProps = Omit<HTMLAttributes<HTMLSpanElement>, "children" | "class"> & {
    size?: number;
    material?: MaterialSettings;
    creviceOutline?: boolean;
    class?: string;
    className?: string;
  };

  let {
    size = 40,
    material,
    creviceOutline,
    class: classValue = "",
    className = "",
    ...circleProps
  }: CircleProps = $props();

  const mergedClass = $derived(`circle ${classValue} ${className}`.trim());
</script>

<MaterialSurface
  {...circleProps}
  depth="raised"
  shape="circle"
  width={size}
  height={size}
  {material}
  {creviceOutline}
  class={mergedClass}
/>
