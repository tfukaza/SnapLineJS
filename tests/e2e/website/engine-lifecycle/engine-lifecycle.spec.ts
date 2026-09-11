import { expect, test } from "@playwright/test";

test("owned Svelte engines survive page teardown without errors", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.locator("#highlight-animation")).toBeVisible();
  await expect(page.locator("#collision-card-canvas")).toBeVisible();

  const collisionCanvas = await page
    .locator("#collision-card-canvas")
    .boundingBox();
  expect(collisionCanvas?.width).toBeGreaterThan(800);
  expect(collisionCanvas?.height).toBeGreaterThan(400);

  await page.getByRole("link", { name: "About", exact: true }).first().click();
  // Client-side navigation loads the /about route before updating the URL;
  // on a cold dev server that route compiles on first visit.
  await expect(page).toHaveURL(/\/about$/, { timeout: 15_000 });

  expect(pageErrors).toEqual([]);
});

test("camera card reserves modified wheel input for zoom", async ({ page }) => {
  await page.goto("/");

  const card = page.locator(".camera-control-card");
  const camera = page.locator("#snap-camera-control");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await expect(camera).toBeVisible();

  const movePointerOverCard = async () => {
    const box = await card.boundingBox();
    if (!box) throw new Error("Expected camera card to have a bounding box.");
    await page.mouse.move(
      box.x + box.width / 2,
      Math.min(box.y + box.height / 2, 760),
    );
  };

  await movePointerOverCard();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const transformBefore = await camera.evaluate(
    (element) => (element as HTMLElement).style.transform,
  );
  await page.mouse.wheel(0, 420);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(scrollBefore + 100);
  expect(
    await camera.evaluate(
      (element) => (element as HTMLElement).style.transform,
    ),
  ).toBe(transformBefore);

  await card.scrollIntoViewIfNeeded();
  await movePointerOverCard();
  const modifiedScrollBefore = await page.evaluate(() => window.scrollY);
  const modifiedTransformBefore = await camera.evaluate(
    (element) => (element as HTMLElement).style.transform,
  );
  // The camera starts at its maximum zoom (1), so zoom out: a modified
  // wheel must zoom the camera instead of scrolling the page.
  await page.keyboard.down("Control");
  try {
    await page.mouse.wheel(0, 320);
  } finally {
    await page.keyboard.up("Control");
  }
  await expect
    .poll(() =>
      camera.evaluate((element) => (element as HTMLElement).style.transform),
    )
    .not.toBe(modifiedTransformBefore);
  expect(await page.evaluate(() => window.scrollY)).toBe(modifiedScrollBefore);
});
