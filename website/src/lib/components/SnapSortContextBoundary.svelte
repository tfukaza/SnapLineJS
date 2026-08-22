<script lang="ts">
  import { setContext } from "svelte";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  setContext("container", null);
  setContext("item", null);
</script>

{@render children()}
