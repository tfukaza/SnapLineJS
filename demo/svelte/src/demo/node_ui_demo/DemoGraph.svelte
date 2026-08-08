<script lang="ts">
  import { ControlledGraph } from "@snap-engine/snapline/svelte";
  import { applyLineChange } from "@snap-engine/snapline";
  import type { LineRecord } from "@snap-engine/snapline";

  // The demo's canonical line document: topology is always controlled, so
  // even a sandbox owns its lines and accepts every atomic proposal.
  // $state.raw because the update pattern is replace-not-mutate — applyLineChange
  // always builds a new array — so deep proxies would be pure overhead, and
  // they would otherwise leak into the reconciler's hot path.
  let lines = $state.raw<LineRecord[]>([]);
</script>

<ControlledGraph
  onLineChangeRequest={(request) => (lines = applyLineChange(lines, request))}
/>
