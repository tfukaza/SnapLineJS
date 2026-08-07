import { expect, test, type Locator, type Page } from "@playwright/test";

// The "Duplicate on drop" toggle only exists on the Svelte insertion demo
// (no React equivalent yet) -- svelte-only per this session's testing scope.
test.beforeEach(async ({}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("svelte"),
    "No React insertion demo with a duplicate toggle yet",
  );
});

async function rect(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected locator to have a bounding box.");
  return box;
}

function center(box: { x: number; y: number; width: number; height: number }) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function listByHeading(page: Page, heading: string): Promise<Locator> {
  return page.locator(".insertion-list", {
    has: page.locator("h2", { hasText: heading }),
  });
}

async function dragOnto(
  page: Page,
  source: Locator,
  target: Locator,
  yOffset = 0,
) {
  const start = center(await rect(source));
  const end = center(await rect(target));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 4, start.y + 4);
  await page.waitForTimeout(60);
  for (let step = 1; step <= 12; step++) {
    const t = step / 12;
    await page.mouse.move(
      start.x + (end.x - start.x) * t,
      start.y + (end.y - start.y) * t + yOffset * t,
    );
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(250);
}

test.describe("SnapSort insertion-mode copy (unified commit path)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?demo=snapsort_insertion", { waitUntil: "networkidle" });
  });

  test("toggling duplicate mode leaves the original in place and adds a copy at the marker index", async ({
    page,
  }) => {
    const project = await listByHeading(page, "Project");
    const source = await listByHeading(page, "Source");

    await expect(project.locator(".insertion-card")).toHaveCount(4);
    await expect(source.locator(".insertion-card")).toHaveCount(3);

    // The design system's checkbox input is visually hidden (opacity/size 0)
    // in favor of a `+ span` sibling for the visible box — click the label
    // (as a real user would) rather than `.check()`, which requires the
    // underlying input itself to be visible.
    await page.locator(".duplicate-toggle").click();
    await expect(
      page.locator(".duplicate-toggle input[type=checkbox]"),
    ).toBeChecked();

    const dragged = project.locator(".insertion-card", {
      hasText: "package.json",
    });
    const target = source.locator(".insertion-card", {
      hasText: "Item.svelte",
    });
    await dragOnto(page, dragged, target);

    // Original stays exactly where it was -- insertion mode never lifts.
    await expect(project.locator(".insertion-card")).toHaveCount(4);
    await expect(
      project.locator(".insertion-card", { hasText: "package.json" }),
    ).toHaveCount(1);

    // A duplicate landed in the source column near the marker index, with a
    // freshly minted id (not literally "package.json"'s original identity,
    // but the same title/detail content).
    await expect(source.locator(".insertion-card")).toHaveCount(4);
    await expect(
      source.locator(".insertion-card", { hasText: "package.json" }),
    ).toHaveCount(1);

    await expect(page.locator(".demo-header p")).toHaveText(
      "8 files and folders · original row stays still until drop",
    );
  });

  test("with duplicate mode off, dragging still performs a normal move (no copy)", async ({
    page,
  }) => {
    const project = await listByHeading(page, "Project");
    const source = await listByHeading(page, "Source");

    const dragged = project.locator(".insertion-card", {
      hasText: "README.md",
    });
    const target = source.locator(".insertion-card", {
      hasText: "Handle.svelte",
    });
    await dragOnto(page, dragged, target);

    await expect(project.locator(".insertion-card")).toHaveCount(3);
    await expect(
      project.locator(".insertion-card", { hasText: "README.md" }),
    ).toHaveCount(0);
    await expect(source.locator(".insertion-card")).toHaveCount(4);
    await expect(
      source.locator(".insertion-card", { hasText: "README.md" }),
    ).toHaveCount(1);

    await expect(page.locator(".demo-header p")).toHaveText(
      "7 files and folders · original row stays still until drop",
    );
  });
});
