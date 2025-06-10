<script lang="ts">
  import Select from "./../../../../../svelte/src/lib/node_ui/Select.svelte";
  // import Background from "./../../../../../svelte/src/lib/canvas/Background.svelte";
  import { addNode } from "./populate_node";
  import { onMount } from "svelte";
  import type { ObjectData } from "./../../../../../svelte/src/lib/engine.svelte";

  let objects: ObjectData[] = $state([]);

  onMount(() => {
    objects.push(...addNode());
  });
</script>

<!-- <Background /> -->
<Select />
{#each objects as object}
  <object.svelteComponent />
{/each}

<style lang="scss">
</style>
