<script lang="ts">

    import Canvas from "../lib2/Canvas.svelte";
    import Menu from "./Menu.svelte";
    import CameraControl from "../lib2/CameraControl.svelte";
    import Background from "./Background.svelte";
    import Math from "../demo/node_ui/Math.svelte";
    import ItemContainer from "../lib2/drag_and_drop/ItemContainer.svelte";
    import Item from "../lib2/drag_and_drop/Item.svelte";
</script>
<nav>
   <ul>
    <li>Home</li>
    <li>About</li>
    <li>Contact</li>
   </ul>
</nav>
<div id="landing">
    <Canvas id="welcome-canvas">  
        <CameraControl>
           
            <div class="landing-content">
                <div id="welcome-menu">
                    <Menu />
                    <h1>for the web</h1>
                </div>
            </div> 
            <Math/>
            <Math/>
            <ItemContainer direction="row">
                <Item>
                    <h1>Item 1</h1>
                </Item>
                <Item>
                    <h1>Item 2</h1>
                </Item>
            </ItemContainer>
            <Background></Background>
        </CameraControl>
    </Canvas>
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
    :global(#snap-canvas) {
        width: 80%;
        height: 100%;
        background-color: #F6F6F6;
        border-radius: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .landing-content {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }
    #welcome-menu {
        display: flex;
        flex-direction: row;
        align-items: flex-start;

    }

 

 
</style>