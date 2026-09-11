import { expect, test } from "@playwright/test";
import { holdDragToPoint } from "../_support/gallery-drag";

test("Layers panel nests by main-axis proximity and unnests by leading edge", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const layersPanel = page.locator('[data-demo="layers-panel"]');
  await layersPanel.scrollIntoViewIfNeeded();
  const group = layersPanel.locator('[data-layer-id="navigation"]');
  const groupRow = group.locator(":scope > .group-row");
  const artwork = layersPanel.locator('[data-layer-id="hero-artwork"]');
  const groupRowBox = await groupRow.boundingBox();
  if (!groupRowBox) {
    throw new Error("Layers panel group row has no layout box.");
  }

  await holdDragToPoint(page, artwork, {
    x: groupRowBox.x + 4,
    y: groupRowBox.y + groupRowBox.height + 1,
  });
  await expect(
    group.locator('.insertion-tree-marker[data-tree-marker-hidden="false"]'),
  ).toBeVisible();
  await page.mouse.up();
  await expect(group.locator('[data-layer-id="hero-artwork"]')).toHaveCount(1);
  await expect
    .poll(() =>
      layersPanel
        .locator("[data-layer-id]")
        .evaluateAll((elements) =>
          elements.every(
            (element) => !(element as HTMLElement).style.transform,
          ),
        ),
    )
    .toBe(true);

  const [artworkBox, notesBox] = await Promise.all([
    artwork.boundingBox(),
    layersPanel.locator('[data-layer-id="prototype-notes"]').boundingBox(),
  ]);
  if (!artworkBox || !notesBox) {
    throw new Error("Layers panel drag target has no layout box.");
  }

  await page.mouse.move(
    artworkBox.x + artworkBox.width / 2,
    artworkBox.y + artworkBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    artworkBox.x + artworkBox.width / 2 + 7,
    artworkBox.y + 7,
  );
  await page.waitForTimeout(60);
  await page.mouse.move(notesBox.x + 4, notesBox.y + notesBox.height / 2, {
    steps: 12,
  });
  await page.waitForTimeout(120);
  await page.mouse.up();

  await expect(
    layersPanel.locator('.layers-tree-root > [data-layer-id="hero-artwork"]'),
  ).toHaveCount(1);
});

test("Layers panel group FLIP preserves unchanged descendants and animates local changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const layersPanel = page.locator('[data-demo="layers-panel"]');
  await layersPanel.scrollIntoViewIfNeeded();
  await page.addStyleTag({
    content: `
      [data-demo="layers-panel"]
        .layers-tree-root
        > [data-layer-id="header"]
        > [data-layer-id="brand-mark"] {
        margin-left: calc(var(--layers-node-indent) + 12px) !important;
      }
    `,
  });
  const header = layersPanel.locator('[data-layer-id="header"]');
  const notes = layersPanel.locator('[data-layer-id="prototype-notes"]');
  const relations = [
    { childId: "brand-mark", parentId: "header" },
    { childId: "navigation", parentId: "header" },
    { childId: "features", parentId: "navigation" },
    { childId: "pricing", parentId: "navigation" },
  ];
  const baselineOffsets = await layersPanel.evaluate((demo, pairs) => {
    return Object.fromEntries(
      pairs.map(({ childId, parentId }) => {
        const child = demo.querySelector<HTMLElement>(
          `[data-layer-id="${childId}"]`,
        );
        const parent = demo.querySelector<HTMLElement>(
          `[data-layer-id="${parentId}"]`,
        );
        if (!child || !parent) {
          throw new Error("Layers panel FLIP relation is missing.");
        }
        const childRect = child.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        return [
          `${childId}:${parentId}`,
          {
            x: childRect.x - parentRect.x,
            y: childRect.y - parentRect.y,
          },
        ];
      }),
    );
  }, relations);

  const notesBox = await notes.boundingBox();
  if (!notesBox) {
    throw new Error("Layers panel root insertion target has no layout box.");
  }
  await holdDragToPoint(page, header.locator(":scope > .group-row"), {
    x: notesBox.x + 4,
    y: notesBox.y + notesBox.height / 2,
  });
  await page.waitForTimeout(320);

  const frameTrace = layersPanel.evaluate(
    (demo, pairs) =>
      new Promise<
        Array<{
          connected: boolean;
          transforms: Record<string, string>;
          offsets: Record<string, { x: number; y: number }>;
        }>
      >((resolve) => {
        const itemIds = [
          "header",
          "brand-mark",
          "navigation",
          "features",
          "pricing",
          "feature-cards",
        ];
        const frames: Array<{
          connected: boolean;
          transforms: Record<string, string>;
          offsets: Record<string, { x: number; y: number }>;
        }> = [];
        const startedAt = performance.now();
        const sample = () => {
          const items = new Map(
            itemIds.map((itemId) => [
              itemId,
              demo.querySelector<HTMLElement>(`[data-layer-id="${itemId}"]`),
            ]),
          );
          const connected = [...items.values()].every(Boolean);
          const transforms = Object.fromEntries(
            itemIds.map((itemId) => [
              itemId,
              items.get(itemId)?.style.transform ?? "",
            ]),
          );
          const offsets: Record<string, { x: number; y: number }> = {};
          for (const { childId, parentId } of pairs) {
            const child = items.get(childId);
            const parent = items.get(parentId);
            if (!child || !parent) continue;
            const childRect = child.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();
            offsets[`${childId}:${parentId}`] = {
              x: childRect.x - parentRect.x,
              y: childRect.y - parentRect.y,
            };
          }
          frames.push({ connected, transforms, offsets });

          if (performance.now() - startedAt >= 420) {
            resolve(frames);
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
    relations,
  );
  await page.mouse.up();
  const frames = (await frameTrace).filter((frame) => frame.connected);

  await expect(
    layersPanel.locator('.layers-tree-root > [data-layer-id="header"]'),
  ).toHaveCount(1);
  expect(frames.length).toBeGreaterThan(4);
  expect(frames.some(({ transforms }) => transforms.header !== "")).toBe(true);
  expect(
    frames.some(({ transforms }) => transforms["feature-cards"] !== ""),
  ).toBe(true);
  expect(frames.some(({ transforms }) => transforms["brand-mark"] !== "")).toBe(
    true,
  );

  for (const frame of frames) {
    for (const itemId of ["navigation", "features", "pricing"]) {
      expect(frame.transforms[itemId]).toBe("");
    }
    for (const [relation, baseline] of Object.entries(baselineOffsets)) {
      if (relation === "brand-mark:header") continue;
      const offset = frame.offsets[relation];
      expect(offset).toBeDefined();
      expect(Math.abs(offset.x - baseline.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(offset.y - baseline.y)).toBeLessThanOrEqual(1);
    }
  }

  const brandBaseline = baselineOffsets["brand-mark:header"];
  const finalBrandFrame = frames.at(-1);
  const finalBrandOffset = finalBrandFrame?.offsets["brand-mark:header"];
  const animatedBrandOffsets = frames
    .filter(({ transforms }) => transforms["brand-mark"] !== "")
    .map(({ offsets }) => offsets["brand-mark:header"].x - brandBaseline.x);
  expect(finalBrandFrame).toBeDefined();
  expect(finalBrandOffset).toBeDefined();
  expect(finalBrandFrame?.transforms["brand-mark"]).toBe("");
  expect(animatedBrandOffsets.some((offset) => offset > 0 && offset < 12)).toBe(
    true,
  );
  expect(
    Math.abs((finalBrandOffset?.x ?? 0) - brandBaseline.x - 12),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs((finalBrandOffset?.y ?? 0) - brandBaseline.y),
  ).toBeLessThanOrEqual(1);
});

test("Layers panel keeps collapsed-group edges available for sibling insertion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const layersPanel = page.locator('[data-demo="layers-panel"]');
  await layersPanel.scrollIntoViewIfNeeded();
  const desktopHome = layersPanel.locator('[data-layer-id="desktop-home"]');
  const header = layersPanel.locator('[data-layer-id="header"]');
  const featureCards = layersPanel.locator('[data-layer-id="feature-cards"]');
  const notes = layersPanel.locator('[data-layer-id="prototype-notes"]');

  await header.getByRole("button", { name: "Collapse Header" }).click();
  await featureCards
    .getByRole("button", { name: "Collapse Feature cards" })
    .click();
  await expect(
    header.getByRole("button", { name: "Expand Header" }),
  ).toBeVisible();
  await expect(
    featureCards.getByRole("button", { name: "Expand Feature cards" }),
  ).toBeVisible();

  const headerRowBox = await header
    .locator(":scope > .group-row")
    .boundingBox();
  if (!headerRowBox) {
    throw new Error("Collapsed Layers group row has no layout box.");
  }

  await holdDragToPoint(page, notes, {
    x: headerRowBox.x + headerRowBox.width / 2,
    y: headerRowBox.y + headerRowBox.height - 2,
  });
  await expect(
    desktopHome.locator(
      ':scope > .insertion-tree-marker[data-tree-marker-hidden="false"]',
    ),
  ).toBeVisible();
  await expect(layersPanel.locator('[data-layer-targeted="true"]')).toHaveCount(
    0,
  );
  await page.mouse.up();
  await page.waitForTimeout(200);

  const desktopLayerIds = () =>
    desktopHome
      .locator(":scope > [data-layer-id]")
      .evaluateAll((entries) =>
        entries.map((entry) => entry.getAttribute("data-layer-id")),
      );
  await expect
    .poll(desktopLayerIds)
    .toEqual(["header", "prototype-notes", "feature-cards", "hero-artwork"]);

  const featureCardsRowBox = await featureCards
    .locator(":scope > .group-row")
    .boundingBox();
  if (!featureCardsRowBox) {
    throw new Error("Collapsed Layers group row has no layout box.");
  }

  await holdDragToPoint(page, notes, {
    x: featureCardsRowBox.x + featureCardsRowBox.width / 2,
    y: featureCardsRowBox.y + featureCardsRowBox.height / 2,
  });
  await expect(featureCards).toHaveAttribute("data-layer-targeted", "true");
  await expect(
    desktopHome.locator(
      ':scope > .insertion-tree-marker[data-tree-marker-hidden="false"]',
    ),
  ).toHaveCount(0);
  await page.mouse.up();
  await page.waitForTimeout(200);

  await featureCards
    .getByRole("button", { name: "Expand Feature cards" })
    .click();
  await expect(
    featureCards.locator(':scope > [data-layer-id="prototype-notes"]'),
  ).toHaveCount(1);
});
