<script lang="ts">
    import SnapLineContainer from "../lib/SnapLineContainer.svelte";
    import Container from "./Container.svelte";

    let itemArray = []
    for (let i = 0; i < 8; i++) {
        itemArray.push({ id: i, text: `Item ${i}` })
    }

    let listItems = $state(itemArray);
</script>

<SnapLineContainer id="container1">
    <Container itemList={listItems} />
</SnapLineContainer>