<script lang="ts">
  import Select from "./../../../../../svelte/src/lib/node_ui/Select.svelte";
  // import Background from "./../../../../../svelte/src/lib/canvas/Background.svelte";
  import { addNode } from "./populate_node";
  import { onMount, getContext } from "svelte";
  import type { ObjectData } from "./../../../../../svelte/src/lib/engine.svelte";
  import { CameraControl } from "./../../../../../../src/asset/cameraControl";

  let objects: ObjectData[] = $state([]);
  let cameraControl: CameraControl = getContext("cameraControl");

  onMount(() => {
    objects.push(...addNode());
    cameraControl.queueUpdate("WRITE_2").addCallback(() => {
      cameraControl.updateCameraCenterPosition(0, 0);
    });
  });
</script>

<!-- <Background /> -->
<Select />
{#each objects as object}
  <object.svelteComponent />
{/each}

<style lang="scss">
</style>
