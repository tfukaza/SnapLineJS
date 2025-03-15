
<script lang="ts">
    import { RectSelectComponent } from "../../lib/snapline.mjs";
    import { onMount } from "svelte";
    let { global }: { global: any } = $props();
    let selectDOM: HTMLDivElement | null = null;
    let select = new RectSelectComponent(global, null);
    onMount(() => {
        select.addDom(selectDOM);
    });
    
</script>

<div id="select-container" bind:this={selectDOM}></div>


<style>
    #select-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        background-color: rgba(0, 0, 0, 0.103);
    }
</style>