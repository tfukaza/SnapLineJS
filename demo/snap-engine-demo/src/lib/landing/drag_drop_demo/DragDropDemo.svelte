<script lang="ts">
  import Container from "./ItemContainer.svelte";
  import Item from "./Item.svelte";
  import "../../../app.scss";

  let wordArray = [
    "すごい",
    "が",
    "ドロップ",
    "とても",
    "ウェブ",
    "チョコミント",
    "アンド",
    "あなた",
    "の",
    "捨てる",
    "ニューヨーク",
    "よりも",
    "な",
    "の",
    "為",
    "ドラッグストア",
    "は",
    "か",
    "甘い",
    "ドラッグ",
  ];

  let itemArray = wordArray.map((word, i) => ({ id: i, text: word }));
</script>

<Container direction="row">
  {#each itemArray as item, i}
    <Item>
      <div class="drag-drop-demo">
        <p>{item.text}</p>
      </div>
    </Item>
  {/each}
</Container>
