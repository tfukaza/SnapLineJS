<script lang="ts">

  export interface ExhibitProps { 
    play?: () => void;
    pause?: () => void;
    reverse?: () => void;
    cancel?: () => void;
  }
  let { props, children }: { props: ExhibitProps, children: any } = $props();

</script>

<div class="exhibit" id="basic-animation">
  {@render children()}
  <div class="control-panel">
    <button on:click={props.play}>Play</button>
    <button on:click={props.pause}>Pause</button>
    <button on:click={props.reverse}>Reverse</button>
    <button on:click={props.cancel}>Cancel</button>
  </div>
</div>

<style lang="scss">
  .exhibit {
    position: relative;
    background-color: #f0f0f0;
    border-radius: 16px;
    overflow: hidden;
  }
  .control-panel {
    position: absolute;
    top: 0;
    left: 0;
  }

</style>
