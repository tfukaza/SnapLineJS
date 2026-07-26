<section
  class="closing-cta landing-section-gap landing-section-gap-wide"
  aria-labelledby="closing-cta-title"
>
  <h2 id="closing-cta-title" class="landing-section-heading">
    Get Started
  </h2>
  <p>
    Learn how SnapEngine and its assets work.
  </p>
  <div class="closing-cta-actions">
    <a class="button primary closing-cta-action" href="/docs">
      Read the Documentation
    </a>
  </div>
</section>

<style lang="scss">
  @use "../landing.scss";

  .closing-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--size-24);
    margin-bottom: clamp(5rem, 10vw, 9rem);
    padding: clamp(var(--size-48), 7vw, var(--size-80));
    border-radius: var(--ui-radius);
    background: var(--color-background-tint);
    text-align: center;
  }

  .closing-cta p {
    max-width: 38rem;
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--type-lead);
    line-height: var(--leading-body);
    text-wrap: pretty;
  }

  .closing-cta-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--size-12);
  }

  .closing-cta-action {
    text-decoration: none;
  }

  @media (max-width: 560px) {
    .closing-cta {
      padding: var(--size-48) var(--size-24);
    }

    .closing-cta-actions,
    .closing-cta-action {
      width: 100%;
    }
  }
</style>
