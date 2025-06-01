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
    $number: [
      0,
      100, 
      200,
      300,
      400,
    ]
  },
    {
      duration: 4000,
      easing: ["ease-in-out", "ease-in-out", "ease-in-out", "ease-in-out"],
      tick: (value) => {
        object.element!.innerHTML = `${value.$number}`;
      }
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

  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    object.animation.progress = parseFloat(input.value);
  }
</script>

<Exhibit {props} >
  <input type="range" min="0" max="1" step="0.001" oninput={handleInput} />
  <div class="circle" bind:this={object.element} style="top: 50%; left: 50%; position: absolute;"></div>
</Exhibit>

  <style lang="scss">
    .circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: rgb(255, 94, 0);
    }

    input {
      width: 100%;
      margin-top: 20px;
    }
  
  </style>
  