<script lang="ts">

    import Canvas from "../lib2/Canvas.svelte";
    import Menu from "./Menu.svelte";
    import CameraControl from "../lib2/CameraControl.svelte";
    import Math from "../demo/node_ui/Math.svelte";
    import ItemContainer from "../lib2/drag_and_drop/ItemContainer.svelte";
    import Item from "../lib2/drag_and_drop/Item.svelte";
    import Select from "../lib2/node_ui/Select.svelte";

    let currentDemo = $state(0);
</script>
<nav>
   <ul>
    <li>Home</li>
    <li>About</li>
    <li>Contact</li>
   </ul>
</nav>
<div id="landing">
    <div id="canvas-container">
    <Canvas id="welcome-canvas">     
        <div id="landing-content">
            <div id="landing-menu">
                <Menu bind:currentDemo/>
            </div>
        </div> 
        <CameraControl panLock={true} zoomLock={true}>
            {#if currentDemo === 0}
          
            {/if}
            {#if currentDemo === 1}
                <Math/>
                <Math/>
                <Math/> 
                <Select />
         
            {/if}
        </CameraControl>  
            {#if currentDemo === 2}
                <div id="drag-and-drop-container">
                <ItemContainer direction="row">
                    {#each [1,2,3,4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as item}
                    <Item>
                        <h1 style="width: {(item/40 + 1) * 64}px;">Item {item}</h1>
                    </Item>
                    {/each}
                </ItemContainer> 
                </div>
            {/if}
    </Canvas>
    </div>
</div>

<style lang="scss">
    @import "../../../snap.scss";

    nav {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100px;
        width: 100%;

        ul {
            list-style: none;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
        }
    }
    
    #landing {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 90vh;
        width: 100%;
    }

    #canvas-container {
        width: 1200px;
        height: 90vh;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    :global(#snap-canvas) {
        width: 80%;
        height: 100%;
        background-color: #F6F6F6;
        border-radius: 10px;
    }

    #landing-content {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
    #landing-menu {
        display: flex;
        flex-direction: row;
        align-items: flex-start;

        h1 {
            height: 100px;
            line-height: 100px;
            width: 600px;
            font-weight: 800;
        }

    }

    #drag-and-drop-container {
        display: flex;
        flex-direction: row;

        position: absolute;
        top: 15%;
        left: 50%;
        transform: translate(-50%, 0%);
        align-items: flex-start;

        :global(.item) {
            
            height: 64px;
            background-color: #F6F6F6;
            border-radius: 10px;
            display: flex;
            padding: 10px;
            box-sizing: border-box;
            border: 2px solid black;
            margin: 5px;
        }

        :global(.item h1) {
            font-size: 16px;
            font-weight: 800;
        }
    }
 

 
</style>