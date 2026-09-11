import { expect, test } from "@playwright/test";

test("uses the arrow as a project selector and the wordmark as a homepage link", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const projectTrigger = primaryNav.getByRole("button", {
    name: /Switch project\. Current project: SnapEngine/,
  });
  const projectMenu = page.locator("#project-nav-menu");
  const docsLink = primaryNav.getByRole("link", { name: "Docs", exact: true });
  const wordmark = primaryNav.locator(".wordmark");

  await expect(wordmark).toHaveText("SnapEngine");
  await expect(wordmark).toHaveAttribute("href", "/");
  await expect(projectMenu).not.toBeVisible();
  await expect(docsLink).toHaveAttribute(
    "href",
    "/docs/snapengine/introduction",
  );
  await projectTrigger.click();
  await expect(projectTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(projectMenu).toBeVisible();
  await expect(projectMenu.getByRole("link")).toHaveCount(4);
  await expect(
    projectMenu.getByRole("link", { name: "SnapEngine" }),
  ).toHaveAttribute("href", "/");
  await expect(
    projectMenu
      .getByRole("link", { name: "SnapEngine" })
      .locator(".project-nav-check"),
  ).toHaveText("✓");
  await expect(
    projectMenu.getByRole("link", { name: "SnapEngine" }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    projectMenu.getByRole("link", { name: "SnapSort" }),
  ).toHaveAttribute("href", "/snapsort");
  await expect(
    projectMenu.getByRole("link", { name: "SnapLine" }),
  ).toHaveAttribute("href", "/snapline");
  await expect(
    projectMenu.getByRole("link", { name: "SnapDesign" }),
  ).toHaveAttribute("href", "/snapdesign");
  await expect(projectMenu.getByRole("link", { name: "SnapZap" })).toHaveCount(
    0,
  );

  await projectMenu.getByRole("link", { name: "SnapSort" }).click();
  await expect(page).toHaveURL(/\/snapsort$/);
  await expect(wordmark).toHaveText("SnapSort");
  await expect(wordmark).toHaveAttribute("href", "/snapsort");
  await expect(docsLink).toHaveAttribute("href", "/docs/snapsort/introduction");
  await expect(
    primaryNav.getByRole("link", { name: "Examples", exact: true }),
  ).toHaveAttribute("href", "/docs/snapsort/examples");
  await expect(primaryNav.getByRole("link", { name: "About" })).toHaveCount(0);

  await page.goto("/docs/snapsort/examples", { waitUntil: "networkidle" });
  await expect(wordmark).toHaveText("SnapSort");
  await expect(
    primaryNav.getByRole("link", { name: "Examples", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(docsLink).not.toHaveAttribute("aria-current", "page");
  const docsProjectTrigger = primaryNav.getByRole("button", {
    name: /Switch project\. Current project: SnapSort/,
  });
  await docsProjectTrigger.click();
  await expect(
    projectMenu.getByRole("link", { name: "SnapSort" }),
  ).toHaveAttribute("href", "/snapsort");
  await expect(
    projectMenu.getByRole("link", { name: "SnapEngine" }),
  ).toHaveAttribute("href", "/");
  await expect(
    projectMenu.getByRole("link", { name: "SnapDesign" }),
  ).toHaveAttribute("href", "/snapdesign");

  await page.keyboard.press("Escape");
  await expect(docsProjectTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(docsProjectTrigger).toBeFocused();

  await docsProjectTrigger.click();
  await page.mouse.click(1200, 500);
  await expect(docsProjectTrigger).toHaveAttribute("aria-expanded", "false");

  await wordmark.click();
  await expect(page).toHaveURL(/\/snapsort$/);
  await expect(projectMenu).not.toBeVisible();
});

test("uses SnapEngine navigation for global pages", async ({ page }) => {
  await page.goto("/about", { waitUntil: "networkidle" });

  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  await expect(primaryNav.locator(".wordmark")).toHaveText("SnapEngine");
  await expect(primaryNav.locator(".wordmark")).toHaveAttribute("href", "/");
  await expect(
    primaryNav.getByRole("link", { name: "Docs", exact: true }),
  ).toHaveAttribute("href", "/docs/snapengine/introduction");
  await expect(
    primaryNav.getByRole("link", { name: "About", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(primaryNav.getByRole("link", { name: "Examples" })).toHaveCount(
    0,
  );
});

test("puts project documentation inside the icon-only mobile menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/snapline/introduction", { waitUntil: "networkidle" });

  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const projectTrigger = primaryNav.getByRole("button", {
    name: /Switch project\. Current project: SnapLine/,
  });

  await expect(primaryNav.locator(".wordmark")).toHaveText("SnapLine");
  await expect(primaryNav.locator(".wordmark")).toHaveAttribute(
    "href",
    "/snapline",
  );
  await expect(projectTrigger).toBeVisible();
  await projectTrigger.click();
  await expect(page.locator("#project-nav-menu")).toBeVisible();
  await expect(
    page.locator("#project-nav-menu").getByRole("link", { name: "SnapSort" }),
  ).toHaveAttribute("href", "/snapsort");
  await expect(
    page.locator("#project-nav-menu").getByRole("link", { name: "SnapDesign" }),
  ).toHaveAttribute("href", "/snapdesign");

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /Browse .* docs/ }),
  ).toHaveCount(0);

  const mobileHeaderTrigger = primaryNav.getByRole("button", {
    name: "Toggle navigation",
  });
  await expect(mobileHeaderTrigger).toHaveText("≡");
  await mobileHeaderTrigger.click();
  await expect(mobileHeaderTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(mobileHeaderTrigger).toHaveText("×");
  await expect(
    primaryNav.getByRole("link", { name: "Docs", exact: true }),
  ).toHaveAttribute("href", "/docs/snapline/introduction");
  await expect(primaryNav.getByRole("link", { name: "About" })).toHaveCount(0);
  await expect(primaryNav.getByRole("link", { name: "Examples" })).toHaveCount(
    0,
  );

  const mobileDocs = primaryNav.locator(".mobile-doc-navigation");
  await expect(mobileDocs).toBeVisible();
  await expect(mobileDocs).toContainText("SnapLine docs");
  await expect(mobileDocs.getByLabel("Framework")).toBeVisible();
  await expect(
    mobileDocs.getByRole("link", { name: "Installation and setup" }),
  ).toHaveAttribute("href", "/docs/snapline/introduction/01_setup");
  await expect(
    mobileDocs.getByRole("link", { name: "SnapLine", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("uses SnapDesign navigation on Guideline and Gallery pages", async ({
  page,
}) => {
  await page.goto("/snapdesign", { waitUntil: "networkidle" });

  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const projectTrigger = primaryNav.getByRole("button", {
    name: /Switch project\. Current project: SnapDesign/,
  });
  const wordmark = primaryNav.locator(".wordmark");
  const guideline = primaryNav.getByRole("link", {
    name: "Guideline",
    exact: true,
  });
  const gallery = primaryNav.getByRole("link", {
    name: "Gallery",
    exact: true,
  });

  await expect(wordmark).toHaveText("SnapDesign");
  await expect(wordmark).toHaveAttribute("href", "/snapdesign");
  await expect(projectTrigger).toHaveText("");
  await expect(guideline).toHaveAttribute("href", "/snapdesign");
  await expect(guideline).toHaveAttribute("aria-current", "page");
  await expect(gallery).toHaveAttribute("href", "/snapdesign/gallery");
  await expect(primaryNav.getByRole("link", { name: "Docs" })).toHaveCount(0);
  await expect(primaryNav.getByRole("link", { name: "About" })).toHaveCount(0);
  await expect(
    primaryNav.getByRole("link", { name: "SnapEngine on GitHub" }),
  ).toBeVisible();

  await gallery.click();
  await expect(page).toHaveURL(/\/snapdesign\/gallery$/);
  await expect(wordmark).toHaveText("SnapDesign");
  await expect(gallery).toHaveAttribute("aria-current", "page");
  await expect(guideline).not.toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  const mobileHeaderTrigger = primaryNav.getByRole("button", {
    name: "Toggle navigation",
  });
  await mobileHeaderTrigger.click();
  await expect(guideline).toBeVisible();
  await expect(gallery).toBeVisible();
  await expect(
    primaryNav.getByRole("link", { name: "SnapEngine on GitHub" }),
  ).toBeVisible();
});

test("keeps coming-soon SnapLine pages unlisted but directly accessible", async ({
  page,
  request,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const snapLineCard = page.locator("#asset-snapline");
  const snapZapCard = page.locator("#asset-snapzap");
  await expect(snapLineCard).toContainText("Coming soon");
  await expect(snapLineCard.getByRole("link")).toHaveCount(0);
  await expect(
    snapLineCard.getByRole("button", { name: "Learn more" }),
  ).toBeDisabled();
  await expect(snapZapCard).toContainText("Coming soon");
  await expect(
    page.locator(".planned-asset-node", { hasText: "SnapLine" }),
  ).toContainText("Coming soon");
  await expect(
    page.locator("footer").getByText("SnapLine · Coming soon"),
  ).toBeVisible();

  await page.goto("/docs", { waitUntil: "networkidle" });
  await expect(page.locator(".doc-article")).toContainText(
    "SnapLine is a planned toolkit",
  );
  await expect(
    page.locator('.doc-article a[href^="/docs/snapline"]'),
  ).toHaveCount(0);

  await page.goto("/snapline", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Node-based UI primitives" }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(
    page.getByRole("link", {
      name: /SnapLine docs|Read the docs|Install SnapLine/,
    }),
  ).toHaveCount(0);

  await page.goto("/docs/snapline/introduction", { waitUntil: "networkidle" });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(
    page.getByRole("heading", { name: "SnapLine", level: 1 }),
  ).toBeVisible();

  const rootLlms = await request.get("/llms.txt");
  expect(rootLlms.ok()).toBe(true);
  expect(await rootLlms.text()).not.toContain("SnapLine");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).not.toContain("/snapline");

  const markdown = await request.get("/docs/snapline/introduction.md");
  expect(markdown.ok()).toBe(true);
  expect(markdown.headers()["x-robots-tag"]).toBe("noindex, nofollow");

  const projectLlms = await request.get("/docs/snapline/llms.txt");
  expect(projectLlms.ok()).toBe(true);
  expect(projectLlms.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});

test("uses one reading width for documentation chrome and article content", async ({
  page,
}) => {
  await page.goto("/docs/snapengine/reference/engine", {
    waitUntil: "networkidle",
  });

  const selectors = [
    ".doc-breadcrumb",
    ".doc-header",
    ".doc-article > p",
    ".doc-article > .display",
    ".doc-article > table",
    ".doc-pagination",
  ];
  const boxes = await Promise.all(
    selectors.map((selector) => page.locator(selector).first().boundingBox()),
  );
  const measuredBoxes = boxes.filter(
    (box): box is NonNullable<typeof box> => box !== null,
  );

  expect(measuredBoxes).toHaveLength(selectors.length);
  for (const box of measuredBoxes) {
    expect(box.x).toBeCloseTo(measuredBoxes[0].x, 0);
    expect(box.width).toBeCloseTo(measuredBoxes[0].width, 0);
  }
  expect(measuredBoxes[0].width).toBeLessThanOrEqual(700);
});
