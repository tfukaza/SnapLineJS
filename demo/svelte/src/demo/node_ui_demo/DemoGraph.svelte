<script lang="ts">
  import { ControlledGraph } from "@snap-engine/snapline-svelte";
  import type { LineChangeRequest, LineRecord } from "@snap-engine/snapline";

  // The demo's canonical line document: topology is always controlled, so
  // even a sandbox owns its lines and accepts every atomic proposal.
  let lines = $state<LineRecord[]>([]);

  function applyRequest(request: LineChangeRequest): void {
    lines = [
      ...lines
        .filter((record) => !request.remove.includes(record.id))
        .map((record) => {
          const update = request.update.find(
            (entry) => entry.id === record.id,
          );
          return update
            ? { ...record, toConnectorId: update.toConnectorId }
            : record;
        }),
      ...request.add,
    ];
  }
</script>

<ControlledGraph {lines} onLineChangeRequest={applyRequest} />
