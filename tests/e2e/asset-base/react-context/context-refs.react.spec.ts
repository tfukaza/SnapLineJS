import { expect, test } from "@playwright/test";

test("shares contexts, exposes refs, and survives Strict Mode remounts", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?demo=asset_base_react");

  const contextStatus = page.getByTestId("asset-base-context-ready");
  await expect(contextStatus).toHaveAttribute("data-engine-ready", "true");
  await expect(contextStatus).toHaveAttribute("data-camera-ready", "true");

  const refStatus = page.getByTestId("asset-base-ref-status");
  await expect(refStatus).toHaveAttribute("data-engine-ref", "true");
  await expect(refStatus).toHaveAttribute("data-camera-ref", "true");
  await expect(refStatus).toHaveAttribute("data-background-ref", "true");

  await expect(page.getByTestId("camera-engine")).toHaveAttribute(
    "style",
    /width: 100%/,
  );
  await expect(page.locator("#sl-background")).toHaveCSS(
    "background-image",
    /radial-gradient/,
  );

  await page.getByTestId("toggle-debug").click();
  await expect(
    page.getByTestId("camera-engine").locator("canvas"),
  ).toHaveCount(1);

  await page.getByTestId("toggle-engine").click();
  await expect(page.getByTestId("camera-engine")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("scroll")));

  await page.getByTestId("toggle-engine").click();
  await expect(page.getByTestId("asset-base-context-ready")).toHaveAttribute(
    "data-camera-ready",
    "true",
  );
  expect(pageErrors).toEqual([]);
});
