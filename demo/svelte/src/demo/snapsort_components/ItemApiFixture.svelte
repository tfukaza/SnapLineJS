<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    createRenderEntries,
    createRenderTree,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import { Container } from "@snap-engine/snapsort/svelte";
  import { renderTreeCallbacks } from "../snapsort-render-tree";
  import ItemApiEntries from "./ItemApiEntries.svelte";

  let fixture = $state.raw(
    createRenderTree(
      createRenderEntries(["generated", "adopted"] as const, (kind) =>
        `item-api-${kind}`,
      ),
    ),
  );
  const callbacks = renderTreeCallbacks(
    (event) => (fixture = reduceRenderTree(fixture, event)),
  );

  function unmountItems() {
    fixture = { ...fixture, entries: [] };
  }
</script>

<section data-testid="item-api-fixture">
  <Engine id="item-api-engine">
    <Container itemId="item-api-root" config={{ direction: "column", callbacks }}>
      <ItemApiEntries entries={fixture.entries} onUnmount={unmountItems} />
    </Container>
  </Engine>
</section>
