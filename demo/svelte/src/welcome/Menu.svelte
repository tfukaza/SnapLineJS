<script lang="ts">
    import { ElementObject } from "../../../../src/object";
    import { getContext, onMount } from "svelte";
    import type { SnapLine } from "../../../../src/index";

    const engine: SnapLine= getContext("engine");

    const PANEL_ASCENDING_DURATION = 200;
    const PANEL_ASCENDING_EASING = "cubic-bezier(.06,.68,.37,1.16)";
    const PANEL_MOVING_DURATION = 1000;
    const PANEL_MOVING_EASING = "cubic-bezier(.12,.86,.49,1.16)";

    function slotShadowLerp(value: number) {
        let Xoffset = 5 * value;
        let Yoffset = 20 * value;
        let blur = 4 * value;
        let shadowBlur = value > 0.01 ? (value + 5) * 2 : 0;
        return `0px 4px ${blur}px 0px rgba(47, 37, 32, 0.12), ${Xoffset}px ${Yoffset}px ${shadowBlur}px 0px rgba(51, 14, 19, 0.15) inset`;
    }

    type MenuCarouselState = "ascending" | "descending" | "selectedIdle" | "moving";

    class MenuCarousel extends ElementObject {
        prevIndex: number;
        animation: Animation | null;
        animationState: MenuCarouselState;
        itemList: MenuItem[];
        movingToIndex: number;

        constructor(engine: SnapLine, parent: ElementObject | null) {
            super(engine.global, parent);
            this.prevIndex = 0;
            this.animation = null;
            this.animationState = "selectedIdle";
            this.itemList = [];
            this.movingToIndex = -1;
            this.elementPositionMode = "fixed";
        }

        lowerAllPanels(targetIndex: number) {
            this.itemList.forEach(item => {
                item.lowerPanel(targetIndex);
            });
            this.animationState = "descending";
        }

        setIndex(index: number) {
            if (index == this.prevIndex) {
                return;
            }
            if (index !== this.prevIndex) {
                console.log("Different index", index, this.prevIndex, this.animationState);
                let offset = index * -400; //this.dom.property.worldWidth;
                if (this.animationState == "moving") {
                    this.animate({
                        from: this.dom.localX,
                        to: offset,
                        duration: PANEL_MOVING_DURATION,
                        easing: PANEL_MOVING_EASING,
                        setValue: (value) => {
                            this.dom.localX = value;
                            this.requestPostWrite();
                        },
                        onStart: () => {
                           
                            this.animationState = "moving";
                        },
                        onFinish: () => {
                            this.itemList[index].raisePanel();
                        }
                    });
                } else if (["ascending", "descending", "selectedIdle"].includes(this.animationState)) {
                    this.lowerAllPanels(index);
                }
        
            } 
            this.prevIndex = index;
        }

        moveToIndex(index: number) {
            let offset = index * -400; //this.dom.property.worldWidth;
            console.log("Moving from", this.dom.localX, "to", offset);
            this.animateTimeline([{
                from: this.dom.localX,
                to: offset,
                duration: this.movingToIndex == index ? 100 : PANEL_MOVING_DURATION,
                // delay: PANEL_ASCENDING_DURATION, // Wait for the item to finish descending before moving to the target location
                easing: PANEL_MOVING_EASING,
                setValue: (value) => {
                    console.log("Setting localX", value);
                    this.dom.localX = value;
                    this.requestPostWrite();
                },
                onStart: () => {
                    this.animationState = "moving";
                    this.movingToIndex = index;
                },
                onFinish: () => {
                    this.itemList[index].raisePanel();
                }
            }]);
        }
    }

    class MenuItem extends ElementObject {
        index: number;
        prevIndex: number;
        animation: Animation | null;
        // animationState: "ascending" | "descending" | "selectedIdle" | "unselectedIdle" | "moving";
        container: MenuCarousel | null;
        currentZ: number;

        constructor(engine: SnapLine, parent: ElementObject | null, index: number) {
            super(engine.global, parent);
            this.index = index;
            this.prevIndex = -1;
            this.animation = null;
            // this.animationState = "unselectedIdle";
            this.container = null;
            this.currentZ = 0;
            this.elementPositionMode = "fixed";
        }

        lowerPanel(targetIndex: number, delay: number = 0) {
           
            let finishCallback = () => {};
            if (targetIndex != -1 && targetIndex == this.index) { 
                // if (this.currentZ >= 0.999) {
                //     this.container!.moveToIndex(targetIndex);
                //     return;
                // } else {
                    finishCallback = () => {
                        console.log("Moving to index", targetIndex);
                        this.container!.moveToIndex(targetIndex);
                    }
                // }
            }
            // console.log("Lowering panel", targetIndex, this.index, finishCallback);
            // console.trace();
            this.animateTimeline([{
                from: this.currentZ,
                to: 1,
                duration: PANEL_ASCENDING_DURATION,
                delay: delay,
                easing: PANEL_ASCENDING_EASING,
                setValue: (value) => {
                    this.currentZ = value;
                    this.dom.style.boxShadow = slotShadowLerp(value);
                    this.position.scaleX = 1 - value * 4/100;
                    this.position.scaleY = 1 - value * 4/100;
                    this.requestPostWrite();
                },
                // onStart: () => {
                //     this.container!.animationState = "descending";
                // },
                onFinish: finishCallback
                
            }]);
          
        }

        raisePanel(delay: number = 0    ) {
            if (this.currentZ <= 0.001) {
                this.container!.animationState = "selectedIdle";
                return;
            }
            this.animateTimeline([{
                from: this.currentZ,
                to: 0,
                duration: PANEL_ASCENDING_DURATION,
                delay: delay,
                easing: PANEL_ASCENDING_EASING,
                setValue: (value) => {
                    this.currentZ = value;
                    this.dom.style.boxShadow = slotShadowLerp(value);
                    this.position.scaleX = 1 - value * 4/100;
                    this.position.scaleY = 1 - value * 4/100;
                    this.requestPostWrite();
                },
                onStart: () => {
                    this.container!.animationState = "ascending";
                },
                onFinish: () => {
                    this.container!.animationState = "selectedIdle";
                }
            }]);
            // this.container!.animationState = "ascending";
        }

        // setPanelLow() {
        //     this.currentZ = 1;
        //     this.dom.style.boxShadow = slotShadowLerp(1);
        //     this.position.scaleX = 1 - 1/100;
        //     this.position.scaleY = 1 - 1/100;
        //     this.requestPostWrite();
        // }
        

        setIndex(index: number) {
            if (index == this.prevIndex) {
                return;
            }

            if (index !== this.index) {
                // if (this.prevIndex == this.index) {
                this.lowerPanel(-1);
                // } else {
                //     this.setPanelLow();
                // }
            } else {
                // If this item was selected...
                // If the item is already in the process of ascending or descending, or if it is already at the target location,
                // move the item up to its selected position
                if (["ascending", "descending", "selectedIdle"].includes(this.container!.animationState)) {
                    // this.animationState = "ascending";
                    // this.setPanelLow();
                    this.raisePanel(PANEL_ASCENDING_DURATION + PANEL_MOVING_DURATION);
                } else {
                    // If the item is not in target location, wait for the carousel to move to the target location,
                    // then move the item up to its selected position
                    // this.setPanelLow();
                    this.raisePanel(PANEL_ASCENDING_DURATION + PANEL_MOVING_DURATION);
                }
            } 
            this.prevIndex = index;
        }
    }

    let menuItems = $state([
        {
            index: 0,
            title: 'UI Engine',
            icon: '🎨',
            object: new MenuItem(engine, null, 0)
        },
        {
            index: 1,
            title: 'Node UI',
            icon: '🎨',
            object: new MenuItem(engine, null, 1)
        },
        {
            index: 2,
            title: 'Drag & Drop',
            icon: '🎨',
            object: new MenuItem(engine, null, 2)
        }
    ]);

    let menuCarousel = new MenuCarousel(engine, null);

    onMount(() => {
        menuCarousel.positionMode = 'relative';
        menuCarousel.setIndex(0);
        menuItems.forEach(item => {
            item.object.container = menuCarousel;
            // item.object.dom.classList = ["menu-plate"];
            item.object.positionMode = 'relative';
            // console.log(item.object);
            // item.object.setIndex(0);
            menuCarousel.itemList.push(item.object);
        });
        
        // let testObject = new ElementObject(engine.global, null);
        // testObject.element = testPlate;
        // testObject.animateTimeline([{
        //     from: 0,
        //     to: 1,
        //     duration: 5000,
        //     easing: "linear",
        //     setValue: (value) => {
        //         console.log(value);
        //         testObject.position.scaleX = value + 1;
        //         testObject.position.scaleY = value + 1;
        //         testObject.requestPostWrite();
        //     }
        // }, {
        //     from: 0,
        //     to: 1,
        //     duration: 5000,
        //     easing: "linear",
        //     setValue: (value) => {
        //         console.log(value);
        //         testObject.position.worldX = value * 100;
        //         testObject.position.worldY = value * 100;
        //         testObject.requestPostWrite();
        //     }
        // }]);
     
    });

    // let menuState: HTMLHeadingElement | null = null;

    function handleSliderChange(event: Event) {
        const slider = event.target as HTMLInputElement;
        const value = parseInt(slider.value);

        let currentIndex = Math.floor(value / (101 / menuItems.length));
        console.log(currentIndex);

        menuCarousel.setIndex(currentIndex);
        // menuItems.forEach(item => {

        //     // console.log(item.object.position);
        //     // item.object.position.scaleX = 1 - value / 4000;
        //     // item.object.position.scaleY = 1 - value / 4000;
        //     // item.object.dom.style.boxShadow = slotShadowLerp(value/100);

        //     item.object.setIndex(currentIndex);
        //     // item.object.requestPostWrite();
        // });
    }

    // Every 100ms, print the current state of the menu carousel
    // setInterval(() => {
    //     menuState!.innerHTML = menuCarousel.animationState;
    // }, 100);
</script>

<!-- <h2 bind:this={menuState}>UI Engine</h2> -->

<div id="menu-container">
    <div class="slot" id="menu-slot">
        <div bind:this={menuCarousel.element} id="menu-carousel">
            {#each menuItems as item}
                <div bind:this={item.object.element} class="menu-plate plate">
                    <h1>{item.title}</h1>
                </div>
            {/each}
        </div>
    </div>   

    <div id="menu-slider">
        <div id="menu-slider-container">
            <input type="range" min="0" max="100" value="0" class="snap-range slot" id="menu-slider-rail" on:input={handleSliderChange} list="menu-slider-datalist">
        </div>
    </div>
</div>
<!-- <datalist id="menu-slider-datalist">
    {#each menuItems as item}
        <option value={Math.floor(100/(menuItems.length-1) * item.index)}></option>
    {/each}
</datalist> -->


<style lang="scss">

    #menu-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
    #menu-slot {
        overflow: hidden;
        position: relative;
        height: 100px;
        width: 400px;
        margin: 0px 20px;
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

       width:400px;
       height: 100px;
       background: #f6f6f6;
       box-sizing: border-box;
       text-align: center;
       
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
        margin-top: 30px;
        #menu-slider-rail {
            height: 10px;
            width: 200px; 
        }
    }
</style>