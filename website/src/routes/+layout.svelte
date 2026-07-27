<script lang="ts">
  import { page } from "$app/state";
  import "../../../css/snapdesign.scss";
  import DebugLayoutToolbar from "$lib/components/DebugLayoutToolbar.svelte";
  import {
    exploreEntries,
    getExploreStatusLabel,
    isExploreEntryBrowsable,
  } from "$lib/exploreCatalog";
  import "$lib/fonts.css";
  import { debugLayoutFooterControl } from "$lib/stores/debugLayoutFooter";

  let { children } = $props();

  const repositoryUrl = "https://github.com/tfukaza/SnapEngineJS";
  const assetEntries = [
    {
      assetHref: "/snapsort",
      assetPath: "/snapsort",
      description: "Unstyled components for sortable lists, kanban boards, and more.",
      docsHref: "/docs/snapsort/introduction",
      docsPathPrefix: "/docs/snapsort",
      label: "SnapSort",
    },
    {
      assetHref: "/#asset-snapzap",
      assetPath: null,
      description: "Zoom and pan made simple",
      docsHref: null,
      docsPathPrefix: null,
      label: "SnapZap",
    },
    {
      assetHref: "/snapline",
      assetPath: "/snapline",
      description: "Node-based UI",
      docsHref: "/docs/snapline/introduction",
      docsPathPrefix: "/docs/snapline",
      label: "SnapLine",
    },
  ];
  type MenuName = "assets";

  let activeMenu = $state<MenuName | null>(null);
  let mobileNavOpen = $state(false);
  let navRoot = $state<HTMLElement | null>(null);
  let mobileNavTrigger = $state<HTMLButtonElement | null>(null);
  let assetsMenuTrigger = $state<HTMLButtonElement | null>(null);
  const currentPath = $derived(page.url.pathname as string);
  const isHomePath = $derived(currentPath === "/");
  const isAssetsPath = $derived(
    currentPath.startsWith("/snapsort") ||
      currentPath.startsWith("/docs/snapsort") ||
      currentPath.startsWith("/snapline") ||
      currentPath.startsWith("/docs/snapline"),
  );
  const isAboutPath = $derived(currentPath === "/about");

  function toggleMenu(menu: MenuName) {
    activeMenu = activeMenu === menu ? null : menu;
  }

  function toggleMobileNav() {
    mobileNavOpen = !mobileNavOpen;
    if (!mobileNavOpen) activeMenu = null;
  }

  function closeNavigation() {
    activeMenu = null;
    mobileNavOpen = false;
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (navRoot && event.target instanceof Node && navRoot.contains(event.target)) return;
    closeNavigation();
  }

  function handleWindowKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;

    const focusTarget =
      activeMenu === "assets"
        ? assetsMenuTrigger
        : mobileNavOpen
          ? mobileNavTrigger
          : null;

    closeNavigation();
    focusTarget?.focus();
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeyDown} />

<a class="skip-link button primary small" href="#main-content">Skip to content</a>

<nav class="nav-bar" aria-label="Primary navigation" bind:this={navRoot}>
  <a
    href="/"
    class="wordmark"
    aria-current={isHomePath ? "page" : undefined}
    onclick={closeNavigation}
  >
    SnapEngine
  </a>

  <button
    bind:this={mobileNavTrigger}
    type="button"
    class="mobile-nav-trigger"
    aria-label="Toggle navigation"
    aria-expanded={mobileNavOpen}
    aria-controls="primary-nav-links"
    onclick={toggleMobileNav}
  >
    <span>Menu</span>
    <span class="mobile-nav-icon" aria-hidden="true">{mobileNavOpen ? "×" : "≡"}</span>
  </button>

  <div id="primary-nav-links" class="nav-right" class:is-open={mobileNavOpen}>
    <div class="nav-menu" class:is-open={activeMenu === "assets"}>
      <button
        bind:this={assetsMenuTrigger}
        type="button"
        class="nav-link nav-menu-trigger"
        class:current={isAssetsPath}
        aria-haspopup="true"
        aria-expanded={activeMenu === "assets"}
        aria-controls="assets-nav-menu"
        onclick={() => toggleMenu("assets")}
      >
        Assets
        <svg
          class="nav-chevron"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path d="m3 4.5 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div id="assets-nav-menu" class="nav-dropdown card">
        {#each assetEntries as entry}
          <div class="nav-dropdown-item">
            <a
              class="asset-page-link"
              href={entry.assetHref}
              aria-current={entry.assetPath === currentPath ? "page" : undefined}
              onclick={closeNavigation}
            >
              <span>{entry.label}</span>
              <small>{entry.description}</small>
            </a>
            {#if entry.docsHref && entry.docsPathPrefix}
              <a
                class="docs-page-link"
                href={entry.docsHref}
                aria-current={currentPath.startsWith(entry.docsPathPrefix) ? "page" : undefined}
                onclick={closeNavigation}
              >
                Docs
              </a>
            {:else}
              <span class="docs-page-link docs-page-link-disabled">Docs soon</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <a
      href="/about"
      class="nav-link"
      class:current={isAboutPath}
      aria-current={isAboutPath ? "page" : undefined}
      onclick={closeNavigation}
    >
      About
    </a>
    <a
      href={repositoryUrl}
      class="nav-link github-link"
      aria-label="SnapEngine on GitHub"
      target="_blank"
      rel="noopener noreferrer"
      onclick={closeNavigation}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
      </svg>
    </a>
  </div>
</nav>

<main id="main-content" class="page-content" tabindex="-1">
  {@render children()}
</main>

<footer>
  <div class="app-footer">
    <div class="footer-content">
      <div class="footer-brand">
        <span class="brand-name">SnapEngine</span>
        <span class="copyright">© {new Date().getFullYear()}</span>
      </div>
      <div class="footer-sections">
        <nav class="footer-column" aria-labelledby="footer-assets">
          <h2 id="footer-assets">Assets</h2>
          {#each exploreEntries as entry}
            {#if isExploreEntryBrowsable(entry)}
              <a href={entry.href}>{entry.name}</a>
            {:else}
              <span class="footer-link-disabled">{entry.name} · {getExploreStatusLabel(entry)}</span>
            {/if}
          {/each}
        </nav>
        <nav class="footer-column" aria-labelledby="footer-project">
          <h2 id="footer-project">Project</h2>
          <a href="/about">About</a>
          <a href="/docs/snapengine/introduction">Docs</a>
          <a href="https://github.com/tfukaza/SnapLineJS" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
        <div class="footer-column">
          <a href="/#assets"><h4>Assets</h4></a>
          <span class="footer-link-disabled">SnapZap</span>
          <a href="/snapsort">SnapSort</a>
          <a href="/snapline">SnapLine</a>
        </div>
        {#if $debugLayoutFooterControl}
          <div class="footer-column footer-debug-column">
            <h2>Debug</h2>
            <DebugLayoutToolbar
              debugLayout={$debugLayoutFooterControl.debugLayout}
              onToggle={$debugLayoutFooterControl.onToggle}
            />
          </div>
        {/if}
      </div>
    </div>
  </div>
</footer>

<style lang="scss">
  .skip-link {
    position: fixed;
    z-index: 1000;
    top: var(--size-8);
    left: var(--size-8);
    transform: translateY(calc(-100% - var(--size-16)));

    &:focus {
      transform: translateY(0);
    }
  }

  .page-content:focus {
    outline: none;
  }

  .nav-bar {
    --page-gutter: clamp(var(--size-16), 5vw, var(--size-64));

    position: relative;
    z-index: 30;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--size-32);
    width: min(1200px, calc(100% - (var(--page-gutter) * 2)));
    margin: 0 auto;
    padding: var(--size-16) 0;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.92);
    border-radius: 0 0 var(--size-8) var(--size-8);
    backdrop-filter: blur(12px);
  }

  .wordmark {
    color: #3a2a22;
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
    text-decoration: none;

    &:hover {
      color: var(--color-action);
    }
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: var(--size-24);
  }

  .nav-link,
  .mobile-nav-trigger {
    color: #5e4d44;
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 500;
    line-height: 1.3;
  }

  .nav-link {
    text-decoration: none;
    transition: color 160ms ease;

    &:hover {
      color: var(--color-action);
    }

    &.current {
      color: var(--color-action);
      font-weight: 650;
    }
  }

  .nav-menu {
    position: relative;
    display: flex;
    align-items: center;
    padding-block: var(--size-8);
    margin-block: calc(var(--size-8) * -1);

    &.is-open {
      .nav-menu-trigger {
        color: var(--color-action);
      }

      .nav-chevron {
        transform: rotate(180deg);
      }

      .nav-dropdown {
        opacity: 1;
        visibility: visible;
        transform: translate(-50%, 0);
        pointer-events: auto;
      }
    }
  }

  .nav-menu-trigger,
  .mobile-nav-trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4);
    min-height: 36px;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    cursor: pointer;
  }

  .nav-chevron {
    font-size: 1rem;
    line-height: 1;
    transition: transform 160ms ease;
  }

  .nav-dropdown {
    --card-color: rgba(255, 255, 255, 0.98);
    --card-radius: var(--size-12);

    position: absolute;
    z-index: 40;
    top: 100%;
    left: 50%;
    display: flex;
    min-width: 17rem;
    flex-direction: column;
    gap: var(--size-2);
    opacity: 0;
    visibility: hidden;
    transform: translate(-50%, calc(var(--size-4) * -1));
    pointer-events: none;
    transition:
      opacity 150ms ease,
      visibility 150ms ease,
      transform 150ms ease;
  }

  .nav-dropdown-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--size-8);
    border-radius: var(--size-8);
    transition: background-color 150ms ease;

    &:hover,
    &:focus-within {
      background: rgba(58, 42, 34, 0.05);
    }

    > a {
      color: #5e4d44;
      text-decoration: none;
    }

    > a:hover,
    > a:focus-visible,
    > a[aria-current="page"] {
      color: var(--color-action);
    }
  }

  .asset-page-link {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: var(--size-8) var(--size-12);

    > span {
      font-size: 0.9rem;
      font-weight: 600;
      line-height: 1.3;
    }

    > small {
      max-width: 14rem;
      color: var(--color-text-subtle);
      font-size: 0.75rem;
      font-weight: 400;
      line-height: 1.3;
    }
  }

  .docs-page-link {
    margin-right: var(--size-8);
    padding: var(--size-8);
    border-radius: var(--size-8);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .docs-page-link-disabled {
    color: var(--color-text-subtle);
    cursor: default;
  }

  .github-link {
    display: flex;
    align-items: center;

    svg {
      transition: transform 160ms ease;
    }

    &:hover svg {
      transform: scale(1.08);
    }
  }

  .mobile-nav-trigger {
    display: none;
    gap: var(--size-8);
  }

  .mobile-nav-icon {
    font-family: var(--font-code);
    font-size: 1.25rem;
    line-height: 1;
  }

  @media (max-width: 760px) {
    .nav-bar {
      gap: var(--size-16);
    }

    .mobile-nav-trigger {
      display: inline-flex;
      min-height: 44px;
      padding-inline: var(--size-8);
    }

    .nav-right {
      position: absolute;
      top: calc(100% + var(--size-4));
      right: 0;
      left: 0;
      display: none;
      align-items: stretch;
      flex-direction: column;
      gap: var(--size-4);
      padding: var(--size-12);
      border: 1px solid rgba(58, 42, 34, 0.08);
      border-radius: var(--size-12);
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 16px 40px rgba(31, 30, 41, 0.14);
      max-height: calc(100svh - 5.5rem);
      overflow-y: auto;

      &.is-open {
        display: flex;
      }
    }

    .nav-link,
    .nav-menu-trigger {
      width: 100%;
      min-height: 44px;
      justify-content: space-between;
      padding: var(--size-8) var(--size-12);
      box-sizing: border-box;
      border-radius: var(--size-8);
    }

    .github-link {
      justify-content: flex-start;
    }

    .nav-menu {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;

      &.is-open .nav-dropdown {
        position: static;
        margin-top: var(--size-4);
        opacity: 1;
        visibility: visible;
        transform: none;
        pointer-events: auto;
      }
    }

    .nav-dropdown {
      display: none;
      min-width: 0;
      padding: var(--size-8);
      box-shadow: none;

      .nav-menu.is-open & {
        display: flex;
      }
    }
  }

  footer {
    width: 100%;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }

  .app-footer {
    --page-gutter: clamp(var(--size-16), 5vw, var(--size-64));

    width: min(1200px, calc(100% - (var(--page-gutter) * 2)));
    margin: var(--size-96) auto var(--size-64);
    box-sizing: border-box;
  }

  .footer-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-32);
  }

  .footer-brand {
    display: flex;
    align-items: center;
    gap: var(--size-8);
    color: var(--color-text-subtle);
    font-family: var(--font-body);
    font-size: 0.875rem;
    line-height: 1.4;

    .brand-name {
      color: #3a2a22;
      font-family: var(--font-display);
      font-weight: 600;
    }
  }

  .footer-sections {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: var(--size-48) var(--size-80);
  }

  .footer-column {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-12);

    h2 {
      margin: 0 0 var(--size-4);
      color: var(--color-text);
      font-family: var(--font-label);
      font-size: 0.875rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      line-height: 1.4;
      text-transform: uppercase;
    }

    a,
    .footer-link-disabled {
      margin: 0;
      color: var(--color-text-subtle);
      font-size: 0.9rem;
      font-weight: 400;
      line-height: 1.4;
      text-decoration: none;
    }

    a:hover {
      color: var(--color-action);
    }

    .footer-link-disabled {
      cursor: default;
    }
  }

  @media (max-width: 720px) {
    .footer-sections {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--size-32);
    }
  }

  @media (max-width: 420px) {
    .footer-sections {
      grid-template-columns: 1fr;
    }
  }
</style>
