<script lang="ts">
  import { page } from "$app/state";
  import "../../../css/snapdesign.scss";
  import DebugLayoutToolbar from "$lib/components/DebugLayoutToolbar.svelte";
  import FrameworkSelect from "$lib/components/FrameworkSelect.svelte";
  import {
    findProjectForPath,
    projectDestination,
    projectNavigationEntries,
  } from "$lib/projectNavigation";
  import "$lib/fonts.css";
  import { debugLayoutFooterControl } from "$lib/stores/debugLayoutFooter";
  import {
    selectedFramework,
    setSelectedFramework,
    type Framework,
  } from "$lib/stores/frameworkState.svelte";

  let { children } = $props();

  const repositoryUrl = "https://github.com/tfukaza/SnapEngineJS";
  const engineProjects = projectNavigationEntries.filter(
    (project) => project.group === "engine",
  );
  const assetProjects = projectNavigationEntries.filter(
    (project) => project.group === "asset",
  );
  type MobileDocEntry = {
    slug: string;
    title: string;
    project: string;
    section: string;
    framework: string | null;
    frameworkKey: string | null;
  };
  type MobileDocSection = {
    name: string;
    title: string;
    entries: MobileDocEntry[];
  };
  type MobileDocsNavigation = {
    project: string;
    projectTitle: string;
    frameworks: string[];
    sections: MobileDocSection[];
  };
  type MenuName = "projects";

  let activeMenu = $state<MenuName | null>(null);
  let mobileNavOpen = $state(false);
  let navRoot = $state<HTMLElement | null>(null);
  let mobileNavTrigger = $state<HTMLButtonElement | null>(null);
  let projectsMenuTrigger = $state<HTMLButtonElement | null>(null);
  const currentPath = $derived(page.url.pathname as string);
  const currentProject = $derived(findProjectForPath(currentPath));
  const isHomePath = $derived(currentPath === "/");
  const isDocsContext = $derived(currentPath.startsWith("/docs"));
  const isDocsPath = $derived(currentPath.startsWith("/docs"));
  const isAboutPath = $derived(currentPath === "/about");
  const projectSwitchLabel = $derived(currentProject?.title ?? "Explore");
  const contextualDocsHref = $derived(
    currentProject?.status === "available" && currentProject.docsHref
      ? currentProject.docsHref
      : "/docs",
  );
  const mobileDocsNavigation = $derived(
    (page.data as { mobileDocsNavigation?: MobileDocsNavigation | null })
      .mobileDocsNavigation ?? null,
  );
  const currentDocSlug = $derived(page.params.slug ?? "");
  const visibleMobileDocSections = $derived(
    mobileDocsNavigation?.sections
      .map((section) => ({
        ...section,
        entries: section.entries.filter(
          (entry) => !entry.framework || entry.framework === $selectedFramework,
        ),
      }))
      .filter((section) => section.entries.length > 0) ?? [],
  );

  function toggleMenu(menu: MenuName) {
    activeMenu = activeMenu === menu ? null : menu;
    mobileNavOpen = false;
  }

  function toggleMobileNav() {
    mobileNavOpen = !mobileNavOpen;
    activeMenu = null;
  }

  function closeNavigation() {
    activeMenu = null;
    mobileNavOpen = false;
  }

  function handleMobileFrameworkChange(framework: Framework) {
    if (!mobileDocsNavigation) return;

    const allEntries = mobileDocsNavigation.sections.flatMap(
      (section) => section.entries,
    );
    const currentEntry = allEntries.find((entry) => entry.slug === currentDocSlug);
    const equivalentEntry = currentEntry?.frameworkKey
      ? allEntries.find(
          (entry) =>
            entry.project === mobileDocsNavigation.project &&
            entry.section === currentEntry.section &&
            entry.framework === framework &&
            entry.frameworkKey === currentEntry.frameworkKey,
        )
      : null;

    setSelectedFramework(framework, !equivalentEntry);
    closeNavigation();

    if (equivalentEntry) {
      window.location.href = `/docs/${equivalentEntry.slug}?framework=${framework}`;
    }
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (navRoot && event.target instanceof Node && navRoot.contains(event.target)) return;
    closeNavigation();
  }

  function handleWindowKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;

    const focusTarget = activeMenu === "projects"
      ? projectsMenuTrigger
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
  <div class="nav-identity">
    <a
      href="/"
      class="wordmark"
      aria-current={isHomePath ? "page" : undefined}
      onclick={closeNavigation}
    >
      SnapEngine
    </a>

    <div class="nav-menu project-menu" class:is-open={activeMenu === "projects"}>
      <button
        bind:this={projectsMenuTrigger}
        type="button"
        class="project-menu-trigger"
        class:current={Boolean(currentProject)}
        aria-label={`Switch project. Current project: ${projectSwitchLabel}`}
        aria-haspopup="true"
        aria-expanded={activeMenu === "projects"}
        aria-controls="project-nav-menu"
        onclick={() => toggleMenu("projects")}
      >
        <span>{projectSwitchLabel}</span>
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
      <div id="project-nav-menu" class="nav-dropdown project-nav-dropdown card">
        <p class="project-group-label">Engine</p>
        {#each engineProjects as entry}
          {@const destination = projectDestination(entry, isDocsContext)}
          <a
            class="project-nav-link"
            href={destination ?? undefined}
            aria-current={currentProject?.slug === entry.slug ? "page" : undefined}
            onclick={closeNavigation}
          >
            <span>{entry.title}</span>
          </a>
        {/each}
        <p class="project-group-label asset-group-label">Assets</p>
        {#each assetProjects as entry}
          {@const destination = projectDestination(entry, isDocsContext)}
          {#if entry.status === "available" && destination}
            <a
              class="project-nav-link"
              href={destination}
              aria-current={currentProject?.slug === entry.slug ? "page" : undefined}
              onclick={closeNavigation}
            >
              <span>{entry.title}</span>
            </a>
          {:else}
            <span class="project-nav-link project-nav-link-disabled" aria-disabled="true">
              <span>{entry.title}</span>
              <small>Coming soon</small>
            </span>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  <button
    bind:this={mobileNavTrigger}
    type="button"
    class="mobile-nav-trigger"
    aria-label="Toggle navigation"
    aria-expanded={mobileNavOpen}
    aria-controls="primary-nav-links"
    onclick={toggleMobileNav}
  >
    <span class="mobile-nav-icon" aria-hidden="true">{mobileNavOpen ? "×" : "≡"}</span>
  </button>

  <div id="primary-nav-links" class="nav-right" class:is-open={mobileNavOpen}>
    <a
      href={contextualDocsHref}
      class="nav-link"
      class:current={isDocsPath}
      aria-current={isDocsPath ? "page" : undefined}
      onclick={closeNavigation}
    >
      Docs
    </a>

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

    {#if mobileDocsNavigation}
      <div
        class="mobile-doc-navigation"
        role="group"
        aria-label={`${mobileDocsNavigation.projectTitle} documentation`}
      >
        <p class="mobile-doc-project-title">{mobileDocsNavigation.projectTitle} docs</p>
        {#if mobileDocsNavigation.frameworks.length > 1}
          <FrameworkSelect
            id="mobile-header-doc-framework"
            value={$selectedFramework}
            onFrameworkChange={handleMobileFrameworkChange}
          />
        {/if}
        {#each visibleMobileDocSections as section}
          <div class="mobile-doc-section">
            {#if section.name}
              <p class="mobile-doc-section-title">{section.title}</p>
            {/if}
            <ul>
              {#each section.entries as entry}
                <li>
                  <a
                    href={`/docs/${entry.slug}`}
                    class:active={entry.slug === currentDocSlug}
                    aria-current={entry.slug === currentDocSlug ? "page" : undefined}
                    onclick={closeNavigation}
                  >
                    {entry.title}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    {/if}
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
        <nav class="footer-column" aria-labelledby="footer-engine">
          <h2 id="footer-engine">Engine</h2>
          <a href="/">SnapEngine Core</a>
          <a href="/docs/snapengine/introduction">Core documentation</a>
        </nav>
        <nav class="footer-column" aria-labelledby="footer-assets">
          <h2 id="footer-assets">Assets</h2>
          {#each assetProjects as entry}
            {#if entry.status === "available" && entry.marketingHref}
              <a href={entry.marketingHref}>{entry.title}</a>
            {:else}
              <span class="footer-link-disabled">{entry.title} · Coming soon</span>
            {/if}
          {/each}
        </nav>
        <nav class="footer-column" aria-labelledby="footer-project">
          <h2 id="footer-project">Project</h2>
          <a href="/about">About</a>
          <a href="/docs">All documentation</a>
          <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
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

  .nav-identity {
    display: flex;
    align-items: center;
    gap: var(--size-16);
    min-width: 0;
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
      .project-menu-trigger {
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

  .project-menu-trigger,
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

  .project-menu-trigger {
    color: #5e4d44;
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.3;
    transition: color 160ms ease;

    &:hover,
    &:focus-visible,
    &.current {
      color: var(--color-action);
    }
  }

  .nav-chevron {
    font-size: 1rem;
    line-height: 1;
    transition: transform 160ms ease;
  }

  .nav-dropdown {
    --card-color: #fff;
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

  .project-nav-dropdown {
    min-width: 14rem;
    padding: var(--size-12);
  }

  .project-group-label {
    margin: 0;
    padding: var(--size-4) var(--size-12) var(--size-8);
    color: var(--color-text-subtle);
    font-family: var(--font-label);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .asset-group-label {
    margin-top: var(--size-8);
    padding-top: var(--size-12);
    border-top: 1px solid rgba(58, 42, 34, 0.08);
  }

  .project-nav-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-16);
    margin: 0;
    padding: var(--size-8) var(--size-12);
    border-radius: var(--size-8);
    color: #5e4d44;
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.3;
    text-decoration: none;
    transition:
      color 150ms ease,
      background-color 150ms ease;

    small {
      color: var(--color-text-subtle);
      font-size: 0.72rem;
      font-weight: 400;
      white-space: nowrap;
    }
  }

  a.project-nav-link:hover,
  a.project-nav-link:focus-visible,
  a.project-nav-link[aria-current="page"] {
    color: var(--color-action);
    background: rgba(58, 42, 34, 0.05);
  }

  .project-nav-link-disabled {
    opacity: 0.72;
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

  .mobile-doc-navigation {
    display: none;
  }

  @media (max-width: 760px) {
    .nav-bar {
      gap: var(--size-16);
    }

    .mobile-nav-trigger {
      display: inline-flex;
      justify-content: center;
      width: 44px;
      min-height: 44px;
      padding: var(--size-8);
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

    .nav-link {
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

    .project-menu-trigger {
      max-width: 9.5rem;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .mobile-doc-navigation {
      display: block;
      margin-top: var(--size-8);
      padding: var(--size-20) var(--size-12) var(--size-8);
      border-top: 1px solid rgba(58, 42, 34, 0.1);
    }

    .mobile-doc-project-title {
      margin: 0 0 var(--size-20);
      color: var(--color-background-dark);
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 600;
      line-height: 1.2;
    }

    .mobile-doc-section {
      margin-bottom: var(--size-20);

      &:last-child {
        margin-bottom: 0;
      }

      ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        margin: 0;
      }

      a {
        display: block;
        padding: var(--size-8) var(--size-12);
        border-radius: var(--size-8);
        color: var(--color-text);
        font-size: 0.9rem;
        font-weight: 400;
        line-height: 1.3;
        text-decoration: none;

        &:hover,
        &:focus-visible,
        &.active {
          color: var(--color-action);
        }

        &.active {
          font-weight: 600;
        }
      }
    }

    .mobile-doc-section-title {
      margin: 0 0 var(--size-8);
      padding: 0 var(--size-12);
      color: var(--color-background-dark);
      font-family: var(--font-label);
      font-size: 0.86rem;
      font-weight: 400;
      line-height: 1.2;
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
