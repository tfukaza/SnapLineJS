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
  ).toHaveAttribute("href", "/snapline");
  await expect(projectMenu.getByRole("link", { name: "SnapZap" })).toHaveCount(
    0,
  );
  await expect(projectMenu.locator(".project-nav-link-disabled")).toContainText(
    "SnapZap",
  );
  await expect(projectMenu.locator(".project-nav-link-disabled")).toContainText(
    "Coming soon",
  );

  await projectMenu.getByRole("link", { name: "SnapSort" }).click();
  await expect(page).toHaveURL(/\/snapsort$/);
  await expect(docsLink).toHaveAttribute("href", "/docs/snapsort/introduction");

  await page.goto("/docs/snapline/introduction", { waitUntil: "networkidle" });
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

test("keeps one global header and exposes inline docs navigation on mobile", async ({
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
  const docsMenuTrigger = page.getByRole("button", {
    name: "Browse SnapLine docs",
  });
  await expect(docsMenuTrigger).toBeVisible();
  await expect(page.locator(".mobile-navbar")).toHaveCount(0);
  await docsMenuTrigger.click();
  await expect(docsMenuTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#mobile-doc-menu")).toBeVisible();

  const mobileHeaderTrigger = primaryNav.getByRole("button", {
    name: "Toggle navigation",
  });
  await mobileHeaderTrigger.click();
  await expect(mobileHeaderTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(
    primaryNav.getByRole("link", { name: "Docs", exact: true }),
  ).toHaveAttribute("href", "/docs/snapline/introduction");
});
