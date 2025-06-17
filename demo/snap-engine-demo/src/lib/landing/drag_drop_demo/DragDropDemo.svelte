<script lang="ts">
  import Container from "./ItemContainer.svelte";
  import Item from "./Item.svelte";
  import "../../../app.scss";
  import { getContext, onMount } from "svelte";
  import { CameraControl } from "../../../../../../src/asset/cameraControl";

  let cameraControl: CameraControl = getContext("cameraControl");

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

  onMount(() => {
    cameraControl.queueUpdate("WRITE_1").addCallback(() => {
      cameraControl.updateCameraCenterPosition(0,cameraControl.global.camera!.cameraHeight / 3);
    });
  });

</script>

<div id="drop-zone">
  <Container direction="row">
    <div />
  </Container>
  <div id="drop-zone-background">
    <span></span>
    <span></span>
  </div>
</div>

<hr style="margin: 20px 0;" />

<div id="item-zone">
  <Container direction="row">
    {#each japaneseWords as item, i}
      <Item>
        <div class="drag-drop-demo">
          <p>{item}</p>
        </div>
      </Item>
    {/each}
  </Container>
</div>

<style lang="scss">
  #drop-zone {

    --item-height: 50px;

    display: grid;
    grid-template-columns: repeat(1, 1fr);
    grid-template-rows: repeat(1, 1fr);
    width:400px;
    height: calc(var(--item-height) * 2);

    transform: translate(-50%, 100px);

    > :global(.container) {
      grid-area: 1 / 1 / 2 / 2;
    }
  
    #drop-zone-background {
      z-index: -1;
      grid-area: 1 / 1 / 2 / 2;
      span {
        display: block;
        padding-top: var(--item-height);
        width: 100%;
        border-bottom: 2px dashed #bdbdbd;
      }
    }
  }

  #item-zone {
    width: 400px;
    transform: translate(-50%, 100px);
  }

</style>