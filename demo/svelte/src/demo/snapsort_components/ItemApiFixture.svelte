<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container } from "@snap-engine/snapsort/svelte";
  import ItemApiEntries from "./ItemApiEntries.svelte";

  const fixtureEntries = [{ id: "item-api-entries" }];
</script>

<section data-testid="item-api-fixture">
  <Engine id="item-api-engine">
    <Container items={fixtureEntries} config={{ direction: "column" }}>
      {#snippet entry()}
        <ItemApiEntries />
      {/snippet}
    </Container>
  </Engine>
</section>
