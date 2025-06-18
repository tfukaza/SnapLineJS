<script lang="ts">

  import { onMount, getContext } from "svelte";
  import { CameraControl } from "../../../../../src/asset/cameraControl";

  let cameraControl: CameraControl = getContext("cameraControl");

  onMount(() => {
    cameraControl.queueUpdate("WRITE_2").addCallback(() => {
      const cameraStart = cameraControl.getCameraCenterPosition();
      const cameraTarget = { x: 0, y: 0 };
      cameraControl.animate(
        { $t: [0, 1] },
        {
          duration: 1000,
          easing: "ease-in-out",
          tick: (values) => {
            cameraControl.updateCameraCenterPosition(
              cameraStart.x + (cameraTarget.x - cameraStart.x) * values.$t,
              cameraStart.y + (cameraTarget.y - cameraStart.y) * values.$t
            );
          },
        }
      );
      cameraControl.animation.play();
    });
  });
</script>


<style lang="scss">
</style>
