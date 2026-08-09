import { expect, test } from "@playwright/test";

test("switches projects without leaving the current marketing or docs context", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const projectTrigger = primaryNav.getByRole("button", {
    name: /Switch project\. Current project: Core/,
  });
  const projectMenu = page.locator("#project-nav-menu");
  const docsLink = primaryNav.getByRole("link", { name: "Docs", exact: true });

  await expect(docsLink).toHaveAttribute(
    "href",
    "/docs/snapengine/introduction",
  );
  await projectTrigger.click();
  await expect(projectTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(projectMenu).toBeVisible();
  await expect(projectMenu.getByRole("link", { name: "Core" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(
    projectMenu.getByRole("link", { name: "SnapSort" }),
  ).toHaveAttribute("href", "/snapsort");
  await expect(
    projectMenu.getByRole("link", { name: "SnapLine" }),
  ).toHaveCount(0);
  await expect(projectMenu.getByRole("link", { name: "SnapZap" })).toHaveCount(
    0,
  );
  const disabledSnapLine = projectMenu.locator(".project-nav-link-disabled", {
    hasText: "SnapLine",
  });
  const disabledSnapZap = projectMenu.locator(".project-nav-link-disabled", {
    hasText: "SnapZap",
  });
  await expect(disabledSnapLine).toContainText("Coming soon");
  await expect(disabledSnapZap).toContainText("Coming soon");

  await projectMenu.getByRole("link", { name: "SnapSort" }).click();
  await expect(page).toHaveURL(/\/snapsort$/);
  await expect(docsLink).toHaveAttribute("href", "/docs/snapsort/introduction");

  await page.goto("/docs/snapline/introduction", { waitUntil: "networkidle" });
  await expect(docsLink).toHaveAttribute("href", "/docs");
  const docsProjectTrigger = primaryNav.getByRole("button", {
    name: /Switch project\. Current project: SnapLine/,
  });
  await docsProjectTrigger.click();
  await expect(
    projectMenu.getByRole("link", { name: "SnapSort" }),
  ).toHaveAttribute("href", "/docs/snapsort/introduction");
  await expect(projectMenu.getByRole("link", { name: "Core" })).toHaveAttribute(
    "href",
    "/docs/snapengine/introduction",
  );

  await page.keyboard.press("Escape");
  await expect(docsProjectTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(docsProjectTrigger).toBeFocused();

  await docsProjectTrigger.click();
  await page.locator("#main-content").click({ position: { x: 4, y: 4 } });
  await expect(docsProjectTrigger).toHaveAttribute("aria-expanded", "false");
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

  await expect(projectTrigger).toBeVisible();
  await projectTrigger.click();
  await expect(page.locator("#project-nav-menu")).toBeVisible();
  await expect(
    page.locator("#project-nav-menu").getByRole("link", { name: "SnapSort" }),
  ).toHaveAttribute("href", "/docs/snapsort/introduction");

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
  ).toHaveAttribute("href", "/docs");

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
  await expect(page.locator('a[href^="/docs/snapline"]')).toHaveCount(0);

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
