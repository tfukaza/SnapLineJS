<script lang="ts">
    import SnapLineContainer from "../lib/SnapLineContainer.svelte";
    import Container from "./Container.svelte";

    let listItems = $state([
        { id: 1, text: "Item 1" },
        { id: 2, text: "Item 2" },
        { id: 3, text: "Item 3" },
        { id: 4, text: "Item 4" },
        { id: 5, text: "Item 5" },
        { id: 6, text: "Item 6" },
        { id: 7, text: "Item 7" },
        // { id: 8, text: "Item 8" },
        // { id: 9, text: "Item 9" },
        // { id: 10, text: "Item 10" },
    ]);
</script>

<SnapLineContainer>
    <Container itemList={listItems} />
</SnapLineContainer>