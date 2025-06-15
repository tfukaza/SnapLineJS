<script lang="ts">
  import Container from "./ItemContainer.svelte";
  import Item from "./Item.svelte";
  import "../../../app.scss";

  let japaneseWords = [
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

</script>

<Container direction="row">
 <div />
</Container>

<hr style="margin: 20px 0;" />

<Container direction="row">
  {#each japaneseWords as item, i}
    <Item>
      <div class="drag-drop-demo">
        <p>{item}</p>
      </div>
    </Item>
  {/each}
</Container>

