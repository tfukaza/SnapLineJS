<script lang="ts">
    import { onMount, setContext, getContext } from "svelte";
    import { Background } from "../../../../src/index";
    import type { SnapLine } from "../../../../src/index";
    let background: HTMLDivElement | null = null;

    const engine:SnapLine = getContext("engine");
    let bg = new Background(engine.global, null);

    setContext("bg", bg);

    onMount(() => {         
        bg.addDom(background as HTMLElement);
    });
</script>


<div id="sl-background" bind:this={background}></div>   


<style lang="scss">
    #sl-background {
        background-color: #fff;
        background-image: radial-gradient(circle, #cccccc 2px, transparent 1px);
        user-select: none;
    }
</style>