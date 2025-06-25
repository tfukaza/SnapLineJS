<script lang="ts">
  import Container from "./ItemContainer.svelte";
  import Item from "./Item.svelte";
  import "../../../app.scss";
  import { getContext, onMount } from "svelte";
  import { CameraControl } from "../../../../../../src/asset/cameraControl";
  import { fade } from "svelte/transition";

  let cameraControl: CameraControl = getContext("cameraControl");
  let dropZone: HTMLElement;
  let isCorrect = false;

  let japaneseWords = [
    "すごい",
    "が",
    "ドロップ",
    "とても",
    "ウェブ",
    "チョコミント",
    "あなた",
    "の",
    "ドラッグアンド",
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
  ];

  function checkAnswer() {
    
    const correctOrder = [ "ウェブ", "の", "為", "の", "ドラッグアンド", "ドロップ" ];

    if (!dropZone) return;

    const itemsInDropZone = Array.from(dropZone.querySelectorAll('.item p')).map(p => p.textContent?.trim());
    const isCorrectAnswer = itemsInDropZone.length === correctOrder.length && 
                     itemsInDropZone.every((item, index) => item === correctOrder[index]);
    
    if (isCorrectAnswer) {
      isCorrect = true;
      dropZone.querySelectorAll('.item-wrapper').forEach((itemWrapper, index) => {
        itemWrapper.classList.add('correct-wrapper');
        const item = itemWrapper.querySelector('.item');
        if (!item) return;
        item.classList.add('correct');
        item.classList.remove('shake');
        setTimeout(() => {
          item.classList.add('jump');
          setTimeout(() => {
            item.classList.remove('jump');
          }, 600);
        }, index * 50);
      });
    } else {
      isCorrect = false;
      dropZone.querySelectorAll('.item').forEach(item => {
        item.classList.remove('correct');
        item.classList.remove('jump');
        item.classList.add('shake');
        setTimeout(() => {
          item.classList.remove('shake');
        }, 500);
      });
    }
  }

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

<div id="drag-drop-demo" transition:fade>
  <hr/>
  <div id="drop-zone" bind:this={dropZone}>
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
    <button class="primary" on:click={checkAnswer} disabled={isCorrect}>
      {isCorrect ? "Correct!" : "Check"}
    </button>
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
      @media screen and (max-width: 400px) {
        margin: var(--size-8) 0;
      }
    }

    :global(.ghost) {
      opacity: 0.2;
      background-color: #000;
      margin: 16px;
      border-radius: 8px;
    }

    :global(.item-wrapper.correct-wrapper) {
      pointer-events: none;
    }

    :global(.item.correct) {
      background-color: #94f83d !important;
      border: 1px solid #59a51e;
      box-shadow: 0 6px 10px -2px rgba(8, 69, 50, 0.388);
      transition: 0.2s ease-in-out;
      pointer-events: none;
    }

    :global(.item.correct p) {
      color: rgb(39, 113, 14) !important;
    }

    :global(.item.shake) {
      animation: shake 0.5s ease-in-out;
    }

    :global(.item.jump) {
      transform-origin: center;
      animation: jump 0.3s;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
      20%, 40%, 60%, 80% { transform: translateX(4px); }
    }

    @keyframes jump {
      0% { transform: translateY(0) scale(1, 1); animation-timing-function: ease-out;}
      50% { transform: translateY(-16px) scale(0.9, 1.1); animation-timing-function: ease-in;}
      90% { transform: translateY(2px) scale(1.1, 0.9); animation-timing-function: ease-out;}
      100% { transform: translateY(0) scale(1, 1); animation-timing-function: ease-in;}
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