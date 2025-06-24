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
    const cameraStart = cameraControl.getCameraCenterPosition();
    const cameraTarget = { x: 0, y: cameraControl.global.camera!.cameraHeight / 3.2 };
    cameraControl.queueUpdate("WRITE_1").addCallback(() => {
      cameraControl.animate({
        $t: [0, 1],
      },
      {
        duration: 1000,
        easing: "ease-in-out",
        tick: (values) => {
          cameraControl.updateCameraCenterPosition(
            cameraStart.x + (cameraTarget.x - cameraStart.x) * values.$t,
            cameraStart.y + (cameraTarget.y - cameraStart.y) * values.$t
          );
        },
      });
      cameraControl.animation.play();
    });
  });

</script>

<div id="drag-drop-demo">
  <hr/>
  <div id="drop-zone">
    <Container config={{ direction: "row", groupID: "language-quiz" }}>
      <div />
    </Container>
    <div id="drop-zone-background">
      <span></span>
      <span></span>
    </div>
  </div>
  <hr />
  <div id="item-zone">
    <Container config={{ direction: "row", groupID: "language-quiz" }}>
      {#each japaneseWords as item, i}
        <Item>
          <div class="drag-drop-demo">
            <p>{item}</p>
          </div>
        </Item>
      {/each}
    </Container>
  </div>
  <hr />
  <div id="button-container">
    <button class="primary">Submit</button>
  </div>
</div>

<style lang="scss">
  @import "../../../app.scss";

  #drag-drop-demo {    
    --item-height: 45.5px;
    @media screen and (max-width: 600px) {
      --item-height: 45px;
    }
    @media screen and (max-width: 400px) {
      --item-height: 40px;
    }
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 400px;

    transform: translate(-50%, 80px);

    @media screen and (max-width: 600px) {
      width: 80vw;
    }

    hr {
      width: 100%;
      border: none;
      margin: var(--size-16) 0;
    }

    :global(.ghost) {
      opacity: 0.2;
      background-color: #000;
      margin: 16px;
      border-radius: 8px;
    }
  }

  #drop-zone {
    position: relative;
    min-height: var(--item-height);
    width: 100%;
  
    #drop-zone-background {
      z-index: -1;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      min-height: var(--item-height);
      background: 
        repeating-linear-gradient(0deg, rgba(255, 255, 255, 0) 0px, var(--color-background) 2px, var(--color-background) var(--item-height)),
        repeating-linear-gradient(90deg, black 0px, black 2px, transparent 1px, transparent 6px);
    }

  
  }

  #item-zone {
    width: 100%;
  }

  #button-container {  
    width: 200px;
    @media screen and (max-width: 600px) {
      width: 40vw;
    }
  }

  button {
    width:100%;
  }

</style>