<script lang="ts">
  import { ElementObject } from "../../../../../src/index";
  import { getContext, onMount } from "svelte";
  import type { SnapLine } from "../../../../../src/index";

  const engine: SnapLine = getContext("engine");

  const PANEL_ASCENDING_DURATION = 200;
  const PANEL_ASCENDING_EASING = "cubic-bezier(.06,.68,.37,1.16)";
  const PANEL_MOVING_DURATION = 1000;
  const PANEL_MOVING_EASING = "cubic-bezier(.12,.86,.49,1.16)";

  let { currentDemo = $bindable(0) }: { currentDemo: number } = $props();

  function slotShadowLerp(value: number) {
    let Xoffset = 5 * value;
    let Yoffset = 20 * value;
    let blur = 4 * value;
    let shadowBlur = value > 0.01 ? (value + 5) * 2 : 0;
    return `0px 4px ${blur}px 0px rgba(47, 37, 32, 0.12), ${Xoffset}px ${Yoffset}px ${shadowBlur}px 0px rgba(51, 14, 19, 0.15) inset`;
  }

  type MenuCarouselState =
    | "ascending"
    | "descending"
    | "selectedIdle"
    | "moving";

  class MenuCarousel extends ElementObject {
    prevIndex: number;
    prevIndex1: number;
    animationState: MenuCarouselState;
    itemList: MenuItem[];
    movingToIndex: number;
    initialX: number;

    constructor(engine: SnapLine, parent: ElementObject | null) {
      super(engine.global, parent);
      this.prevIndex = 0;
      this.prevIndex1 = 0;
      this.animationState = "selectedIdle";
      this.itemList = [];
      this.movingToIndex = -1;
      this.transformMode = "direct";
      this.initialX = 0;
    }

    lowerAllPanels(targetIndex: number) {
      this.itemList.forEach((item) => {
        item.lowerPanel(targetIndex);
      });
      this.animationState = "descending";
    }

    setIndex(index: number) {
      if (index == this.prevIndex) {
        return;
      }
      if (index !== this.prevIndex) {
        this.prevIndex = index;
        if (this.animationState == "moving") {
          const property = this.getDomProperty("READ_1");
          let offset = index * -property.width / this.itemList.length;
          let startX = this.prevIndex1 * -property.width / this.itemList.length;
          this.prevIndex1 = index;
          this.animate(
            {
              transform: [
                `translate(${startX}px, 0px)`,
                `translate(${offset}px, 0px)`,
              ],
            },
            {
              duration: PANEL_MOVING_DURATION,
              easing: PANEL_MOVING_EASING,
              finish: () => {
                this.itemList[index].raisePanel();
              },
              tick: (_: Record<string, number>) => {
                for (const item of this.itemList) {
                  item.requestRead(true);
                }
                this.requestRead(true);
              },
            }
          );
          this.animationState = "moving";
          this.animation.play();
        } else if (
          ["ascending", "descending", "selectedIdle"].includes(
            this.animationState
          )
        ) {
          this.lowerAllPanels(index);
        }
      }
    }

    moveToIndex(index: number) {
      const property = this.getDomProperty("READ_1");
      const offset = index * -property.width / this.itemList.length;
      const startX = this.prevIndex1 * -property.width / this.itemList.length;
      this.prevIndex1 = index;
      this.animate(
        {
          transform: [
            `translate(${startX}px, 0px)`,
            `translate(${offset}px, 0px)`,
          ],
        },
        {
          duration: PANEL_MOVING_DURATION,
          easing: PANEL_MOVING_EASING,
          finish: () => {
            this.itemList[index].raisePanel();
          },
          tick: (_: Record<string, number>) => {
            for (const item of this.itemList) {
              item.requestRead(true);
            }
            this.requestRead(true);
          },
        }
      );
      this.animation.play();
      this.animationState = "moving";
      this.movingToIndex = index;
    }
  }

  class MenuItem extends ElementObject {
    index: number;
    prevIndex: number;
    container: MenuCarousel | null;
    currentZ: number;

    constructor(engine: SnapLine, parent: ElementObject | null, index: number) {
      super(engine.global, parent);
      this.index = index;
      this.prevIndex = 0;
      this.container = null;
      this.currentZ = 0;
      this.transformMode = "direct";
    }

    lowerPanel(targetIndex: number, delay: number = 0) {
      this.animate(
        {
          $alpha: [this.currentZ, 1],
        },
        {
          duration: PANEL_ASCENDING_DURATION,
          delay: delay,
          easing: PANEL_ASCENDING_EASING,

          tick: (value: Record<string, number>) => {
            this.currentZ = value["$alpha"];
            this.style.boxShadow = slotShadowLerp(this.currentZ);
            this.transform.scaleX = 1 - (this.currentZ * 4) / 100;
            this.transform.scaleY = 1 - (this.currentZ * 4) / 100;
            this.transform.x = 0; // preRead seems to be setting transform to non-zero values, so we need to set it to zero
            this.transform.y = 0;
            this.requestTransform("WRITE_2");
          },
          finish: () => {
            if (targetIndex != -1 && targetIndex == this.index) {
              this.container!.moveToIndex(targetIndex);
            }
          },
        }
      );
      this.animation.play();
      this.container!.animationState = "descending";
    }

    raisePanel(delay: number = 0) {
      if (this.currentZ <= 0.001) {
        this.container!.animationState = "selectedIdle";
        return;
      }

      const setAlpha = (alpha: number) => {
        this.currentZ = alpha;
        this.style.boxShadow = slotShadowLerp(this.currentZ);
        this.transform.scaleX = 1 - (this.currentZ * 4) / 100;
        this.transform.scaleY = 1 - (this.currentZ * 4) / 100;
        this.transform.x = 0;
        this.transform.y = 0;
        this.requestTransform("WRITE_2");
      };
      this.animate(
        {
          $alpha: [this.currentZ, 0],
        },
        {
          duration: PANEL_ASCENDING_DURATION,
          delay: delay,
          easing: PANEL_ASCENDING_EASING,
          tick: (value: Record<string, number>) => {
            setAlpha(value["$alpha"]);
          },
          finish: () => {
            currentDemo = this.index;
            setAlpha(0);
          },
        }
      );
      this.animation.play();
      this.container!.animationState = "ascending";
    }

    setIndex(index: number) {
      if (index == this.prevIndex) {
        return;
      }
      if (index !== this.index) {
        this.lowerPanel(-1);
      } else {
        this.raisePanel(PANEL_ASCENDING_DURATION + PANEL_MOVING_DURATION);
      }
      this.prevIndex = index;
    }
  }

  let menuItems = $state([
    {
      index: 0,
      title: "UI Engine",
      icon: "🎨",
      object: new MenuItem(engine, null, 0),
    },
    {
      index: 1,
      title: "Node UI",
      icon: "🎨",
      object: new MenuItem(engine, null, 1),
    },
    {
      index: 2,
      title: "Drag & Drop",
      icon: "🎨",
      object: new MenuItem(engine, null, 2),
    },
  ]);

  let menuCarousel = new MenuCarousel(engine, null);

  onMount(() => {
    menuCarousel.setIndex(0);
    menuCarousel.readDom();
    menuItems.forEach((item) => {
      item.object.container = menuCarousel;
      menuCarousel.itemList.push(item.object);
      item.object.requestRead(true);
    });
  });

  function handleSliderChange(event: Event) {
    const slider = event.target as HTMLInputElement;
    const value = parseInt(slider.value);

    let currentIndex = Math.floor(value / (101 / menuItems.length));

    menuCarousel.setIndex(currentIndex);
  }
</script>

<div id="menu-container">
  <div class="slot" id="menu-slot">
    <div bind:this={menuCarousel.element} id="menu-carousel">
      {#each menuItems as item}
        <div bind:this={item.object.element} class="menu-plate card">
          <h1>{item.title}</h1>
        </div>
      {/each}
    </div>
  </div>
  <h1>for the web</h1>

  <div id="menu-slider">
    <div id="menu-slider-container">
      <input
        type="range"
        min="0"
        max="100"
        value="0"
        class="snap-range slot"
        id="menu-slider-rail"
        on:input={handleSliderChange}
        list="menu-slider-datalist"
      />
    </div>
  </div>
</div>

<style lang="scss">

  :root {
    --card-width: 300px;
    --card-height: 100px;

    @media screen and (max-width: 600px) {
      --card-width: 300px;
      --card-height: 80px;
    }
    @media screen and (max-width: 400px) {
      --card-width: 250px;
      --card-height: 60px;
    }

  }
  
  h1 {
    font-weight: 800;
    @media screen and (max-width: 600px) {
      font-size: 1.8rem;
    }
  }


  #menu-container {
    position: absolute;
    display: grid;
    grid-template-columns: auto auto;
    align-items: center;
    justify-items: center;
    gap: 10px;
    width: max-content;
    transform: translate(-50%, -50%);

    @media screen and (max-width: 600px) {
      grid-template-columns: 1fr;
      width: 90vw;
      
    }
  }

  #menu-slot {
    overflow: hidden;
    position: relative;
    height: var(--card-height);
    width: var(--card-width);
  }

  #menu-carousel {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .menu-plate {
    width: calc(var(--card-width) - 2px);
    height: calc(var(--card-height) - 2px);
    margin: 1px;
    background: #f6f6f6;
    box-sizing: border-box;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;


      

    &:nth-child(1) h1 {
    }

    &:nth-child(2) h1 {
    }

    &:nth-child(3) h1 {

    }
  }

  .hide {
    box-shadow:
      0px 4px 5.3px 0px rgba(47, 37, 32, 0.12),
      0px 35px 4.2px 0px rgba(51, 14, 19, 0.15) inset,
      inset 0 0 1px #aca8a5;
    transform-origin: center;
    transform: scale(0.98) translate(0px, -20px);
  }

  #menu-slider {
    #menu-slider-rail {
      height: 10px;
      width: 200px;
    }

    @media screen and (max-width: 600px) {
     grid-area: 1 / 1 / 2 / 2;
      
    }
  }

</style>
