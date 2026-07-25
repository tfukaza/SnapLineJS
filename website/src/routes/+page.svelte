<script lang="ts">
  import SeoHead from "$lib/components/SeoHead.svelte";
  import AssetsShowcase from "$lib/landing/components/AssetsShowcase.svelte";
  import ClosingCta from "$lib/landing/components/ClosingCta.svelte";
  import Hero from "$lib/landing/components/Hero.svelte";
  import Highlights from "$lib/landing/components/Highlights.svelte";
  import Interlude from "$lib/landing/components/Interlude.svelte";
</script>

<SeoHead
  title="SnapEngine | Interactive assets for the web"
  description="Explore a growing family of interactive web assets built on one shared input, layout, collision, and animation engine."
  path="/"
  imageAlt="SnapEngine interactive assets"
/>
<Hero />
<AssetsShowcase />
<Interlude />
<Highlights />
<ClosingCta />

<style lang="scss">
  @use "$lib/landing/landing.scss";
</style>
