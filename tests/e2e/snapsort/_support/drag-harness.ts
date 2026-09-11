// Pointer-drag harness for the SnapSort demo suites: the in-page lifecycle
// trace, drag drivers that sample every frame, and stability assertions.
import { expect, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type Rect } from "../../../../src/geometry";
import { center } from "../../../helpers/snapsort-fixtures";
import { coreImportPath } from "../../shared/servers";

export type DragSample = {
  step: number;
  mouse: { x: number; y: number };
  spacerCount: number;
  spacer: Rect | null;
  spacerParentId: string | null;
  spacerParentKind: string | null;
  spacerParentText: string | null;
  spacerIndex: number | null;
  spacerPrevious: (Rect & { text: string }) | null;
  spacerNext: (Rect & { text: string }) | null;
  spacerDomPrevious: (Rect & { text: string }) | null;
  spacerDomNext: (Rect & { text: string }) | null;
  dragged: (Rect & { centerX: number; centerY: number }) | null;
  draggedCenterDelta: number | null;
  draggedSourceColumnZIndex?: string | null;
  draggedAttribute?: string | null;
  frameRects?: Array<{
    role: string;
    text: string;
    id: string | null;
    transform: string;
    rect: Rect;
  }>;
};

export type DomTraceEntry = {
  type: string;
  target: string;
  parent?: string;
  before?: string | null;
  time: number;
};

export type SnapSortLifecycleState = {
  spacerCount: number;
  draggingTexts: string[];
  draggingStyles: Array<{
    text: string;
    position: string;
    zIndex: string;
    transform: string;
  }>;
  nestedOuterChildren: Array<{
    id: string;
    classes: string[];
    text: string;
  }>;
};

export type SelfInsertProbeState = {
  found: boolean;
  childIndex: number | null;
  duplicateCount: number | null;
  insertEvents: Array<{
    index: number;
    selfBefore: boolean;
    beforeText: string | null;
  }>;
  beforeOrder: string[];
  afterOrder: string[];
  domChildren: string[];
};

export async function installSnapsortTrace(page: Page) {
  await page.addInitScript(() => {
    const win = window as unknown as {
      __snapsortTrace: {
        dom: DomTraceEntry[];
        mutations: Array<{
          type: string;
          target: string;
          attr: string | null;
          time: number;
        }>;
      };
      __snapsortActiveText?: string;
      __snapsortActiveIndex?: number;
      __snapsortActiveId?: string;
    };

    const trace = {
      dom: [] as DomTraceEntry[],
      mutations: [] as Array<{
        type: string;
        target: string;
        attr: string | null;
        time: number;
      }>,
    };
    win.__snapsortTrace = trace;

    const describe = (node: unknown) => {
      if (!(node instanceof Element)) return String(node);
      const text = node.textContent?.trim().replace(/\s+/g, " ").slice(0, 40);
      const id = node.id ? `#${node.id}` : "";
      const classes = [...node.classList].slice(0, 4).join(".");
      return `${node.tagName.toLowerCase()}${id}${classes ? `.${classes}` : ""}${text ? ` "${text}"` : ""}`;
    };

    const shouldTrace = (node: unknown) =>
      node instanceof Element &&
      (node.id === "spacer" ||
        node.classList.contains("snapsort-item") ||
        node.classList.contains("snapsort-item-wrapper") ||
        node.classList.contains("snapsort-container") ||
        node.closest?.(".snapsort-container") != null);

    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function <T extends Node>(child: T): T {
      if (shouldTrace(child) || shouldTrace(this)) {
        trace.dom.push({
          type: "appendChild",
          target: describe(child),
          parent: describe(this),
          time: performance.now(),
        });
      }
      return originalAppendChild.call(this, child) as T;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(
      child: T,
      before: Node | null,
    ): T {
      if (shouldTrace(child) || shouldTrace(this)) {
        trace.dom.push({
          type: "insertBefore",
          target: describe(child),
          parent: describe(this),
          before: before ? describe(before) : null,
          time: performance.now(),
        });
      }
      return originalInsertBefore.call(this, child, before) as T;
    };

    const originalRemove = Element.prototype.remove;
    Element.prototype.remove = function () {
      if (shouldTrace(this)) {
        trace.dom.push({
          type: "remove",
          target: describe(this),
          parent: describe(this.parentElement),
          time: performance.now(),
        });
      }
      return originalRemove.call(this);
    };

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (shouldTrace(mutation.target)) {
          trace.mutations.push({
            type: mutation.type,
            target: describe(mutation.target),
            attr: mutation.attributeName,
            time: performance.now(),
          });
        }
      }
    });

    const observeDocument = () => {
      const documentElement = document.documentElement;
      if (!documentElement) return;
      mutationObserver.observe(documentElement, {
        attributes: true,
        attributeFilter: ["class", "style", "data-engine-id"],
        childList: true,
        subtree: true,
      });
    };
    if (document.documentElement) observeDocument();
    else {
      document.addEventListener("DOMContentLoaded", observeDocument, {
        once: true,
      });
    }
  });
}

export async function itemRect(item: Locator): Promise<Rect> {
  await item.scrollIntoViewIfNeeded();
  const box = await item.boundingBox();
  if (!box) throw new Error("Expected item to have a bounding box.");
  return box;
}

export async function itemByText(page: Page, text: string, index = 0) {
  const locator = page
    .locator(".snapsort-item")
    .filter({ hasText: text })
    .nth(index);
  await expect(locator).toBeVisible();
  return locator;
}

export async function demoBoxByHeading(page: Page, heading: string) {
  const box = page
    .locator(".demo-cell")
    .filter({ has: page.getByRole("heading", { name: heading }) });
  await expect(box).toBeVisible();
  return box;
}

export async function websiteCoreDemo(page: Page, demo: string) {
  const box = page.locator(`[data-demo="${demo}"]`);
  await expect(box).toBeVisible();
  return box;
}

export async function itemByTextIn(parent: Locator, text: string, index = 0) {
  const locator = parent
    .locator(".snapsort-item")
    .filter({ hasText: text })
    .nth(index);
  await expect(locator).toBeVisible();
  return locator;
}

export async function componentArrayList(page: Page) {
  const list = page.locator(".array-list");
  await expect(list).toBeVisible();
  return list;
}

export async function collectSample(
  page: Page,
  step: number,
  mouse: { x: number; y: number },
  options: { captureFrameRects?: boolean } = {},
): Promise<DragSample> {
  return page.evaluate(
    ({ step, mouse, captureFrameRects }) => {
      const win = window as unknown as {
        __snapsortActiveText?: string;
        __snapsortActiveIndex?: number;
        __snapsortActiveId?: string;
      };
      const rectOf = (element: Element | null) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      };
      const describedRectOf = (element: Element | null) => {
        const rect = rectOf(element);
        if (!rect) return null;
        return {
          ...rect,
          text: element?.textContent?.trim().replace(/\s+/g, " ") ?? "",
        };
      };
      const activeId = win.__snapsortActiveId ?? "";
      const draggedElement = document.querySelector(
        `[data-engine-id="${activeId}"]`,
      );
      const spacerElement = document.querySelector("#spacer");
      const spacerParent = spacerElement?.parentElement ?? null;
      const spacerSiblings = spacerParent
        ? [...spacerParent.children].filter(
            (child) =>
              child !== draggedElement &&
              (child.id === "spacer" ||
                child.classList.contains("snapsort-item") ||
                child.classList.contains("snapsort-container")),
          )
        : [];
      const spacerSiblingIndex = spacerElement
        ? spacerSiblings.indexOf(spacerElement)
        : -1;
      const directSiblingTexts = spacerParent
        ? [...spacerParent.children]
            .filter(
              (child) => child.id !== "spacer" && child !== draggedElement,
            )
            .map(
              (child) => child.textContent?.trim().replace(/\s+/g, " ") ?? "",
            )
        : [];
      const parentText = directSiblingTexts.join(" | ");
      const spacerParentKind =
        directSiblingTexts.length === 0
          ? null
          : directSiblingTexts.some((text) => /^Item [4-6]$/.test(text)) &&
              directSiblingTexts.every(
                (text) => text === "" || /^Item [4-6]$/.test(text),
              )
            ? "website-nested-inner"
            : directSiblingTexts.some((text) => /^Item [1-3]$/.test(text)) ||
                directSiblingTexts.some((text) =>
                  /Item 4 Item 5 Item 6/.test(text),
                )
              ? "website-nested-outer"
              : directSiblingTexts.every((text) => /^Sub A\d/.test(text))
                ? "nested-inner"
                : directSiblingTexts.some((text) =>
                      /Item 1\.5|Item 2|Item 3/.test(text),
                    )
                  ? "nested-outer"
                  : directSiblingTexts.some((text) =>
                        /Header|Card Grid|Footer/.test(text),
                      )
                    ? "layers-root"
                    : directSiblingTexts.some((text) =>
                          /Hero Section/.test(text),
                        )
                      ? "layers-hero"
                      : directSiblingTexts.some((text) =>
                            /Loose Item/.test(text),
                          )
                        ? "drag-root"
                        : directSiblingTexts.some((text) =>
                              /Group 1 -/.test(text),
                            )
                          ? "drag-group-1"
                          : directSiblingTexts.some((text) =>
                                /Group 2 -/.test(text),
                              )
                            ? "drag-group-2"
                            : "other";
      const draggedRect = rectOf(draggedElement);
      const dragged = draggedRect
        ? {
            ...draggedRect,
            centerX: draggedRect.x + draggedRect.width / 2,
            centerY: draggedRect.y + draggedRect.height / 2,
          }
        : null;
      const draggedSourceColumn = draggedElement?.closest(".basic-column");
      const frameRects = captureFrameRects
        ? [
            ...document.querySelectorAll(
              ".snapsort-item, .snapsort-container, #spacer",
            ),
          ].map((element) => {
            const htmlElement = element as HTMLElement;
            const role =
              element.id === "spacer"
                ? "ghost"
                : element.classList.contains("snapsort-container")
                  ? "container"
                  : "item";
            return {
              role,
              text: element.textContent?.trim().replace(/\s+/g, " ") ?? "",
              id: element.getAttribute("data-engine-id"),
              transform: htmlElement.style.transform,
              rect: rectOf(element)!,
            };
          })
        : undefined;
      return {
        step,
        mouse,
        spacerCount: document.querySelectorAll("#spacer").length,
        spacer: rectOf(spacerElement),
        spacerParentId: spacerParent?.getAttribute("data-engine-id") ?? null,
        spacerParentKind,
        spacerParentText: parentText || null,
        spacerIndex: spacerSiblingIndex === -1 ? null : spacerSiblingIndex,
        spacerPrevious:
          spacerSiblingIndex > 0
            ? describedRectOf(spacerSiblings[spacerSiblingIndex - 1])
            : null,
        spacerNext:
          spacerSiblingIndex >= 0 &&
          spacerSiblingIndex < spacerSiblings.length - 1
            ? describedRectOf(spacerSiblings[spacerSiblingIndex + 1])
            : null,
        spacerDomPrevious: describedRectOf(
          spacerElement?.previousElementSibling ?? null,
        ),
        spacerDomNext: describedRectOf(
          spacerElement?.nextElementSibling ?? null,
        ),
        dragged,
        draggedCenterDelta: dragged
          ? Math.hypot(dragged.centerX - mouse.x, dragged.centerY - mouse.y)
          : null,
        draggedSourceColumnZIndex: draggedSourceColumn
          ? getComputedStyle(draggedSourceColumn).zIndex
          : null,
        draggedAttribute:
          draggedElement instanceof HTMLElement
            ? draggedElement.dataset.snapsortDragging ?? null
            : null,
        frameRects,
      };
    },
    { step, mouse, captureFrameRects: options.captureFrameRects ?? false },
  );
}

export async function dragBy(
  page: Page,
  source: Locator,
  text: string,
  index: number,
  delta: { x: number; y: number },
  options: {
    steps?: number;
    assertCenter?: boolean;
    start?: { x: number; y: number };
    captureFrameRects?: boolean;
  } = {},
): Promise<DragSample[]> {
  const sourceRect = options.start
    ? await source.boundingBox()
    : await itemRect(source);
  if (!sourceRect) {
    throw new Error("Expected source item to have a bounding box.");
  }
  const activeId = await source.getAttribute("data-engine-id");
  const start = options.start ?? center(sourceRect);
  const steps = options.steps ?? 160;
  await page.evaluate(
    ({ text, index, activeId }) => {
      const win = window as unknown as {
        __snapsortActiveText?: string;
        __snapsortActiveIndex?: number;
        __snapsortActiveId?: string;
      };
      win.__snapsortActiveText = text;
      win.__snapsortActiveIndex = index;
      win.__snapsortActiveId = activeId ?? "";
    },
    { text, index, activeId },
  );

  const samples: DragSample[] = [];
  let mouseIsDown = false;
  try {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    mouseIsDown = true;

    const dragDistance = Math.hypot(delta.x, delta.y);
    const activationRatio =
      dragDistance === 0 ? 0 : Math.min(4 / dragDistance, 1);
    if (activationRatio > 0) {
      await page.mouse.move(
        start.x + delta.x * activationRatio,
        start.y + delta.y * activationRatio,
      );
      await page.waitForTimeout(16);
    }

    for (let step = 1; step <= steps; step++) {
      const ratio = activationRatio + ((1 - activationRatio) * step) / steps;
      const mouse = {
        x: start.x + delta.x * ratio,
        y: start.y + delta.y * ratio,
      };
      await page.mouse.move(mouse.x, mouse.y);
      await page.waitForTimeout(8);
      samples.push(
        await collectSample(page, step, mouse, {
          captureFrameRects: options.captureFrameRects,
        }),
      );
    }
  } finally {
    if (mouseIsDown) {
      await page.mouse.up().catch(() => {});
    }
  }

  await page.waitForTimeout(100);
  return samples;
}

export async function dragTo(
  page: Page,
  source: Locator,
  text: string,
  index: number,
  target: Locator,
  options: Parameters<typeof dragBy>[5] = {},
): Promise<DragSample[]> {
  const sourceCenter = center(await itemRect(source));
  const targetCenter = center(await itemRect(target));
  return dragBy(
    page,
    source,
    text,
    index,
    {
      x: targetCenter.x - sourceCenter.x,
      y: targetCenter.y - sourceCenter.y,
    },
    options,
  );
}

export async function dragToItemFraction(
  page: Page,
  source: Locator,
  text: string,
  index: number,
  target: Locator,
  yRatio: number,
  options: Parameters<typeof dragBy>[5] = {},
): Promise<DragSample[]> {
  const sourceCenter = center(await itemRect(source));
  const targetRect = await itemRect(target);
  return dragBy(
    page,
    source,
    text,
    index,
    {
      x: targetRect.x + targetRect.width / 2 - sourceCenter.x,
      y: targetRect.y + targetRect.height * yRatio - sourceCenter.y,
    },
    options,
  );
}

export async function directSnapSortItemTexts(
  locator: Locator,
): Promise<string[]> {
  return locator.evaluate((element) =>
    [...element.children]
      .filter((child) => child.classList.contains("snapsort-item"))
      .map((child) => child.textContent?.trim().replace(/\s+/g, " ") ?? ""),
  );
}

// A nested container's own textContent concatenates its children's text with
// no separator by default; hand-authored templates picked up an incidental
// space from template whitespace between sibling tags, which items-mode's
// internal {#each} doesn't reproduce. Expected strings below reflect the
// no-space (items-mode) DOM shape -- this is a DOM formatting detail, not a
// behavior difference (content and order are unaffected).
export async function directSnapSortChildTexts(
  locator: Locator,
): Promise<string[]> {
  return locator.evaluate((element) =>
    [...element.children]
      .filter(
        (child) =>
          child.classList.contains("snapsort-item") ||
          child.classList.contains("snapsort-container"),
      )
      .map((child) => child.textContent?.trim().replace(/\s+/g, " ") ?? ""),
  );
}

export async function nestedSnapSortLifecycleState(
  page: Page,
): Promise<SnapSortLifecycleState> {
  return page.evaluate(() => {
    const normalizeText = (element: Element | null) =>
      element?.textContent?.trim().replace(/\s+/g, " ") ?? "";
    const nestedCell = [...document.querySelectorAll(".demo-cell")].find(
      (cell) =>
        cell.querySelector("h2")?.textContent?.trim() === "Nested Container",
    );
    const outerContainer = nestedCell?.querySelector(".snapsort-container");
    const draggingElements = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-snapsort-dragging="true"]',
      ),
    ];

    return {
      spacerCount: document.querySelectorAll("#spacer").length,
      draggingTexts: draggingElements.map(normalizeText),
      draggingStyles: draggingElements.map((element) => ({
        text: normalizeText(element),
        position: element.style.position,
        zIndex: element.style.zIndex,
        transform: element.style.transform,
      })),
      nestedOuterChildren: [...(outerContainer?.children ?? [])].map(
        (child) => ({
          id: child.id,
          classes: [...child.classList],
          text: normalizeText(child),
        }),
      ),
    };
  });
}

export async function releaseStartedDragNearOrigin(
  page: Page,
  nested: Locator,
  itemText: string,
  targetText: string,
  targetYRatio: number,
) {
  const item = await itemByTextIn(nested, itemText);
  const target = await itemByTextIn(nested, targetText);
  const start = center(await itemRect(item));
  const targetRect = await itemRect(target);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(
    targetRect.x + targetRect.width / 2,
    targetRect.y + targetRect.height * targetYRatio,
    { steps: 30 },
  );
  await page.waitForTimeout(80);
  await page.mouse.move(start.x + 1, start.y + 1, { steps: 20 });
  await page.waitForTimeout(20);
  await page.mouse.up();
  await page.waitForTimeout(120);
}

export async function dragLockedNestedContainerBackground(
  page: Page,
  nested: Locator,
) {
  const childContainer = nested.locator(".snapsort-container").nth(1);
  const rect = await itemRect(childContainer);
  const start = {
    x: rect.x + 4,
    y: rect.y + 4,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + 80, { steps: 20 });
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(160);
}

export async function nestedContainerSelfInsertProbe(
  page: Page,
): Promise<SelfInsertProbeState> {
  return page.evaluate(
    async ({ coreImportPath }) => {
      const { GlobalManager } = await import(coreImportPath);
      const containers =
        GlobalManager.getInstance().data.dragAndDropContainers ?? [];
      const nestedCell = [...document.querySelectorAll(".demo-cell")].find(
        (cell) =>
          cell.querySelector("h2")?.textContent?.trim() === "Nested Container",
      );
      const outerElement = nestedCell?.querySelector(".snapsort-container");
      const childElement = nestedCell?.querySelectorAll(
        ".snapsort-container",
      )[1];
      const outer = containers.find(
        (container: any) => container.element === outerElement,
      );
      const child = containers.find(
        (container: any) => container.element === childElement,
      );
      const normalizeText = (element: Element | null) =>
        element?.textContent?.trim().replace(/\s+/g, " ") ?? "";
      const itemText = (item: any) => normalizeText(item.element);

      if (!outer || !child) {
        return {
          found: false,
          childIndex: null,
          duplicateCount: null,
          insertEvents: [],
          beforeOrder: [],
          afterOrder: [],
          domChildren: [],
        };
      }

      const beforeOrder = outer.itemOrderedList.map(itemText);
      const childIndex = outer.itemOrderedList.indexOf(child);
      const insertEvents: SelfInsertProbeState["insertEvents"] = [];
      const originalInsert = outer.callbacks.onItemInsert;
      outer.callbacks = {
        ...outer.callbacks,
        onItemInsert: (event: any) => {
          insertEvents.push({
            index: event.index,
            selfBefore: event.beforeElement === event.item.element,
            beforeText: normalizeText(event.beforeElement),
          });
          originalInsert?.(event);
        },
      };

      outer.insertItemAt(outer, child, childIndex);
      outer.callbacks = { ...outer.callbacks, onItemInsert: originalInsert };

      return {
        found: true,
        childIndex,
        duplicateCount: outer.itemOrderedList.filter(
          (item: any) => item === child,
        ).length,
        insertEvents,
        beforeOrder,
        afterOrder: outer.itemOrderedList.map(itemText),
        domChildren: [...outer.element.children].map((element) =>
          normalizeText(element),
        ),
      };
    },
    { coreImportPath },
  );
}

export async function directLogoSliceOrder(
  locator: Locator,
): Promise<number[]> {
  return locator.evaluate((element) =>
    [...element.children]
      .filter((child) => child.classList.contains("snapsort-item"))
      .map((child) =>
        Number(child.querySelector<HTMLElement>(".logo-slice")?.dataset.slice),
      ),
  );
}

export async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

export async function expectStableDrag(
  page: Page,
  samples: DragSample[],
  consoleMessages: string[],
  outputPath: string,
  options: { assertCenter?: boolean } = {},
) {
  const trace = await page.evaluate(() => {
    const win = window as unknown as {
      __snapsortTrace?: { dom: DomTraceEntry[]; mutations: unknown[] };
    };
    return win.__snapsortTrace;
  });
  await writeJson(outputPath, {
    samples,
    trace,
    layoutLogs: consoleMessages.filter((message) =>
      /\[updateDropTarget\]|\[updateGhostElement\]|\[insertItemAt\]|determineDropTarget|chosen|candidate/.test(
        message,
      ),
    ),
    errors: consoleMessages.filter((message) =>
      /error|Missing drag snapshot|Unhandled|TypeError/i.test(message),
    ),
  });

  expect(samples, "drag should produce frame samples").not.toHaveLength(0);
  expect(
    samples.filter((sample) => sample.spacerCount !== 1),
    "the spacer should not disappear or duplicate while dragging",
  ).toHaveLength(0);
  if (options.assertCenter !== false) {
    expect(
      Math.max(...samples.map((sample) => sample.draggedCenterDelta ?? 999)),
      "dragged item center should remain close to the pointer",
    ).toBeLessThan(12);
  }
  expect(
    consoleMessages.filter((message) =>
      /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(message),
    ),
  ).toHaveLength(0);
}

export function expectNoSpacerBacktrack(
  samples: DragSample[],
  axis: "x" | "y",
) {
  const positions = samples
    .filter((sample) => sample.spacer)
    .map((sample) => ({
      step: sample.step,
      value: sample.spacer![axis],
    }));

  for (let i = 1; i < positions.length; i++) {
    expect(
      positions[i].value + 8,
      `spacer should not jump backward between steps ${positions[i - 1].step} and ${positions[i].step}`,
    ).toBeGreaterThanOrEqual(positions[i - 1].value);
  }
}

export function expectNoParentReentry(
  samples: DragSample[],
  innerKind: string,
  outerKind: string,
  label: string,
) {
  const kinds = samples
    .map((sample) => sample.spacerParentKind)
    .filter((kind): kind is string => kind === innerKind || kind === outerKind);
  const firstInner = kinds.indexOf(innerKind);
  expect(
    firstInner,
    `drag should enter the ${label} nested sub-container`,
  ).toBeGreaterThanOrEqual(0);

  for (let i = firstInner + 1; i < kinds.length - 1; i++) {
    expect(
      !(kinds[i] === outerKind && kinds[i + 1] === innerKind),
      `spacer should not briefly leave and re-enter the ${label} nested container`,
    ).toBe(true);
  }
}

export function expectNoNestedParentFlicker(samples: DragSample[]) {
  expectNoParentReentry(samples, "nested-inner", "nested-outer", "default");
}

export function expectNoSpacerOscillation(samples: DragSample[]) {
  const keys = samples
    .filter((sample) => sample.spacer)
    .map(
      (sample) =>
        `${Math.round(sample.spacer!.x)}:${Math.round(sample.spacer!.y)}:${sample.spacerIndex}`,
    );

  for (let i = 2; i < keys.length; i++) {
    expect(
      !(keys[i] === keys[i - 2] && keys[i] !== keys[i - 1]),
      `spacer should not alternate between ${keys[i - 1]} and ${keys[i]} around sample ${i}`,
    ).toBe(true);
  }
}

export function ghostInsertionTargets(consoleMessages: string[]) {
  return consoleMessages.flatMap((message) => {
    const match = message.match(
      /\[updateGhostElement\] inserting ghost at container=([^\s]+) index=(\d+)/,
    );
    return match ? [`${match[1]}[${match[2]}]`] : [];
  });
}

export function expectGhostUpdatesStable(
  consoleMessages: string[],
  expectedMaxUpdates: number,
) {
  const targets = ghostInsertionTargets(consoleMessages);
  expect(
    targets.length,
    `ghost should update only at stable slot transitions; saw ${targets.join(" -> ")}`,
  ).toBeLessThanOrEqual(expectedMaxUpdates);

  for (let i = 2; i < targets.length; i++) {
    expect(
      !(targets[i] === targets[i - 2] && targets[i] !== targets[i - 1]),
      `ghost target should not oscillate: ${targets.join(" -> ")}`,
    ).toBe(true);
  }
}

export function compressedSpacerStates(
  samples: DragSample[],
  kinds: string[] = ["nested-inner", "nested-outer"],
) {
  const states = samples
    .filter((sample) =>
      sample.spacerParentKind ? kinds.includes(sample.spacerParentKind) : false,
    )
    .map((sample) => `${sample.spacerParentKind}[${sample.spacerIndex}]`);

  return states.filter(
    (state, index) => index === 0 || state !== states[index - 1],
  );
}

export function expectSpacerAlignedAfterPrevious(
  samples: DragSample[],
  parentKind: string,
  previousPattern: RegExp,
) {
  const sample = samples.find(
    (entry) =>
      entry.spacer &&
      entry.spacerParentKind === parentKind &&
      previousPattern.test(entry.spacerPrevious?.text ?? ""),
  );
  expect(
    sample,
    `expected spacer in ${parentKind} after ${previousPattern}`,
  ).toBeTruthy();

  const previous = sample!.spacerPrevious!;
  const delta = Math.abs(sample!.spacer!.y - (previous.y + previous.height));
  expect(
    delta,
    `spacer should align just below previous sibling; previous=${previous.text} delta=${delta}`,
  ).toBeLessThan(24);
}

export function expectSpacerNearDragged(
  samples: DragSample[],
  parentKind: string,
  maxDistance: number,
) {
  const candidates = samples.filter(
    (sample) =>
      sample.spacer && sample.dragged && sample.spacerParentKind === parentKind,
  );
  expect(
    candidates,
    `expected spacer samples in ${parentKind}`,
  ).not.toHaveLength(0);

  const worst = candidates.reduce(
    (current, sample) => {
      const spacerCenterY = sample.spacer!.y + sample.spacer!.height / 2;
      const delta = Math.abs(spacerCenterY - sample.dragged!.centerY);
      return delta > current.delta ? { sample, delta } : current;
    },
    { sample: candidates[0], delta: -Infinity },
  );

  expect(
    worst.delta,
    `spacer center should track dragged item center in ${parentKind}; worst step=${worst.sample.step}`,
  ).toBeLessThan(maxDistance);
}
