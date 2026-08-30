<script lang="ts">
  import SnapDesign from "$lib/landing/snapdesign/SnapDesign.svelte";

  let { data } = $props();
</script>

<SnapDesign codeExamples={data.codeExamples} />
