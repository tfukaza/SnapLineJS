<script lang="ts">
  import type {SnapLine} from "../../../../index";
  import { getContext, onMount } from "svelte";
  import { ElementObject } from "../../../../../src/object";
  import { AnimationObject } from "../../../../../src/animation";
  import Exhibit from "./Exhibit.svelte";
  import type { ExhibitProps } from "./Exhibit.svelte";
  
  let engine:SnapLine = getContext("engine");
  let object:ElementObject = new ElementObject(engine.global, null);
  let props:ExhibitProps = {};

  onMount(() => {
    let sequence_1 = new AnimationObject(object, {
    transform: [
      "translate(-50px, 50px)", 
      "translate(50px, 50px)", 
      "translate(50px, -50px)", 
      "translate(-50px, -50px)",
      "translate(-50px, 50px)"
    ],
  },
    {
      duration: 4000,
      easing: ["ease-in-out", "ease-in-out", "ease-in-out", "ease-in-out"],
    },
  );

  let sequence_2 = new AnimationObject(object, {
    backgroundColor: [
      "red",
      "blue",
      "red",
    ],
  },
  {
      duration: 4000,
      offset: [0.45, 0.5, 0.55],
      easing: "linear",
    },
  );
    object.animateSequence([sequence_1, sequence_2]);
    props.play = () => object.animation.play();
    props.pause = () => object.animation.pause();
    props.reverse = () => object.animation.reverse();
    props.cancel = () => object.animation.cancel();
  });
</script>

<Exhibit {props} >
  <div class="circle" bind:this={object.element} style="top: 50%; left: 50%; position: absolute;"></div>
</Exhibit>

  <style lang="scss">
    .circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: rgb(255, 94, 0);
    }
  
  </style>
  