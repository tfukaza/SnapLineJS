<script lang="ts">
  import Container from "./../../../../../svelte/src/lib/drag_and_drop/ItemContainer.svelte";
  import Item from "./../../../../../svelte/src/lib/drag_and_drop/Item.svelte";
  let itemArray = [];
  for (let i = 0; i < 16; i++) {
    let data = { id: i, text: `Item ${i}` };
    itemArray.push(data);
  }
</script>

<Container direction="row">
  {#each itemArray as item, i}
    <Item>
      <div class="drag-drop-demo">
        {item.text}
        {#if i % 4 == 0}
          More text than usual
        {/if}
      </div>
    </Item>
  {/each}
</Container>
