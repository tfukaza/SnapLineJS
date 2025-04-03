<script lang="ts">
    import Canvas from "../../lib2/Canvas.svelte";
    import Container from "../../lib2/drag_and_drop/ItemContainer.svelte";
    import Item from "../../lib2/drag_and_drop/Item.svelte";
    let itemArray = []
    for (let i = 0; i < 8; i++) {
        itemArray.push({ id: i, text: `Item ${i}` })
    }
</script>

<Canvas id="container1">
    <Container>
        {#each itemArray as item}
            <Item>
                <div class="drag-drop-demo">{item.text}</div>
            </Item>
        {/each}
    </Container>
</Canvas>