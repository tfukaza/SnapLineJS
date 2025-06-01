<script lang="ts">
    import Canvas from "../../lib2/Canvas.svelte";
    import Container from "../../lib2/drag_and_drop/ItemContainer.svelte";
    import Item from "../../lib2/drag_and_drop/Item.svelte";
    let itemArray = []
    for (let i = 0; i < 16; i++) {
        let data = { id: i, text: `Item ${i}` };
        itemArray.push(data);
    }
</script>

<Canvas id="container1">
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
</Canvas>
