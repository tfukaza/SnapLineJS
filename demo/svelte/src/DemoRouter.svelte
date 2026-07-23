<script lang="ts">
  import AnimationGalleryPage from "./demo/animation/Gallery.svelte";
  import AnimationVariableBenchPage from "./demo/animation/VariableBenchPage.svelte";
  import DragInputPage from "./demo/input/Drag.svelte";
  import NodeUiPage from "./demo/node_ui_demo/NodeUIDemo.svelte";
  import NodeUiCameraPage from "./demo/node_ui_camera/NodeUICameraDemo.svelte";
  import NodeUiGroupPage from "./demo/node_ui_group/NodeUIGroupDemo.svelte";
  import NodeUiResizePage from "./demo/node_ui_resize/NodeUIResizeDemo.svelte";
  import DropSnapNestedPage from "./demo/drop_snap_nested/DropSnapNestedDemo.svelte";
  import SnapSortComponentsPage from "./demo/snapsort_components/SnapSortComponentsDemo.svelte";
  import SnapSortFileExplorerPage from "./demo/snapsort_file_explorer/SnapSortFileExplorerDemo.svelte";
  import SnapSortInsertionPage from "./demo/snapsort_insertion/SnapSortInsertionDemo.svelte";
  import SnapSortWebsiteCorePage from "./demo/snapsort_website_core/SnapSortWebsiteCoreDemo.svelte";
  import CollisionPage from "./demo/collision/CollisionDemo.svelte";
  import CollisionStressPage from "./demo/collision/CollisionStressDemo.svelte";
  import CameraControlPage from "./demo/camera_control/CameraControlDemo.svelte";
  import TransformCacheBenchPage from "./demo/transform_cache/TransformCacheBench.svelte";

  type DemoRoute = {
    label: string;
    path: string;
    legacyPaths?: string[];
    legacyDemoValues: string[];
    usesDevNav?: boolean;
    supportsDebug?: boolean;
  };

  type DebuggablePage = {
    setDebug(enabled: boolean): void;
  };

  const demoRoutes: DemoRoute[] = [
    {
      label: "Animation Gallery",
      path: "/animation-gallery",
      legacyDemoValues: ["gallery", "welcome"],
    },
    {
      label: "Animation Variable Bench",
      path: "/animation-variable-bench",
      legacyDemoValues: ["variable_bench"],
    },
    {
      label: "Input Control",
      path: "/input-control",
      legacyPaths: ["/input-drag"],
      legacyDemoValues: ["input_control", "drag"],
      supportsDebug: true,
    },
    {
      label: "Camera Control",
      path: "/camera-control",
      legacyDemoValues: ["camera_control"],
    },
    {
      label: "SnapLine",
      path: "/snapline",
      legacyPaths: ["/node-ui"],
      legacyDemoValues: ["snapline", "node_ui"],
    },
    {
      label: "SnapLine Camera",
      path: "/snapline-camera",
      legacyDemoValues: ["snapline_camera"],
    },
    {
      label: "SnapLine Group",
      path: "/snapline-group",
      legacyDemoValues: ["snapline_group"],
    },
    {
      label: "SnapLine Resize",
      path: "/snapline-resize",
      legacyDemoValues: ["snapline_resize"],
    },
    {
      label: "SnapSort",
      path: "/snapsort",
      legacyPaths: ["/drop-snap-nested"],
      legacyDemoValues: ["snapsort", "drop_snap_nested", "drag_drop", "nested_items"],
      supportsDebug: true,
      usesDevNav: true,
    },
    {
      label: "SnapSort Components",
      path: "/snapsort-components",
      legacyPaths: ["/snapsort-duolingo"],
      legacyDemoValues: ["snapsort_components", "snapsort_duolingo"],
      usesDevNav: true,
    },
    {
      label: "SnapSort Insertion",
      path: "/snapsort-insertion",
      legacyDemoValues: ["snapsort_insertion"],
      usesDevNav: true,
    },
    {
      label: "SnapSort Website Core",
      path: "/snapsort-website-core",
      legacyDemoValues: ["snapsort_website_core"],
      usesDevNav: true,
    },
    {
      label: "SnapSort File Explorer",
      path: "/snapsort-file-explorer",
      legacyDemoValues: ["snapsort_file_explorer"],
      usesDevNav: true,
    },
    {
      label: "Collision",
      path: "/collision",
      legacyDemoValues: ["collision"],
    },
    {
      label: "Collision Stress",
      path: "/collision-stress",
      legacyDemoValues: ["collision_stress"],
    },
    {
      label: "Transform Cache Bench",
      path: "/transform-cache-bench",
      legacyDemoValues: ["transform_cache_bench"],
    },
  ];

  const defaultRoute = demoRoutes[0];

  function normalizePath(path: string): string {
    if (path === "/" || path === "") {
      return defaultRoute.path;
    }
    return path.endsWith("/") ? path.slice(0, -1) : path;
  }

  function findRouteByPath(path: string): DemoRoute | undefined {
    const normalizedPath = normalizePath(path);
    return demoRoutes.find(
      (route) =>
        route.path === normalizedPath ||
        route.legacyPaths?.includes(normalizedPath),
    );
  }

  function findRouteByLegacyDemo(value: string | null): DemoRoute | undefined {
    if (!value) {
      return undefined;
    }
    return demoRoutes.find((route) => route.legacyDemoValues.includes(value));
  }

  function getRouteFromUrl(): { path: string; shouldReplaceUrl: boolean } {
    if (typeof window === "undefined") {
      return { path: defaultRoute.path, shouldReplaceUrl: false };
    }

    const params = new URLSearchParams(window.location.search);
    const routeFromQuery = findRouteByLegacyDemo(params.get("demo"));
    if (routeFromQuery) {
      return { path: routeFromQuery.path, shouldReplaceUrl: true };
    }

    const routeFromPath = findRouteByPath(window.location.pathname);
    if (routeFromPath) {
      return {
        path: routeFromPath.path,
        shouldReplaceUrl: window.location.pathname !== routeFromPath.path,
      };
    }

    return { path: defaultRoute.path, shouldReplaceUrl: true };
  }

  const initialRoute = getRouteFromUrl();
  let selectedPath = $state(initialRoute.path);
  let replaceNextNavigation = initialRoute.shouldReplaceUrl;
  let debugEnabled = $state(false);
  let dragInputPageRef: DebuggablePage | null = $state(null);
  let dropSnapNestedPageRef: DebuggablePage | null = $state(null);
  let selectedRoute: DemoRoute = $state(
    findRouteByPath(initialRoute.path) ?? defaultRoute,
  );

  function navigateToSelectedPath(route: DemoRoute) {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    url.pathname = route.path;
    url.search = "";
    url.hash = "";

    if (url.href === window.location.href) {
      replaceNextNavigation = false;
      return;
    }

    if (replaceNextNavigation) {
      window.history.replaceState({}, "", url);
    } else {
      window.history.pushState({}, "", url);
    }
    replaceNextNavigation = false;
  }

  $effect(() => {
    const route = findRouteByPath(selectedPath) ?? defaultRoute;
    selectedRoute = route;
    document.title = route.label;
    navigateToSelectedPath(route);
  });

  $effect(() => {
    const handlePopState = () => {
      const nextRoute = getRouteFromUrl();
      selectedPath = nextRoute.path;
      replaceNextNavigation = nextRoute.shouldReplaceUrl;
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  });

  function toggleDebug(event: Event) {
    if (!selectedRoute.supportsDebug) {
      return;
    }

    const target = event.currentTarget as HTMLInputElement;
    debugEnabled = target.checked;
    dragInputPageRef?.setDebug(debugEnabled);
    dropSnapNestedPageRef?.setDebug(debugEnabled);
  }

  $effect(() => {
    if (!selectedRoute.supportsDebug && debugEnabled) {
      debugEnabled = false;
      dragInputPageRef?.setDebug(false);
      dropSnapNestedPageRef?.setDebug(false);
    }
  });
</script>

<div class="demo-router">
  <div class="demo-nav" class:dev-navbar={selectedRoute.usesDevNav}>
    <label for="demo-select">Demo</label>
    <select id="demo-select" bind:value={selectedPath}>
      {#each demoRoutes as route}
        <option value={route.path}>{route.label}</option>
      {/each}
    </select>

    <label class="debug-toggle" class:disabled={!selectedRoute.supportsDebug}>
      <input
        type="checkbox"
        onchange={toggleDebug}
        checked={debugEnabled}
        disabled={!selectedRoute.supportsDebug}
      />
      <span></span>
      Debug Mode
    </label>
  </div>

  <div class="demo-page">
    {#if selectedPath === "/animation-gallery"}
      <AnimationGalleryPage />
    {:else if selectedPath === "/animation-variable-bench"}
      <AnimationVariableBenchPage />
    {:else if selectedPath === "/input-control"}
      <DragInputPage bind:this={dragInputPageRef} />
    {:else if selectedPath === "/camera-control"}
      <CameraControlPage />
    {:else if selectedPath === "/snapline"}
      <NodeUiPage />
    {:else if selectedPath === "/snapline-camera"}
      <NodeUiCameraPage />
    {:else if selectedPath === "/snapline-group"}
      <NodeUiGroupPage />
    {:else if selectedPath === "/snapline-resize"}
      <NodeUiResizePage />
    {:else if selectedPath === "/snapsort"}
      <DropSnapNestedPage bind:this={dropSnapNestedPageRef} />
    {:else if selectedPath === "/snapsort-components"}
      <SnapSortComponentsPage />
    {:else if selectedPath === "/snapsort-insertion"}
      <SnapSortInsertionPage />
    {:else if selectedPath === "/snapsort-website-core"}
      <SnapSortWebsiteCorePage />
    {:else if selectedPath === "/snapsort-file-explorer"}
      <SnapSortFileExplorerPage />
    {:else if selectedPath === "/collision"}
      <CollisionPage />
    {:else if selectedPath === "/collision-stress"}
      <CollisionStressPage />
    {:else if selectedPath === "/transform-cache-bench"}
      <TransformCacheBenchPage />
    {/if}
  </div>
</div>

<style lang="scss">
  .demo-router {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-background);
  }

  .demo-nav {
    padding: var(--size-12) var(--size-16);
    background-color: var(--color-background);
    border-bottom: 1px solid var(--color-background-dark);
    display: flex;
    align-items: center;
    gap: var(--size-12);
    z-index: 100;
    box-shadow: 0px 4px 12px 0px rgba(0, 0, 0, 0.05);
    width: 100%;
    box-sizing: border-box;
    margin-bottom: var(--size-32);
  }

  .demo-nav label {
    color: var(--color-text);
  }

  .demo-nav select {
    padding: var(--size-8) var(--size-12);
    font-size: 14px;
    border-radius: var(--ui-radius);
    background-color: var(--color-background-tint);
    color: var(--color-text);
    cursor: pointer;
    min-width: 240px;
    font-family: "IBM Plex Mono", monospace;
  }

  .demo-nav select:hover {
    border-color: var(--color-accent);
  }

  .demo-nav select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(255, 117, 58, 0.25);
  }

  .debug-toggle {
    margin-left: auto;
  }

  .demo-page {
    flex: 1;
    background-color: var(--color-background-tint);
    position: relative;
  }

  .debug-toggle.disabled {
    opacity: 0.4;
  }

  .demo-nav.dev-navbar {
    background: #fff;
    border-bottom: 2px solid #000;
    box-shadow: none;
    margin-bottom: 0;

    label,
    select {
      font-family: "Geist", sans-serif;
      color: #000;
    }

    select {
      background: #fff;
      border: 2px solid #000;
      border-radius: 0;
      box-shadow: none;
      font-size: 1rem;
    }

    select:focus {
      border-color: #000;
      box-shadow: none;
    }

    :global(input[type="checkbox"] + span) {
      background: #fff;
      border: 2px solid #000;
      border-radius: 0;
      box-shadow: none;
    }

    :global(input[type="checkbox"] + span::before),
    :global(input[type="checkbox"] + span::after) {
      box-shadow: none;
      border-radius: 0;
    }
  }
</style>
