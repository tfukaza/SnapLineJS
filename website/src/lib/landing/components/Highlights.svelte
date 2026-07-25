<script lang="ts">
  import InputHandlingCard from "./highlights/InputHandlingCard.svelte";
  import AnimationCard from "./highlights/AnimationCard.svelte";
  import CameraControlCard from "./highlights/CameraControlCard.svelte";
  import DomOptimizationCard from "./highlights/DomOptimizationCard.svelte";
  import CollisionCard from "./highlights/CollisionCard.svelte";
  import "./highlights/highlight-cards.css";
</script>

<section
  id="capabilities"
  class="two-column interactivity-explainer landing-section-gap landing-section-gap-wide"
>
  <div class="interactivity-intro">
    <h2 class="landing-section-heading">What’s included:</h2>
  </div>

  <div class="highlight-card-list">
    <InputHandlingCard />
    <CameraControlCard />
    <AnimationCard />
    <CollisionCard />
    <DomOptimizationCard />
  </div>
</section>

<style lang="scss">
  @use "../landing.scss";
  @import url("https://fonts.googleapis.com/css2?family=Micro+5&display=swap");

  .interactivity-explainer {
    @media (max-width: 900px) {
      grid-template-columns: 1fr !important;
    }
  }

  .interactivity-intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    grid-column: 1 / -1;
    text-align: center;
    width: min(100%, 760px);
    margin: 0 auto clamp(2rem, 4vw, 3.5rem);
  }

  .highlight-card-list {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: clamp(var(--size-24), 4vw, var(--size-48));
    width: 100%;

    > :global(article) {
      width: 100%;
      height: auto;
    }
  }
</style>
