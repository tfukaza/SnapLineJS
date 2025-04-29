<script lang="ts">
  import type {SnapLine} from "../../../../index";
  import { getContext, onMount } from "svelte";
  import { ElementObject } from "../../../../../src/object";
  import Exhibit from "./Exhibit.svelte";
  import type { ExhibitProps } from "./Exhibit.svelte";
  
  let engine:SnapLine = getContext("engine");
  let object:ElementObject = new ElementObject(engine.global, null);
  let props:ExhibitProps = {};

  onMount(() => {
    object.animate(
      {
        $x: [0, 100],
      },
      {
        duration: 10000,
        easing: "ease-in-out",
        tick: (values) => {
          object.element!.innerHTML = `${values.$x}`;
        },
      },
    );
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
  