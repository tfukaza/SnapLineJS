<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { onMount, onDestroy } from "svelte";
  import CollisionBox from "./CollisionBox.svelte";
  import CollisionCircle from "./CollisionCircle.svelte";
  // import CollisionDot from "./CollisionDot.svelte";
  // import CollisionLine from "./CollisionLine.svelte";
  import { BaseObject } from "@snap-engine/core";
  import type { Engine as EngineType } from "@snap-engine/core";

  let engine: EngineType | null = $state(null);
  let boundaryObjects: BaseObject[] = [];

  // Boundary dimensions
  const BOUNDARY_WIDTH = 500;
  const BOUNDARY_HEIGHT = 400;

  // Calculate centered position
  let boundaryLeft = $state(0);
  let boundaryTop = $state(0);

  onMount(() => {
    // Center the boundary on the screen
    boundaryLeft = (window.innerWidth - BOUNDARY_WIDTH) / 2;
    boundaryTop = (window.innerHeight - BOUNDARY_HEIGHT) / 2;

    // // Create 4 wall objects around the boundary
    // // Top wall
    // const topWall = new BaseObject(engine, null);
    // topWall.worldTransform = { x: boundaryLeft, y: boundaryTop - WALL_THICKNESS };
    // const topCollider = new RectCollider(engine, topWall, 0, 0, BOUNDARY_WIDTH, WALL_THICKNESS);
    // topWall.addCollider(topCollider);
    // boundaryObjects.push(topWall);

    // // Bottom wall
    // const bottomWall = new BaseObject(engine, null);
    // bottomWall.worldTransform = { x: boundaryLeft, y: boundaryTop + BOUNDARY_HEIGHT };
    // const bottomCollider = new RectCollider(engine, bottomWall, 0, 0, BOUNDARY_WIDTH, WALL_THICKNESS);
    // bottomWall.addCollider(bottomCollider);
    // boundaryObjects.push(bottomWall);

    // // Left wall
    // const leftWall = new BaseObject(engine, null);
    // leftWall.worldTransform = { x: boundaryLeft - WALL_THICKNESS, y: boundaryTop - WALL_THICKNESS };
    // const leftCollider = new RectCollider(engine, leftWall, 0, 0, WALL_THICKNESS, BOUNDARY_HEIGHT + 2 * WALL_THICKNESS);
    // leftWall.addCollider(leftCollider);
    // boundaryObjects.push(leftWall);

    // // Right wall
    // const rightWall = new BaseObject(engine, null);
    // rightWall.worldTransform = { x: boundaryLeft + BOUNDARY_WIDTH, y: boundaryTop - WALL_THICKNESS };
    // const rightCollider = new RectCollider(engine, rightWall, 0, 0, WALL_THICKNESS, BOUNDARY_HEIGHT + 2 * WALL_THICKNESS);
    // rightWall.addCollider(rightCollider);
    // boundaryObjects.push(rightWall);
  });

  onDestroy(() => {
    for (const obj of boundaryObjects) {
      obj.destroy();
    }
  });
</script>

<Engine id="collision-demo-canvas" bind:engine={engine}>
  <div id="collision-demo">
    <CollisionCircle title="Circle E" initialX={boundaryLeft + 350} initialY={boundaryTop + 50} radius={40} />
    <CollisionBox title="Box A" initialX={boundaryLeft + 50} initialY={boundaryTop + 50} />
    <CollisionBox title="Box B" initialX={boundaryLeft + 200} initialY={boundaryTop + 100} />
    <!-- <CollisionBox title="Box C" initialX={boundaryLeft + 100} initialY={boundaryTop + 200} />
    <CollisionBox title="Box D" initialX={boundaryLeft + 300} initialY={boundaryTop + 200} /> -->
    
    
    <!-- <CollisionCircle title="Circle F" initialX={boundaryLeft + 400} initialY={boundaryTop + 300} radius={35} /> -->
    
    <!-- Dot colliders (point with box and arrow) -->
    <!-- <CollisionDot title="Dot G" initialX={boundaryLeft + 50} initialY={boundaryTop + 320} dotOffsetX={80} dotOffsetY={0} />
    <CollisionDot title="Dot H" initialX={boundaryLeft + 250} initialY={boundaryTop + 20} dotOffsetX={60} dotOffsetY={40} />
     -->
    <!-- Line colliders (draggable endpoints) -->
    <!-- <CollisionLine 
      title="Line I" 
      initialX1={boundaryLeft + 80} 
      initialY1={boundaryTop + 150} 
      initialX2={boundaryLeft + 180} 
      initialY2={boundaryTop + 250} 
    />
    <CollisionLine 
      title="Line J" 
      initialX1={boundaryLeft + 300} 
      initialY1={boundaryTop + 120} 
      initialX2={boundaryLeft + 450} 
      initialY2={boundaryTop + 180} 
    /> -->
    
    <div class="slot boundary" style={`left: ${boundaryLeft}px; top: ${boundaryTop}px;`}></div>
  </div>
</Engine>

<style>
  #collision-demo {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
  }

  .boundary {
      position: absolute;
      width: 500px;
      height: 400px;
      box-sizing: border-box;
      pointer-events: auto;
  }
  
  :global(.collision-box) {
      pointer-events: auto;
  }
</style>
