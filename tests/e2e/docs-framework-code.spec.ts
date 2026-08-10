import { expect, test, type Locator, type Page } from "@playwright/test";

async function dragBetween(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const [sourceBox, targetBox] = await Promise.all([
    source.boundingBox(),
    target.boundingBox(),
  ]);
  if (!sourceBox || !targetBox)
    throw new Error("Drag target has no layout box.");

  const sourcePoint = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };
  const targetPoint = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2,
  };

  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(sourcePoint.x + 7, sourcePoint.y + 7);
  await page.waitForTimeout(60);
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test("SnapSort Svelte reference lists only its component pages", async ({
  page,
}) => {
  const response = await page.goto(
    "/docs/snapsort/reference/svelte?framework=svelte",
  );
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(
    /\/docs\/snapsort\/reference\/svelte\/container(?:\?framework=svelte)?$/,
  );

  const sidebar = page.locator(".doc-sidebar");
  await expect(sidebar.getByRole("heading", { name: "SnapSort" })).toHaveCount(
    1,
  );
  await expect(
    sidebar.getByRole("link", { name: "Container", exact: true }),
  ).toHaveCount(1);
  await expect(
    sidebar.getByRole("link", { name: "Item", exact: true }),
  ).toHaveCount(1);
  await expect(
    sidebar.getByRole("link", { name: /Svelte (?:Overview|API)/ }),
  ).toHaveCount(0);

  const referenceTitle = sidebar.getByText("Reference", { exact: true });
  const containerLink = sidebar.getByRole("link", {
    name: "Container",
    exact: true,
  });
  const [titleBox, linkBox] = await Promise.all([
    referenceTitle.boundingBox(),
    containerLink.boundingBox(),
  ]);
  expect(titleBox).not.toBeNull();
  expect(linkBox).not.toBeNull();
  expect(linkBox!.x).toBeCloseTo(titleBox!.x, 0);
});

test("Svelte Container properties use live, keyboard-accessible Demo and Code tabs", async ({
  page,
}) => {
  const response = await page.goto(
    "/docs/snapsort/reference/svelte/container?framework=svelte",
  );
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Component Properties", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Snippet Parameters", level: 2 }),
  ).toBeVisible();
  await expect(page.locator(".doc-article")).toContainText('"flow" | "marker"');
  await expect(
    page.getByRole("heading", {
      name: "Move Items Between Containers",
      level: 2,
    }),
  ).toHaveCount(0);
  await expect(page.locator("[data-demo-code-tabs]")).toHaveCount(10);

  const basic = page.locator('[data-demo-code-tabs="container-intro-basic"]');
  await expect(basic.locator(".snapsort-item")).toHaveCount(2);
  await basic.getByRole("tab", { name: "Code" }).click();
  await expect(basic.getByRole("tabpanel")).toContainText(
    "const todos: Task[] = [",
  );
  await expect(basic.locator("pre.shiki.display")).toHaveCount(1);

  const sortable = page.locator(
    '[data-demo-code-tabs="container-intro-sortable"]',
  );
  await expect(sortable.locator(".snapsort-item")).toHaveCount(2);
  await sortable.getByRole("tab", { name: "Code" }).click();
  await expect(sortable.getByRole("tabpanel")).toContainText(
    "config={{ animation: defaultAnimations, callbacks: { onItemMove } }}",
  );

  const mixed = page.locator('[data-demo-code-tabs="container-intro-mixed"]');
  await expect(mixed.locator(".snapsort-container")).toHaveCount(3);
  await expect(mixed.getByText("Today", { exact: true })).toBeVisible();
  await expect(mixed.getByText("Later", { exact: true })).toBeVisible();

  const collection = page.locator(
    '[data-demo-code-tabs="container-property-collection"]',
  );
  const demoTab = collection.getByRole("tab", { name: "Demo" });
  const codeTab = collection.getByRole("tab", { name: "Code" });
  await expect(collection.locator(".property-list")).toBeVisible();
  await expect(demoTab).toHaveAttribute("aria-selected", "true");
  await codeTab.click();
  await expect(codeTab).toHaveAttribute("aria-selected", "true");
  await expect(collection.getByRole("tabpanel")).toContainText(
    "getItemId={(task) => task.key}",
  );
  const codePanel = collection.locator(".code-panel");
  const highlightedCode = codePanel.locator("pre.shiki.display");
  await expect(highlightedCode).toHaveCount(1);
  await expect(highlightedCode).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(highlightedCode).toHaveCSS("color", "rgb(31, 35, 40)");
  await expect(codePanel.locator("pre")).toHaveCount(1);
  await expect(codePanel).toContainText("@snap-engine/snapsort/svelte");
  await expect(codePanel).not.toContainText("@snap-engine/snapsort/react");
  const firstLine = highlightedCode.locator('.line[data-line="1"]');
  await expect(firstLine).toBeVisible();
  expect(
    await firstLine.evaluate(
      (line) => getComputedStyle(line, "::before").content,
    ),
  ).toBe('"1"');

  await codeTab.press("Home");
  await expect(demoTab).toBeFocused();
  await expect(demoTab).toHaveAttribute("aria-selected", "true");
  await demoTab.press("End");
  await expect(codeTab).toBeFocused();
  await expect(codeTab).toHaveAttribute("aria-selected", "true");
  await codeTab.press("ArrowLeft");
  await expect(demoTab).toBeFocused();

  const config = page.locator(
    '[data-demo-code-tabs="container-property-config"]',
  );
  await config.getByRole("button", { name: "Row" }).click();
  await expect(config.locator(".config-list")).toHaveCSS(
    "flex-direction",
    "row",
  );

  const beforeAfter = page.locator(
    '[data-demo-code-tabs="container-property-before-after"]',
  );
  await expect(beforeAfter.locator(".before-after-item")).toHaveCount(2);
  await beforeAfter.getByRole("button", { name: "Add task" }).click();
  await expect(beforeAfter.locator(".before-after-item")).toHaveCount(3);

  const metadata = page.locator(
    '[data-demo-code-tabs="container-property-metadata"]',
  );
  await metadata.evaluate(() => {
    const animationState = window as typeof window & {
      __metadataMoveTransforms?: string[];
    };
    animationState.__metadataMoveTransforms = [];
    const startedAt = performance.now();
    const sampleTransform = () => {
      const draftItem = Array.from(
        document.querySelectorAll<HTMLElement>(".metadata-item"),
      ).find((item) => item.textContent?.includes("Draft copy"));
      if (draftItem) {
        animationState.__metadataMoveTransforms!.push(
          getComputedStyle(draftItem).transform,
        );
      }
      if (performance.now() - startedAt < 500) {
        requestAnimationFrame(sampleTransform);
      }
    };
    requestAnimationFrame(sampleTransform);
  });
  await metadata
    .getByRole("button", { name: "Move Draft copy to Done" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const animationState = window as typeof window & {
          __metadataMoveTransforms?: string[];
        };
        return animationState.__metadataMoveTransforms?.some(
          (transform) => transform !== "none",
        );
      }),
    )
    .toBe(true);
  await expect(metadata.getByText("Draft copy", { exact: true })).toHaveCount(
    1,
  );
  await expect(metadata.locator(".move-status")).toHaveText(
    "Draft copy moved to Done",
  );

  const nested = page.locator(
    '[data-demo-code-tabs="container-property-nested"]',
  );
  const shipSelection = nested.getByRole("button", {
    name: "Select",
    exact: true,
  });
  await shipSelection.click();
  await expect(nested.getByRole("button", { name: "Selected" })).toHaveCount(3);

  const presentation = page.locator(
    '[data-demo-code-tabs="container-property-presentation"]',
  );
  const styledContainer = presentation.getByLabel("Styled task list");
  await expect(styledContainer).toHaveAttribute(
    "data-example-kind",
    "presentation",
  );
  await expect(styledContainer).toHaveClass(/is-emphasized/);
  await presentation.getByRole("button", { name: "Toggle emphasis" }).click();
  await expect(styledContainer).not.toHaveClass(/is-emphasized/);
});

test("Svelte Item reference explains props with live Item and Handle examples", async ({
  page,
  request,
}) => {
  const response = await page.goto(
    "/docs/snapsort/reference/svelte/item?framework=svelte",
  );
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Component Properties", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Handle", level: 2 }),
  ).toBeVisible();
  await expect(page.locator("[data-demo-code-tabs]")).toHaveCount(5);

  const basic = page.locator('[data-demo-code-tabs="item-example-basic"]');
  await expect(basic.locator(".item-demo-card")).toHaveCount(3);
  await basic.getByRole("tab", { name: "Code" }).click();
  await expect(basic.locator("pre.shiki.display")).toHaveCount(1);
  await expect(basic.getByRole("tabpanel")).toContainText(
    "<Item itemId={task.id}",
  );

  const metadata = page.locator(
    '[data-demo-code-tabs="item-example-metadata"]',
  );
  await dragBetween(
    page,
    metadata.locator(".metadata-card").first(),
    metadata.locator(".metadata-card").last(),
  );
  await expect(metadata.locator(".metadata-status")).toHaveText(
    /(?:Dragging|Dropped) brief: Mina · High/,
  );

  const selection = page.locator(
    '[data-demo-code-tabs="item-example-selection"]',
  );
  await expect(
    selection.locator('.selection-card[aria-pressed="true"]'),
  ).toHaveCount(2);
  await selection.getByRole("button", { name: /Gamma/ }).click();
  await expect(
    selection.locator('.selection-card[aria-pressed="true"]'),
  ).toHaveCount(3);
  await expect(selection.locator(".selection-status")).toHaveText(
    "3 items selected",
  );

  const itemInstance = page.locator(
    '[data-demo-code-tabs="item-example-item-instance"]',
  );
  await itemInstance
    .getByRole("button", { name: "Inspect core item" })
    .first()
    .click();
  await expect(itemInstance.locator(".instance-report")).toHaveText(
    "ID: adopt-one · index: 0 · origin: application",
  );
  await itemInstance.getByRole("tab", { name: "Code" }).click();
  await expect(itemInstance.getByRole("tabpanel")).toContainText(
    "new SnapSortItem(engine, container)",
  );
  await expect(itemInstance.getByRole("tabpanel")).toContainText(
    "<Item {item}",
  );
  await expect(itemInstance.getByRole("tabpanel")).toContainText(
    "<!-- AdoptedItemRow.svelte -->",
  );

  const handle = page.locator('[data-demo-code-tabs="item-example-handle"]');
  const initialHandleStatus =
    "Drag with the grip; the Done buttons remain interactive.";
  await expect(handle.locator(".handle-status")).toHaveText(
    initialHandleStatus,
  );

  await dragBetween(
    page,
    handle.locator(".task-label").first(),
    handle.locator(".task-label").last(),
  );
  await expect(handle.locator(".handle-status")).toHaveText(
    initialHandleStatus,
  );

  await dragBetween(
    page,
    handle.getByLabel("Drag Plan release"),
    handle.getByLabel("Drag Ship update"),
  );
  await expect(handle.locator(".handle-status")).toHaveText(
    /(?:Dragging Plan release from its handle|Moved Plan release)/,
  );

  await handle
    .getByRole("button", { name: /Done|Undo/ })
    .first()
    .click();
  await expect(handle.locator(".handle-status")).toHaveText(
    /marked (?:done|not done)$/,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/snapsort/reference/svelte/item?framework=svelte");
  await expect(page.locator(".doc-sidebar")).toBeHidden();
  await expect(page.locator("[data-demo-code-tabs]")).toHaveCount(5);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);

  const markdownResponse = await request.get(
    "/docs/snapsort/reference/svelte/item.md",
  );
  expect(markdownResponse.status()).toBe(200);
  const markdown = await markdownResponse.text();
  expect(markdown).toContain("## Component Properties");
  expect(markdown).toContain("<Item itemId={task.id}");
  expect(markdown).toContain("new SnapSortItem(engine, container)");
  expect(markdown).toContain("<Item {item}");
  expect(markdown).toContain("bind:item");
  expect(markdown).toContain("DragSession.handoff(replacements)");
  expect(markdown).toContain('<Handle className="drag-grip"');
  expect(markdown).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(markdown).not.toContain("<ItemExample");

  const reactMarkdownResponse = await request.get(
    "/docs/snapsort/reference/react/item.md",
  );
  expect(reactMarkdownResponse.status()).toBe(200);
  const reactMarkdown = await reactMarkdownResponse.text();
  expect(reactMarkdown).toContain("## Core Item Access");
  expect(reactMarkdown).toContain("item={existingItem}");
  expect(reactMarkdown).toContain("DragSession.handoff(replacements)");
  expect(reactMarkdown).not.toContain("itemObject");
});

test("SnapSort callback docs expose receiver routing and mutation boundaries", async ({
  page,
  request,
}) => {
  const lifecycleResponse = await page.goto(
    "/docs/snapsort/guides/03_session_lifecycle?framework=react",
  );
  expect(lifecycleResponse?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Terms", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lifecycle", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", {
      name: /root-owned DragSession initiates target resolution.*Ghosts are passive visual data/i,
    }),
  ).toBeVisible();

  const lifecycleDiagram = page.locator(".lifecycle-diagram");
  await expect(lifecycleDiagram.locator("[data-phase]")).toHaveCount(5);
  await expect(lifecycleDiagram).toContainText("Ghost");
  await expect(lifecycleDiagram.locator(".uml-legend")).toHaveCount(0);
  await expect(lifecycleDiagram.locator(".message-label > code")).toHaveCount(
    0,
  );
  const callbackLabel = lifecycleDiagram.locator(
    '[data-step="1.3a"] .message',
  );
  const ordinaryLabel = lifecycleDiagram.locator(
    '[data-step="1.3c"] .message',
  );
  await expect(callbackLabel).toHaveClass(/invokes-callback/);
  await expect(ordinaryLabel).not.toHaveClass(/invokes-callback/);
  await expect(callbackLabel.locator("strong")).toContainText("onGhostInsert");
  await expect(callbackLabel.locator("strong")).not.toContainText(
    "Add source ghost",
  );
  await expect(
    callbackLabel.getByRole("link", { name: "onGhostInsert" }),
  ).toHaveAttribute(
    "href",
    "/docs/snapsort/reference/react/container?framework=react#callbacks",
  );
  const labelStyles = await lifecycleDiagram.evaluate((diagram) => {
    const callbackBadge = diagram.querySelector(
      '[data-step="1.3a"] .step-number',
    );
    const ordinaryBadge = diagram.querySelector(
      '[data-step="1.3c"] .step-number',
    );
    const title = diagram.querySelector('[data-step="1.3a"] strong');
    const lane = diagram.querySelector(".participant");
    const phase = diagram.querySelector(".phase-heading span");
    const branch = diagram.querySelector(".branch-label");
    const detail = diagram.querySelector(".detail");
    if (
      !callbackBadge ||
      !ordinaryBadge ||
      !title ||
      !lane ||
      !phase ||
      !branch ||
      !detail
    ) {
      throw new Error("Missing lifecycle label styles");
    }
    return {
      callbackColor: getComputedStyle(callbackBadge).backgroundColor,
      ordinaryColor: getComputedStyle(ordinaryBadge).backgroundColor,
      titleSize: Number.parseFloat(getComputedStyle(title).fontSize),
      laneSize: Number.parseFloat(getComputedStyle(lane).fontSize),
      phaseSize: Number.parseFloat(getComputedStyle(phase).fontSize),
      branchSize: Number.parseFloat(getComputedStyle(branch).fontSize),
      detailSize: Number.parseFloat(getComputedStyle(detail).fontSize),
      titleFamily: getComputedStyle(title).fontFamily,
      titleWeight: getComputedStyle(title).fontWeight,
      arrowWidth: getComputedStyle(diagram.querySelector(".uml-line")!)
        .strokeWidth,
    };
  });
  expect(labelStyles.callbackColor).not.toBe(labelStyles.ordinaryColor);
  expect(labelStyles.laneSize).toBeGreaterThan(labelStyles.titleSize);
  expect(labelStyles.titleSize).toBeGreaterThan(labelStyles.phaseSize);
  expect(labelStyles.phaseSize).toBeGreaterThan(labelStyles.branchSize);
  expect(labelStyles.detailSize).toBeGreaterThanOrEqual(13);
  expect(labelStyles.titleFamily).toContain("Geist");
  expect(labelStyles.titleWeight).toBe("400");
  expect(Number.parseFloat(labelStyles.arrowWidth)).toBeGreaterThanOrEqual(2);

  const desktopLayout = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing layout element: ${selector}`);
      }
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };

    return {
      viewportWidth: window.innerWidth,
      sidebar: bounds(".doc-sidebar"),
      content: bounds(".doc-content"),
      paragraph: bounds(".doc-article > p"),
      diagram: bounds(".lifecycle-diagram"),
    };
  });
  expect(desktopLayout.sidebar.left).toBeGreaterThanOrEqual(15);
  expect(desktopLayout.sidebar.left).toBeLessThanOrEqual(40);
  expect(desktopLayout.content.width).toBeGreaterThan(700);
  expect(desktopLayout.paragraph.width).toBeLessThanOrEqual(701);
  expect(desktopLayout.diagram.width).toBeGreaterThan(700);
  expect(
    Math.abs(desktopLayout.content.width - desktopLayout.diagram.width),
  ).toBeLessThanOrEqual(1);
  expect(
    await lifecycleDiagram
      .locator(".scroll-region")
      .evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);

  const diagramGeometry = await lifecycleDiagram.evaluate((diagram) => {
    const laneOrder = [
      "item",
      "ghost",
      "root",
      "source",
      "target",
      "app",
      "dom",
    ];
    const center = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const participants = [...diagram.querySelectorAll(".participant")];
    const lifelines = [...diagram.querySelectorAll(".lifeline")].slice(0, 7);
    const laneCenterDeltas = participants.map((participant, index) =>
      Math.abs(center(participant).x - center(lifelines[index]).x),
    );
    const routeGeometry = [...diagram.querySelectorAll(".message-row")]
      .filter((row) => row.querySelector(":scope > .message"))
      .map((row) => {
        const label = row.querySelector(".message-label");
        const route = row.querySelector(".route-svg");
        const head = row.querySelector(".route-head-svg");
        if (!label || !route || !head) {
          throw new Error(`Incomplete route geometry for ${row.dataset.step}`);
        }
        const labelRect = label.getBoundingClientRect();
        const messageRect = row
          .querySelector(":scope > .message")!
          .getBoundingClientRect();
        const routeCenter = center(route);
        const headCenter = center(head);
        const from = laneOrder.indexOf(row.dataset.from ?? "");
        const to = laneOrder.indexOf(row.dataset.to ?? "");
        const expectedLeft = center(lifelines[Math.min(from, to)]).x;
        const expectedRight = center(lifelines[Math.max(from, to)]).x;
        return {
          step: row.dataset.step,
          labelGap: routeCenter.y - labelRect.bottom,
          headDelta: Math.abs(routeCenter.y - headCenter.y),
          leftDelta: Math.abs(messageRect.left - expectedLeft),
          rightDelta: Math.abs(messageRect.right - expectedRight),
        };
      });

    const selfLoopGeometry = [...diagram.querySelectorAll(".self-route")].map(
      (route) => {
        const rect = route.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      },
    );

    return { laneCenterDeltas, routeGeometry, selfLoopGeometry };
  });
  expect(Math.max(...diagramGeometry.laneCenterDeltas)).toBeLessThan(0.1);
  for (const route of diagramGeometry.routeGeometry) {
    expect(
      route.labelGap,
      `${route.step} label overlaps its arrow`,
    ).toBeGreaterThanOrEqual(1);
    expect(route.headDelta, `${route.step} arrowhead is off-axis`).toBeLessThan(
      0.1,
    );
    expect(route.leftDelta, `${route.step} starts off-lifeline`).toBeLessThan(
      2,
    );
    expect(route.rightDelta, `${route.step} ends off-lifeline`).toBeLessThan(2);
  }
  for (const loop of diagramGeometry.selfLoopGeometry) {
    expect(loop.width).toBeLessThanOrEqual(64.1);
    expect(loop.width / loop.height).toBeCloseTo(64 / 44, 2);
  }

  await page.setViewportSize({ width: 2200, height: 900 });
  const wideLaneGeometry = await lifecycleDiagram.evaluate((diagram) => {
    const sequence = diagram.querySelector(".sequence");
    if (!(sequence instanceof HTMLElement)) {
      throw new Error("Missing lifecycle sequence");
    }
    const laneWidths = [...diagram.querySelectorAll(".participant")].map(
      (participant) => participant.getBoundingClientRect().width,
    );
    return {
      diagramWidth: diagram.getBoundingClientRect().width,
      sequenceWidth: sequence.getBoundingClientRect().width,
      widestLane: Math.max(...laneWidths),
    };
  });
  expect(wideLaneGeometry.sequenceWidth).toBeLessThanOrEqual(1400.1);
  expect(wideLaneGeometry.widestLane).toBeLessThanOrEqual(200.1);
  expect(
    wideLaneGeometry.diagramWidth - wideLaneGeometry.sequenceWidth,
  ).toBeLessThanOrEqual(49);
  await page.setViewportSize({ width: 1280, height: 720 });

  const ghostRemoval = lifecycleDiagram.locator('[data-step="2.3a"]');
  await expect(ghostRemoval).toHaveAttribute("data-from", "root");
  await expect(ghostRemoval).toHaveAttribute("data-to", "source");
  await expect(ghostRemoval).toHaveAttribute("data-kind", "sync");
  await expect(ghostRemoval).toContainText("onGhostRemove");

  const ghostDomRemoval = lifecycleDiagram.locator('[data-step="2.3c"]');
  await expect(ghostDomRemoval).toHaveAttribute("data-from", "app");
  await expect(ghostDomRemoval).toHaveAttribute("data-to", "dom");
  await expect(ghostDomRemoval).toContainText("Commit ghost removal");

  const ghostDomRemovalReturn = lifecycleDiagram.locator('[data-step="2.3d"]');
  await expect(ghostDomRemovalReturn).toHaveAttribute("data-from", "dom");
  await expect(ghostDomRemovalReturn).toHaveAttribute("data-to", "app");
  await expect(ghostDomRemovalReturn).toHaveAttribute("data-kind", "return");
  await expect(ghostDomRemovalReturn).toContainText("DOM commit complete");

  const ghostRemovalFlushReturn =
    lifecycleDiagram.locator('[data-step="2.3e"]');
  await expect(ghostRemovalFlushReturn).toHaveAttribute("data-from", "app");
  await expect(ghostRemovalFlushReturn).toHaveAttribute("data-to", "root");
  await expect(ghostRemovalFlushReturn).toHaveAttribute("data-kind", "return");

  const ghostAddition = lifecycleDiagram.locator('[data-step="2.4a"]');
  await expect(ghostAddition).toHaveAttribute("data-from", "root");
  await expect(ghostAddition).toHaveAttribute("data-to", "target");
  await expect(ghostAddition).toContainText("onGhostInsert");

  const ghostAdditionDomReturn = lifecycleDiagram.locator('[data-step="2.4e"]');
  await expect(ghostAdditionDomReturn).toHaveAttribute("data-from", "dom");
  await expect(ghostAdditionDomReturn).toHaveAttribute("data-to", "app");
  await expect(ghostAdditionDomReturn).toHaveAttribute("data-kind", "return");
  await expect(ghostAdditionDomReturn).toContainText("DOM commit complete");

  for (const step of ["2.5", "2.5r", "4.2", "4.2r"]) {
    const notification = lifecycleDiagram.locator(`[data-step="${step}"]`);
    await expect(notification).toHaveAttribute("data-from", "root");
    await expect(notification).toHaveAttribute("data-to", "root");
  }

  const phaseLabels = await lifecycleDiagram
    .locator(".phase-heading span")
    .all();
  for (const label of phaseLabels) {
    expect(
      await label.evaluate(
        (element) => getComputedStyle(element).textTransform,
      ),
    ).toBe("none");
  }

  const normalCommitStep = lifecycleDiagram.locator('[data-step="3.2a"]');
  await expect(lifecycleDiagram.locator('[data-step="3.1a"]')).toContainText(
    "onGhostRemove",
  );
  await expect(normalCommitStep).toContainText("onItemMove");
  await expect(normalCommitStep).toContainText("onItemInsert");
  const collectionUpdateStep = lifecycleDiagram.locator('[data-step="3.2b"]');
  await collectionUpdateStep.locator(".message, .self-message").hover();
  await expect(collectionUpdateStep.locator(".detail")).toBeVisible();
  await expect(collectionUpdateStep.locator(".detail")).toContainText(
    "The source receives no onItemRemove callback.",
  );

  for (const step of ["3.1d", "3.2d", "3.3d"]) {
    const domReturn = lifecycleDiagram.locator(`[data-step="${step}"]`);
    await expect(domReturn).toHaveAttribute("data-from", "dom");
    await expect(domReturn).toHaveAttribute("data-to", "app");
    await expect(domReturn).toHaveAttribute("data-kind", "return");
  }
  for (const step of ["3.1e", "3.2e", "3.3e"]) {
    const transactionReturn = lifecycleDiagram.locator(`[data-step="${step}"]`);
    await expect(transactionReturn).toHaveAttribute("data-from", "app");
    await expect(transactionReturn).toHaveAttribute("data-to", "root");
    await expect(transactionReturn).toHaveAttribute("data-kind", "return");
  }

  await expect(lifecycleDiagram.locator('[data-step="4.4"]')).toHaveAttribute(
    "data-kind",
    "return",
  );
  await expect(lifecycleDiagram.locator('[data-step="4.5"]')).toHaveAttribute(
    "data-kind",
    "async",
  );
  await expect(
    lifecycleDiagram.locator('[data-phase="finish"]'),
  ).not.toContainText(/WRITE_1|WRITE_2|READ_2/);
  await expect(lifecycleDiagram.locator('[data-step="5.1b"]')).toContainText(
    "onItemRemove",
  );
  await expect(lifecycleDiagram.locator('[data-step^="5.2"]')).toHaveCount(0);
  await expect(lifecycleDiagram).not.toContainText(
    /flow-copy|transient clone/i,
  );
  await expect(lifecycleDiagram).toContainText('dragVisual = "item"');
  await expect(lifecycleDiagram).toContainText('dragVisual = "preview"');
  await expect(lifecycleDiagram).toContainText('dragVisual = "none"');
  await expect(lifecycleDiagram).toContainText("Independent placement feedback");
  await expect(
    lifecycleDiagram.getByRole("link", { name: "flushMutation" }).first(),
  ).toBeVisible();

  for (const framework of ["react", "svelte"] as const) {
    await page.goto(
      `/docs/snapsort/guides/03_session_lifecycle?framework=${framework}`,
    );
    await expect(page.locator(".lifecycle-diagram")).not.toContainText(
      "createGhost",
    );
    await expect(
      page
        .locator(".lifecycle-diagram")
        .getByRole("link", { name: "flushMutation" })
        .first(),
    ).toBeVisible();
  }

  await page.goto(
    "/docs/snapsort/guides/03_session_lifecycle?framework=vanilla",
  );
  const vanillaDiagram = page.locator(".lifecycle-diagram");
  await expect(vanillaDiagram).toContainText("createGhost");
  await expect(vanillaDiagram).not.toContainText("flushMutation");
  await expect(vanillaDiagram.locator("[data-phase]")).toHaveCount(5);
  for (const [callStep, returnStep, receiver] of [
    ["1.3e", "1.3f", "source"],
    ["1.4e", "1.4f", "root"],
    ["1.6e", "1.6f", "target"],
    ["2.3b", "2.3c", "source"],
    ["2.4b", "2.4c", "target"],
    ["3.1b", "3.1c", "target"],
    ["3.2b", "3.2c", "target"],
    ["3.3b", "3.3c", "source"],
    ["5.1c", "5.1d", "source"],
  ] as const) {
    const domCall = vanillaDiagram.locator(`[data-step="${callStep}"]`);
    await expect(domCall).toHaveAttribute("data-to", "dom");
    await expect(domCall).toHaveAttribute("data-kind", "sync");

    const domReturn = vanillaDiagram.locator(`[data-step="${returnStep}"]`);
    await expect(domReturn).toHaveAttribute("data-from", "dom");
    await expect(domReturn).toHaveAttribute("data-to", receiver);
    await expect(domReturn).toHaveAttribute("data-kind", "return");
    await expect(domReturn).toContainText(/returned|complete/);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/snapsort/guides/03_session_lifecycle?framework=react");
  await expect(page.locator(".doc-sidebar")).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(
    await page
      .locator(".lifecycle-diagram .scroll-region")
      .evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);

  await page.setViewportSize({ width: 1280, height: 720 });

  const callbackNames = [
    "onItemMove",
    "onItemInsert",
    "onItemRemove",
    "onItemSwap",
    "onDragStart",
    "onDragEnd",
    "onDropTargetChange",
    "onDragItemEnter",
    "onDragItemMove",
    "onDragItemLeave",
    "onVisualGeometryInvalidated",
    "canDrop",
    "getDropPriority",
    "getInsertionMarkerRect",
    "getItemHitbox",
    "createGhost",
    "onGhostInsert",
    "onGhostRemove",
    "flushMutation",
    "awaitMutation",
  ];

  for (const framework of ["svelte", "react"] as const) {
    const response = await page.goto(
      `/docs/snapsort/reference/${framework}/container?framework=${framework}`,
    );
    expect(response?.status()).toBe(200);

    const callbackTable = page.locator("table").filter({
      has: page.getByRole("columnheader", { name: "Fires on" }),
    });
    await expect(callbackTable).toHaveCount(1);
    await expect(callbackTable.getByRole("row")).toHaveCount(21);
    expect(
      await callbackTable.evaluate(
        (element) => element.getBoundingClientRect().width,
      ),
    ).toBeLessThanOrEqual(701);
    for (const callbackName of callbackNames) {
      await expect(
        callbackTable.getByRole("row").filter({ hasText: `${callbackName}(` }),
      ).toHaveCount(1);
    }

    await expect(
      callbackTable.getByRole("row").filter({ hasText: "onDragStart(" }),
    ).toContainText("Tree root");
    await expect(
      callbackTable.getByRole("row").filter({ hasText: "onItemMove(" }),
    ).toContainText("Direct destination");
    await expect(
      callbackTable.getByRole("row").filter({ hasText: "onItemSwap(" }),
    ).toContainText("pre-swap direct source");
  }

  const lifecycleMarkdownResponse = await request.get(
    "/docs/snapsort/guides/03_session_lifecycle.md",
  );
  expect(lifecycleMarkdownResponse.status()).toBe(200);
  const lifecycleMarkdown = await lifecycleMarkdownResponse.text();
  expect(lifecycleMarkdown).toContain("## Terms");
  expect(lifecycleMarkdown).toContain("## Lifecycle");

  for (const framework of ["svelte", "react"] as const) {
    const markdownResponse = await request.get(
      `/docs/snapsort/reference/${framework}/container.md?framework=${framework}`,
    );
    expect(markdownResponse.status()).toBe(200);
    const markdown = await markdownResponse.text();
    expect(markdown).toContain(
      "| Callback | Fires on | Built-in modes / trigger | Notes |",
    );
    for (const callbackName of callbackNames) {
      expect(markdown).toContain(`\`${callbackName}`);
    }
  }
});

test("framework selector shows only its matching install code block", async ({
  page,
}) => {
  const response = await page.goto(
    "/docs/snapsort/introduction/01_setup?framework=svelte",
  );
  expect(response?.status()).toBe(200);
  await page.waitForFunction(
    () => localStorage.getItem("preferredCodeFramework") === "svelte",
  );

  const visibleInstallBlocks = page
    .locator(".framework-code-block:visible")
    .filter({
      hasText: "npm install",
    });

  await expect(visibleInstallBlocks).toHaveCount(1);
  await expect(visibleInstallBlocks).toContainText(
    "npm install @snap-engine/snapsort @snap-engine/asset-base",
  );
  await expect(visibleInstallBlocks).not.toContainText(
    "@snap-engine/asset-base/svelte",
  );
  await expect(visibleInstallBlocks).not.toContainText(
    "@snap-engine/snapsort/svelte",
  );

  await page.locator("#desktop-doc-framework").selectOption("react");

  await expect(page.locator(".doc-article")).toHaveAttribute(
    "data-framework",
    "react",
  );
  await expect(visibleInstallBlocks).toHaveCount(1);
  await expect(visibleInstallBlocks).toContainText(
    "npm install @snap-engine/snapsort @snap-engine/asset-base react react-dom",
  );
  await expect(visibleInstallBlocks).not.toContainText(
    "@snap-engine/asset-base/react",
  );
  await expect(visibleInstallBlocks).not.toContainText(
    "@snap-engine/snapsort/react",
  );
});

test("coding-agent resource links bypass client-side routing", async ({
  page,
}) => {
  await page.goto("/docs/snapsort/introduction");

  const markdownLink = page.getByRole("link", {
    name: "this page as Markdown",
  });
  await expect(markdownLink).toHaveAttribute("data-sveltekit-reload", "");
  const markdownResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/docs/snapsort/introduction.md"),
  );
  await markdownLink.click();
  expect((await markdownResponsePromise).status()).toBe(200);
  await expect(page).toHaveURL(/\/docs\/snapsort\/introduction\.md$/);

  await page.goto("/docs/snapsort/introduction");
  const indexLink = page.locator('a[href="/docs/snapsort/llms.txt"]');
  await expect(indexLink).toHaveAttribute("data-sveltekit-reload", "");
  const indexResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/docs/snapsort/llms.txt"),
  );
  await indexLink.click();
  expect((await indexResponsePromise).status()).toBe(200);
  await expect(page).toHaveURL(/\/docs\/snapsort\/llms\.txt$/);
});

test("raw Markdown selects one framework without damaging fenced code", async ({
  request,
}) => {
  const svelteResponse = await request.get(
    "/docs/snapsort/introduction/01_setup.md",
  );
  expect(svelteResponse.status()).toBe(200);
  expect(svelteResponse.headers()["content-type"]).toContain("text/markdown");

  const svelteMarkdown = await svelteResponse.text();
  expect(svelteMarkdown).toContain("# Quickstart");
  expect(svelteMarkdown).toContain('```svelte\n<script lang="ts">');
  expect(svelteMarkdown).toContain("@snap-engine/snapsort/svelte");
  expect(svelteMarkdown).not.toContain("@snap-engine/snapsort/react");
  expect(svelteMarkdown).not.toContain("framework=Svelte");
  expect(svelteMarkdown).not.toContain("\nproject: snapsort\n");
  expect(svelteMarkdown).toContain(
    "npm install @snap-engine/snapsort @snap-engine/asset-base",
  );
  expect(svelteMarkdown).not.toContain("@snap-engine/snapsort-svelte");

  const reactResponse = await request.get(
    "/docs/snapsort/introduction/01_setup.md?framework=react",
  );
  expect(reactResponse.status()).toBe(200);
  const reactMarkdown = await reactResponse.text();
  expect(reactMarkdown).toContain("```tsx");
  expect(reactMarkdown).toContain("@snap-engine/snapsort/react");
  expect(reactMarkdown).not.toContain("@snap-engine/snapsort/svelte");
  expect(reactMarkdown).not.toContain("framework=React");

  const vanillaResponse = await request.get(
    "/docs/snapsort/introduction/01_setup.md?framework=vanilla",
  );
  expect(vanillaResponse.status()).toBe(200);
  const vanillaMarkdown = await vanillaResponse.text();
  expect(vanillaMarkdown).toContain("```javascript");
  expect(vanillaMarkdown).toContain("new CollisionEngine()");
  expect(vanillaMarkdown).not.toContain("@snap-engine/snapsort/react");
});

test("raw Markdown switches paired reference pages and cleans interactive MDX", async ({
  request,
}) => {
  const pairedResponse = await request.get(
    "/docs/snapsort/reference/svelte/container.md?framework=react",
  );
  expect(pairedResponse.status()).toBe(200);
  const pairedMarkdown = await pairedResponse.text();
  expect(pairedMarkdown).toContain("# Container");
  expect(pairedMarkdown).not.toContain("React Container component props");
  expect(pairedMarkdown).toContain("@snap-engine/snapsort/react");
  expect(pairedMarkdown).not.toContain("@snap-engine/snapsort/svelte");

  const svelteReferenceResponse = await request.get(
    "/docs/snapsort/reference/svelte/container.md",
  );
  expect(svelteReferenceResponse.status()).toBe(200);
  const svelteReferenceMarkdown = await svelteReferenceResponse.text();
  expect(svelteReferenceMarkdown).toContain("## Component Properties");
  expect(svelteReferenceMarkdown).toContain("const todos: Task[] = [");
  expect(svelteReferenceMarkdown).toContain('{#if boardEntry.kind === "task"}');
  expect(svelteReferenceMarkdown).toContain("getItemId={(task) => task.key}");
  expect(svelteReferenceMarkdown).toContain("{#snippet ghost(event)}");
  expect(svelteReferenceMarkdown).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(svelteReferenceMarkdown).not.toContain("<ContainerIntroExample");
  expect(svelteReferenceMarkdown).not.toContain("<ContainerPropertyExample");

  const interactiveResponse = await request.get(
    "/docs/snapsort/guides/01_core_concepts.md",
  );
  expect(interactiveResponse.status()).toBe(200);
  const interactiveMarkdown = await interactiveResponse.text();
  expect(interactiveMarkdown).toContain("# Core Concepts");
  expect(interactiveMarkdown).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(interactiveMarkdown).toContain(
    "https://snapengine.dev/docs/snapsort/guides/01_core_concepts",
  );
  expect(interactiveMarkdown).not.toContain("<SnapSortConceptsDiagram");
  expect(interactiveMarkdown).not.toContain("<SnapSortEntityCue");
  expect(interactiveMarkdown).not.toContain("<script>");
});

test("raw Markdown validates routes and framework values", async ({
  request,
}) => {
  const indexResponse = await request.get("/docs/snapsort/introduction.md");
  expect(indexResponse.status()).toBe(200);
  expect(await indexResponse.text()).toContain("# What is SnapSort?");

  const redirectedResponse = await request.get("/docs/snapsort.md", {
    maxRedirects: 0,
  });
  expect(redirectedResponse.status()).toBe(308);
  expect(redirectedResponse.headers().location).toBe(
    "/docs/snapsort/introduction.md",
  );

  const invalidFramework = await request.get(
    "/docs/snapsort/introduction/01_setup.md?framework=vue",
  );
  expect(invalidFramework.status()).toBe(400);

  const missingPage = await request.get("/docs/snapsort/not-a-page.md");
  expect(missingPage.status()).toBe(404);
});

test("SnapEngine browser support exposes its audited feature matrix", async ({
  page,
  request,
}) => {
  const response = await page.goto(
    "/docs/snapengine/introduction/09_browser_support",
  );
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Browser Support", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Chrome Android" }).first(),
  ).toBeVisible();

  const customVariableRow = page
    .getByRole("row")
    .filter({ hasText: "Custom $variable animation" });
  await expect(customVariableRow).toContainText("128+");
  await expect(customVariableRow).toContainText("16.4+");
  await expect(
    page.getByRole("link", { name: "CSS.registerProperty()" }).first(),
  ).toHaveAttribute(
    "href",
    "https://developer.mozilla.org/en-US/docs/Web/API/CSS/registerProperty_static",
  );

  const markdownResponse = await request.get(
    "/docs/snapengine/introduction/09_browser_support.md",
  );
  expect(markdownResponse.status()).toBe(200);
  const markdown = await markdownResponse.text();
  expect(markdown).toContain("# Browser Support");
  expect(markdown).toContain("| Custom `$variable` animation |");
  expect(markdown).toContain("MDN Browser Compatibility Data");
});

test("project llms.txt files expose ordered framework-aware Markdown trees", async ({
  request,
}) => {
  const snapSortResponse = await request.get("/docs/snapsort/llms.txt");
  expect(snapSortResponse.status()).toBe(200);
  expect(snapSortResponse.headers()["content-type"]).toContain("text/plain");
  const snapSortIndex = await snapSortResponse.text();
  expect(snapSortIndex).toContain("# SnapSort Documentation");
  expect(snapSortIndex.indexOf("## Introduction")).toBeLessThan(
    snapSortIndex.indexOf("## Guides"),
  );
  expect(snapSortIndex.indexOf("## Guides")).toBeLessThan(
    snapSortIndex.indexOf("## Reference"),
  );
  expect(snapSortIndex).toContain(
    "[Quickstart (Svelte)](https://snapengine.dev/docs/snapsort/introduction/01_setup.md?framework=svelte)",
  );
  expect(snapSortIndex).toContain(
    "[Quickstart (React)](https://snapengine.dev/docs/snapsort/introduction/01_setup.md?framework=react)",
  );
  expect(snapSortIndex).toContain(
    "[Quickstart (Vanilla JS)](https://snapengine.dev/docs/snapsort/introduction/01_setup.md?framework=vanilla)",
  );
  expect(snapSortIndex).toContain(
    "https://snapengine.dev/docs/snapsort/reference/svelte/container.md?framework=svelte",
  );
  expect(snapSortIndex).toContain(
    "https://snapengine.dev/docs/snapsort/reference/react/container.md?framework=react",
  );
  expect(snapSortIndex).not.toContain("/docs/snapengine/");
  expect(snapSortIndex).not.toContain("styleguide");

  const snapEngineResponse = await request.get("/docs/snapengine/llms.txt");
  expect(snapEngineResponse.status()).toBe(200);
  const snapEngineIndex = await snapEngineResponse.text();
  expect(snapEngineIndex).toContain("# SnapEngine Core Documentation");
  expect(snapEngineIndex).toContain(
    "https://snapengine.dev/docs/snapengine/introduction.md",
  );
  expect(snapEngineIndex).toContain(
    "https://snapengine.dev/docs/snapengine/introduction/09_browser_support.md",
  );
  expect(snapEngineIndex).toContain(
    "https://snapengine.dev/docs/snapengine/reference/engine.md",
  );
  expect(snapEngineIndex).not.toContain("/docs/snapsort/");
});

test("SnapLine docs expose framework switching, live demos, Markdown, and llms index", async ({
  page,
  request,
}) => {
  const response = await page.goto(
    "/docs/snapline/introduction/01_setup?framework=svelte",
  );
  expect(response?.status()).toBe(200);
  await page.waitForFunction(
    () => localStorage.getItem("preferredCodeFramework") === "svelte",
  );
  await expect(page.locator("#desktop-doc-framework")).toHaveValue("svelte");
  await expect(
    page.locator(".framework-code-block:visible").filter({
      hasText: "@snap-engine/snapline/svelte",
    }),
  ).toHaveCount(1);

  await page.locator("#desktop-doc-framework").selectOption("react");
  await expect(page.locator(".doc-article")).toHaveAttribute(
    "data-framework",
    "react",
  );
  await expect(
    page.locator(".framework-code-block:visible").filter({
      hasText: "@snap-engine/snapline/react",
    }),
  ).toHaveCount(1);

  await page.goto("/docs/snapline/guides/03_groups");
  await expect(page.locator(".snapline-demo")).toBeVisible();
  await expect(page.locator("[data-snapline-type='group']")).toHaveCount(2);
  await expect(page.getByText("Outer group", { exact: true })).toBeVisible();

  const markdown = await request.get(
    "/docs/snapline/guides/03_groups.md?framework=svelte",
  );
  expect(markdown.status()).toBe(200);
  const markdownText = await markdown.text();
  expect(markdownText).toContain("# Groups and nesting");
  expect(markdownText).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(markdownText).not.toContain("<SnapLineDemo");

  const llms = await request.get("/docs/snapline/llms.txt");
  expect(llms.status()).toBe(200);
  const llmsText = await llms.text();
  expect(llmsText).toContain("# SnapLine Documentation");
  expect(llmsText).toContain(
    "/docs/snapline/reference/svelte/group.md?framework=svelte",
  );
  expect(llmsText).toContain(
    "/docs/snapline/reference/react/group.md?framework=react",
  );
});
