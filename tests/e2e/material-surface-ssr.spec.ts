import { expect, test } from "@playwright/test";
import {
  createMaterialStyle,
  defaultMaterialSettings,
} from "../../website/src/lib/components/materialSurface";

test("serializes material lighting without a browser", () => {
  const raisedStyle = createMaterialStyle("raised", defaultMaterialSettings);
  const recessedStyle = createMaterialStyle("recessed", defaultMaterialSettings);

  expect(raisedStyle).toContain("--material-light-angle: 325deg");
  expect(raisedStyle).toContain("--material-shadow-far-x:");
  expect(raisedStyle).toContain(
    "--material-normal-315: color-mix(in hsl, color-mix(",
  );
  expect(raisedStyle).toContain("--material-specular-peak:");
  expect(recessedStyle).toContain("--material-light-angle: 505deg");
  expect(recessedStyle).not.toBe(raisedStyle);
});

test("clamps invalid material values during serialization", () => {
  const style = createMaterialStyle("raised", {
    ...defaultMaterialSettings,
    shadowDistance: -2,
    shadowBlur: -4,
    shadowStrength: 2,
    rimWidth: -1,
    creviceBrightness: 2,
  });

  expect(style).toContain("--material-rim-width: 0px");
  expect(style).toContain("--material-shadow-far-blur: 0px");
  expect(style).toContain("--material-shadow-strength: 1.000");
  expect(style).toContain("--material-shadow-far-x: 0.000px");
  expect(style).toContain(
    "--material-crevice-color: color-mix(in srgb, #000 0.000%, #fff 100.000%)",
  );
});

test("includes complete button material styles in server-rendered HTML", async ({ request }) => {
  const response = await request.get("/snapdesign");

  expect(response.ok()).toBe(true);
  const html = await response.text();
  const buttonSurface = html.match(
    /<span[^>]*class="[^"]*snap-button-surface[^"]*"[^>]*>/,
  )?.[0];

  expect(buttonSurface).toBeDefined();
  expect(buttonSurface).toContain("--material-light-angle:");
  expect(buttonSurface).toContain("--material-shadow-far-x:");
  expect(buttonSurface).toContain("--material-normal-315:");
  expect(buttonSurface).toContain("--material-specular-peak:");
  expect(buttonSurface).toContain("--material-crevice-visibility: hidden");
  expect(buttonSurface).toContain(
    "--material-color: var(--snap-button-color)",
  );
});

test("server-renders material radios from Slot and Circle surfaces", async ({ request }) => {
  const response = await request.get("/snapdesign");

  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("snap-radio checked");
  expect(html).toContain("snap-slot");
  expect(html).toContain("radio-slot");
  expect(html).toContain("circle");
  expect(html).toContain("radio-circle");
  expect(html).toContain("--radio-size: 22px");
  expect(html).toContain("--circle-color: var(--radio-accent-color)");
});

test("server-renders material checkbox from square material surfaces", async ({ request }) => {
  const response = await request.get("/snapdesign");

  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("snap-checkbox checked");
  expect(html).toContain("checkbox-slot");
  expect(html).toContain("checkbox-square");
  expect(html).toContain("--checkbox-size: 22px");
  expect(html).toContain("--material-color: var(--checkbox-accent-color)");
});

test("hydrates server-rendered buttons and keeps material interactions reactive", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    pageErrors.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  await page.goto("/snapdesign");

  const svelteTab = page.getByRole("tab", { name: "Svelte" });
  await expect(async () => {
    await svelteTab.click();
    expect(await svelteTab.getAttribute("aria-selected")).toBe("true");
  }).toPass();
  expect(pageErrors).toEqual([]);

  const button = page.getByRole("button", { name: "Default", exact: true }).first();
  const surface = button.locator(".snap-button-surface");
  const content = surface.locator(".material-content");
  await expect(button).toHaveCSS("font-family", /Bitcount Grid Single/);
  await expect(content).toHaveCSS("padding-top", "8px");
  await expect(content).toHaveCSS("padding-bottom", "6px");
  const minimalButton = page
    .getByRole("group", { name: "Minimal buttons" })
    .getByRole("button", {
      name: "Default",
    });
  await expect(minimalButton).toHaveCSS("font-family", /Bitcount Grid Single/);
  await expect(minimalButton).toHaveCSS("padding-top", "10px");
  await expect(minimalButton).toHaveCSS("padding-bottom", "8px");
  const activeButton = page
    .getByRole("group", { name: "Skeuomorphic buttons" })
    .getByRole("button", { name: "Active" });
  await expect(activeButton.locator(".snap-button-content")).toHaveCSS(
    "color",
    "rgb(255, 93, 15)",
  );
  await expect(activeButton.locator(".snap-button-content")).toHaveCSS(
    "text-shadow",
    /rgba?\(255, 93, 15/,
  );
  await expect(
    page.getByRole("group", { name: /buttons/ }).getByRole("button", {
      name: "Disabled",
    }),
  ).toHaveCount(0);
  const shadowBlur = () => surface.evaluate((element) =>
    Number.parseFloat(
      getComputedStyle(element).getPropertyValue("--material-shadow-far-blur"),
    ),
  );

  expect(await shadowBlur()).toBeCloseTo(6.25);
  await button.hover();
  await expect.poll(shadowBlur).toBeCloseTo(1.25);
});

test("material radios preserve native grouping and agreed sizing", async ({ page }) => {
  await page.goto("/snapdesign");

  const group = page.getByRole("group", {
    name: "Skeuomorphic selection controls",
  });
  const first = group.getByRole("radio", { name: "First" });
  const second = group.getByRole("radio", { name: "Second" });
  const firstControl = first.locator("..");
  const secondControl = second.locator("..");
  const slot = firstControl.locator(".radio-slot");
  const circle = firstControl.locator(".radio-circle");

  await expect(first).toBeChecked();
  await expect(second).not.toBeChecked();
  await expect(firstControl).toHaveCSS("width", "22px");
  await expect(circle).toHaveCSS("width", "13px");
  await expect(firstControl.locator(".radio-slot .radio-circle")).toHaveCount(0);

  const [controlBox, circleBox] = await Promise.all([
    firstControl.boundingBox(),
    circle.boundingBox(),
  ]);
  expect(controlBox).not.toBeNull();
  expect(circleBox).not.toBeNull();
  expect(
    Math.abs(
      controlBox!.x + controlBox!.width / 2 -
        (circleBox!.x + circleBox!.width / 2),
    ),
  ).toBeLessThan(0.5);
  expect(
    Math.abs(
      controlBox!.y + controlBox!.height / 2 -
        (circleBox!.y + circleBox!.height / 2),
    ),
  ).toBeLessThan(0.5);

  const materialVariable = (locator: typeof slot, name: string) =>
    locator.evaluate(
      (element, propertyName) =>
        getComputedStyle(element).getPropertyValue(propertyName).trim(),
      name,
    );
  expect(await materialVariable(slot, "--material-rim-width")).toBe("0.4px");
  expect(await materialVariable(slot, "--material-shadow-far-blur")).toBe("3px");
  expect(await materialVariable(circle, "--material-rim-width")).toBe("0.55px");
  expect(await materialVariable(circle, "--material-shadow-far-blur")).toBe("3.5px");

  const shadowDistance = async (locator: typeof slot) => {
    const [x, y] = await Promise.all([
      materialVariable(locator, "--material-shadow-far-x"),
      materialVariable(locator, "--material-shadow-far-y"),
    ]);
    return Math.hypot(Number.parseFloat(x), Number.parseFloat(y));
  };
  expect(await shadowDistance(slot)).toBeCloseTo(3.5, 2);
  expect(await shadowDistance(circle)).toBeCloseTo(3, 2);

  await expect(async () => {
    await second.check();
    await expect(secondControl).toHaveClass(/checked/);
  }).toPass();
  await expect(first).not.toBeChecked();
  await expect(second).toBeChecked();

  await second.press("ArrowUp");
  await expect(first).toBeChecked();
  await expect(firstControl).toHaveClass(/checked/);
  await expect(secondControl).not.toHaveClass(/checked/);
});

test("material checkbox keeps native behavior and centers its raised square", async ({ page }) => {
  await page.goto("/snapdesign");

  const group = page.getByRole("group", {
    name: "Skeuomorphic selection controls",
  });
  const checkbox = group.getByRole("checkbox", { name: "Checkbox" });
  const control = checkbox.locator("..");
  const slot = control.locator(".checkbox-slot");
  const square = control.locator(".checkbox-square");

  await expect(checkbox).toBeChecked();
  await expect(control).toHaveClass(/checked/);
  await expect(control).toHaveCSS("width", "22px");
  await expect(slot).toHaveCSS("border-radius", "3px");
  await expect(square).toHaveCSS("width", "16px");
  await expect(square).toHaveCSS("border-radius", "2px");
  await expect(control.locator(".checkbox-check")).toHaveCount(2);
  await expect(control.locator(".checkbox-slot .checkbox-square")).toHaveCount(0);

  const [controlBox, squareBox] = await Promise.all([
    control.boundingBox(),
    square.boundingBox(),
  ]);
  expect(controlBox).not.toBeNull();
  expect(squareBox).not.toBeNull();
  expect(
    Math.abs(
      controlBox!.x + controlBox!.width / 2 -
        (squareBox!.x + squareBox!.width / 2),
    ),
  ).toBeLessThan(0.5);
  expect(
    Math.abs(
      controlBox!.y + controlBox!.height / 2 -
        (squareBox!.y + squareBox!.height / 2),
    ),
  ).toBeLessThan(0.5);

  await expect(async () => {
    await checkbox.uncheck();
    await expect(control).not.toHaveClass(/checked/);
  }).toPass();
  await expect(checkbox).not.toBeChecked();

  await checkbox.focus();
  await checkbox.press("Space");
  await expect(checkbox).toBeChecked();
  await expect(control).toHaveClass(/checked/);
});

test("minimal selection controls use aligned labels and inset orange indicators", async ({ page }) => {
  await page.goto("/snapdesign");

  const group = page.getByRole("group", { name: "Minimal selection controls" });
  const textStarts = await group.locator("label > span:last-child").evaluateAll(
    (labels) => labels.map((label) => label.getBoundingClientRect().x),
  );
  expect(Math.max(...textStarts) - Math.min(...textStarts)).toBeLessThan(0.5);

  const toggleTrack = group.locator(".minimal-toggle > span").first();
  const checkboxBox = group.locator(".minimal-checkbox-box");
  const radioRings = group.locator(".minimal-radio-ring");
  await expect(toggleTrack).toHaveCSS("border-radius", "999px");
  await expect(checkboxBox).toHaveCSS("border-radius", "3px");
  await expect(radioRings.first()).toHaveCSS("border-radius", "50%");
  await expect(radioRings).toHaveCount(2);

  const indicatorStyle = await radioRings.first().evaluate((element) => {
    const style = getComputedStyle(element, "::before");
    return {
      width: style.width,
      height: style.height,
      borderRadius: style.borderRadius,
      background: style.backgroundColor,
    };
  });
  expect(indicatorStyle).toEqual({
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    background: "rgb(255, 93, 15)",
  });
});

test("dial occupies the top-right UI element slot", async ({ page }) => {
  await page.goto("/snapdesign");

  const [title, buttons, dial] = await Promise.all([
    page.locator(".oversized-section-title").boundingBox(),
    page.locator(".buttons-card").boundingBox(),
    page.locator(".dial-card").boundingBox(),
  ]);
  expect(title).not.toBeNull();
  expect(buttons).not.toBeNull();
  expect(dial).not.toBeNull();
  expect(Math.abs(title!.y - dial!.y)).toBeLessThan(0.5);
  expect(Math.abs(buttons!.y - dial!.y)).toBeLessThan(0.5);
  expect(dial!.x).toBeGreaterThan(buttons!.x);
});

test("Layout section follows the title, specimens, and table composition", async ({ page }) => {
  await page.goto("/snapdesign");

  const [heading, containers, table] = await Promise.all([
    page.locator(".layout-section .section-heading").boundingBox(),
    page.locator(".layout-section .container-card").boundingBox(),
    page.locator(".layout-section .table-card").boundingBox(),
  ]);
  expect(heading).not.toBeNull();
  expect(containers).not.toBeNull();
  expect(table).not.toBeNull();
  expect(containers!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height - 0.5);
  expect(Math.abs(containers!.y - table!.y)).toBeLessThan(0.5);
  expect(Math.abs(containers!.height - table!.height)).toBeLessThan(0.5);
  expect(table!.width).toBeGreaterThan(containers!.width);
  await expect(page.locator(".layout-section .cards-slots-stage > *")).toHaveCount(4);
});

test("top navigation matches the SnapDesign page width and surface", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/snapdesign");

  const header = page.locator(".site-header");
  const nav = page.locator(".nav-bar");
  const wordmark = page.locator(".wordmark");
  const projectTrigger = page.getByRole("button", {
    name: /Switch project\. Current project: SnapDesign/,
  });
  const projectMenu = page.locator("#project-nav-menu");
  const showcase = page.locator(".showcase-section").first();
  const github = page.locator(".github-link");
  await expect(header).toHaveCSS("background-color", "rgb(246, 246, 246)");
  await expect(header).toHaveCSS("border-bottom", "1px solid rgb(215, 215, 215)");
  await expect(wordmark).toHaveText("SnapDesign");
  await expect(wordmark).toHaveAttribute("href", "/snapdesign");
  await expect(wordmark).toHaveCSS("font-family", "Geist, sans-serif");

  await projectTrigger.click();
  await expect(projectMenu).toBeVisible();
  await expect(projectMenu).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(projectMenu).toHaveCSS("border", "1px solid rgba(0, 0, 0, 0.24)");
  await expect(projectMenu).toHaveCSS("border-radius", "8px");
  await expect(projectMenu).toHaveCSS(
    "box-shadow",
    "rgba(36, 38, 39, 0.05) 0px 3px 10px 0px",
  );
  await expect(projectMenu).toHaveCSS("padding-top", "8px");
  await expect(projectMenu).toHaveCSS("padding-bottom", "8px");

  const projectOptions = await projectMenu.getByRole("link").all();
  expect(projectOptions).toHaveLength(4);
  for (const option of projectOptions) {
    await expect(option).toHaveCSS("color", "rgb(8, 8, 8)");
    await expect(option).toHaveCSS("font-family", "Geist, sans-serif");
    await expect(option).toHaveCSS("font-size", "20px");
    await expect(option).toHaveCSS("font-weight", "500");
    await expect(option).toHaveCSS("letter-spacing", "-0.8px");
    await expect(option).toHaveCSS("line-height", "20px");
  }
  await expect(wordmark).toHaveCSS("color", "rgb(8, 8, 8)");
  await expect(wordmark).toHaveCSS("font-size", "20px");
  await expect(wordmark).toHaveCSS("font-weight", "500");
  await expect(wordmark).toHaveCSS("letter-spacing", "-0.8px");
  await expect(wordmark).toHaveCSS("line-height", "20px");

  const snapSortOption = projectMenu.getByRole("link", { name: "SnapSort" });
  await snapSortOption.hover();
  await expect(snapSortOption).toHaveCSS("background-color", "rgb(236, 236, 235)");
  await expect(
    projectMenu
      .getByRole("link", { name: "SnapDesign" })
      .locator(".project-nav-check"),
  ).toHaveAttribute("aria-hidden", "true");

  const [navBox, showcaseBox, githubBox, wordmarkBox, projectMenuBox] = await Promise.all([
    nav.boundingBox(),
    showcase.boundingBox(),
    github.boundingBox(),
    wordmark.boundingBox(),
    projectMenu.boundingBox(),
  ]);
  expect(navBox).not.toBeNull();
  expect(showcaseBox).not.toBeNull();
  expect(githubBox).not.toBeNull();
  expect(wordmarkBox).not.toBeNull();
  expect(projectMenuBox).not.toBeNull();
  expect(navBox!.width).toBeCloseTo(1400);
  expect(navBox!.x).toBeCloseTo(showcaseBox!.x);
  expect(navBox!.x + navBox!.width).toBeCloseTo(
    showcaseBox!.x + showcaseBox!.width,
  );
  expect(githubBox!.x + githubBox!.width).toBeCloseTo(
    navBox!.x + navBox!.width,
  );
  expect(projectMenuBox!.x).toBeCloseTo(wordmarkBox!.x);
});

test("SnapDesign dropdown picker uses the compact-card surface", async ({ page }) => {
  await page.goto("/snapdesign");

  const select = page.locator("#select-default");
  const styles = await select.evaluate((element) => {
    const closed = getComputedStyle(element);
    const picker = getComputedStyle(element, "::picker(select)");
    const option = getComputedStyle(element.querySelector("option")!);
    const groupedSelect = document.querySelector<HTMLSelectElement>("#select-grouped")!;
    const groupedPicker = getComputedStyle(groupedSelect, "::picker(select)");
    const iconSelect = document.querySelector<HTMLSelectElement>("#select-icons")!;
    const iconPicker = getComputedStyle(iconSelect, "::picker(select)");
    const optgroup = getComputedStyle(groupedSelect.querySelector("optgroup")!);
    const secondOptgroup = getComputedStyle(groupedSelect.querySelectorAll("optgroup")[1]);
    const groupedOption = getComputedStyle(groupedSelect.querySelector("option")!);
    return {
      closedBorder: closed.border,
      closedShadow: closed.boxShadow,
      closedPaddingLeft: closed.paddingLeft,
      pickerBackground: picker.backgroundColor,
      pickerBorder: picker.border,
      pickerRadius: picker.borderRadius,
      pickerShadow: picker.boxShadow,
      pickerPaddingBlock: `${picker.paddingTop} ${picker.paddingBottom}`,
      groupedPickerPaddingBlock: `${groupedPicker.paddingTop} ${groupedPicker.paddingBottom}`,
      iconPickerPaddingBlock: `${iconPicker.paddingTop} ${iconPicker.paddingBottom}`,
      optionBackground: option.backgroundColor,
      optgroupFont: optgroup.fontFamily,
      optgroupColor: optgroup.color,
      optgroupFontSize: optgroup.fontSize,
      optgroupFontWeight: optgroup.fontWeight,
      optgroupTextIndent: optgroup.textIndent,
      secondOptgroupMarginTop: secondOptgroup.marginTop,
      groupedOptionFont: groupedOption.fontFamily,
      groupedOptionColor: groupedOption.color,
      groupedOptionFontSize: groupedOption.fontSize,
    };
  });
  expect(styles).toEqual({
    closedBorder: "1px solid rgb(213, 216, 220)",
    closedShadow: "none",
    closedPaddingLeft: "16px",
    pickerBackground: "rgb(255, 255, 255)",
    pickerBorder: "1px solid rgba(0, 0, 0, 0.24)",
    pickerRadius: "8px",
    pickerShadow: "rgba(36, 38, 39, 0.05) 0px 3px 10px 0px",
    pickerPaddingBlock: "8px 8px",
    groupedPickerPaddingBlock: "16px 16px",
    iconPickerPaddingBlock: "8px 8px",
    optionBackground: "rgba(0, 0, 0, 0)",
    optgroupFont: '"Bitcount Grid Single", monospace',
    optgroupColor: "rgba(0, 0, 0, 0.58)",
    optgroupFontSize: "14.4px",
    optgroupFontWeight: "400",
    optgroupTextIndent: "8px",
    secondOptgroupMarginTop: "24px",
    groupedOptionFont: "Geist, sans-serif",
    groupedOptionColor: "rgb(51, 54, 55)",
    groupedOptionFontSize: "16px",
  });

  await select.click();
  const optionTwo = page.getByRole("option", { name: "Option Two" });
  await expect(optionTwo).toBeVisible();
  await optionTwo.hover();
  await expect(optionTwo).toHaveCSS("background-color", "rgb(236, 236, 235)");
  await optionTwo.click();
  await expect(select).toHaveValue("option2");

  const grouped = page.locator("#select-grouped");
  await select.focus();
  await select.press("Tab");
  await expect(grouped).toBeFocused();

  await grouped.selectOption({ label: "Item B2" });
  await expect(grouped).toHaveValue("Item B2");

  const iconSelect = page.locator("#select-icons");
  await expect(iconSelect.locator("option .material-symbols-rounded")).toHaveCount(3);
  await iconSelect.selectOption("animation");
  await expect(iconSelect).toHaveValue("animation");
  await expect(iconSelect.locator("selectedcontent")).toContainText("Motion");
});

test("progress card contains full-width minimal progress and loading displays", async ({ page }) => {
  await page.goto("/snapdesign");

  const card = page.locator(".progress-card");
  await expect(card.getByRole("group", { name: "Minimal progress" })).toBeVisible();
  await expect(card.locator("progress")).toHaveCount(4);
  await expect(
    card.getByRole("progressbar", { name: "Loading", exact: true }),
  ).toBeAttached();
  await expect(card.getByRole("progressbar", { name: "Braille progress" })).toBeAttached();
  await expect(card.getByRole("progressbar", { name: "Braille loading" })).toBeAttached();
  await expect(card.locator(".ascii-progress").first()).toContainText("65%");
  await expect(card.locator(".ascii-progress-value")).toHaveCount(2);
  await expect(card.locator(".ascii-progress-cells > span")).toHaveCount(60);
  await expect(card.locator(".ascii-loading-cell")).toHaveCount(20);
  await expect(card.locator(".braille-progress-cells")).toContainText("⣿");
  await expect(card.locator(".braille-progress-cells")).toContainText("⣀");
  await expect(card.locator(".braille-loading-cell")).toHaveCount(40);
  await expect(card.getByRole("slider")).toHaveCount(0);
  await expect(card.locator(".material-progress")).toHaveCount(0);

  const [stackBox, progressBox, loadingBox, valueBox, brailleProgressBox, brailleLoadingBox] = await Promise.all([
    card.locator(".progress-stack").boundingBox(),
    card.locator(".ascii-progress-visual").first().boundingBox(),
    card.locator(".ascii-loading-visual").first().boundingBox(),
    card.locator(".ascii-progress-value").first().boundingBox(),
    card.locator(".braille-progress-visual").boundingBox(),
    card.locator(".braille-loading-visual").boundingBox(),
  ]);
  expect(stackBox).not.toBeNull();
  expect(progressBox).not.toBeNull();
  expect(loadingBox).not.toBeNull();
  expect(valueBox).not.toBeNull();
  expect(brailleProgressBox).not.toBeNull();
  expect(brailleLoadingBox).not.toBeNull();
  expect(Math.abs(progressBox!.width - stackBox!.width)).toBeLessThan(0.5);
  expect(Math.abs(loadingBox!.width - stackBox!.width)).toBeLessThan(0.5);
  expect(Math.abs(brailleProgressBox!.width - stackBox!.width)).toBeLessThan(0.5);
  expect(Math.abs(brailleLoadingBox!.width - stackBox!.width)).toBeLessThan(0.5);
  expect(
    Math.abs(
      valueBox!.x + valueBox!.width / 2 -
        (progressBox!.x + progressBox!.width / 2),
    ),
  ).toBeLessThan(0.5);
  await expect(card.locator(".ascii-progress-value").first()).toHaveCSS(
    "font-family",
    /Geist Mono/,
  );
  const brailleLoadingStyle = await card.locator(".braille-loading-cell").first().evaluate(
    (element) => {
      const style = getComputedStyle(element);
      const glyph = getComputedStyle(element, "::before");
      return {
        transform: style.transform,
        animationName: glyph.animationName,
      };
    },
  );
  expect(brailleLoadingStyle.transform).toBe("none");
  expect(brailleLoadingStyle.animationName).toContain("braille-loading-wave");
});

test("dial specimens omit disabled controls and use a borderless direction dot", async ({ page }) => {
  await page.goto("/snapdesign");

  await expect(page.getByRole("slider", { name: /Disabled .* dial/ })).toHaveCount(0);
  const dial = page.getByRole("slider", { name: "Skeuomorphic dial" });
  const directionDot = dial.locator(".dial-direction");
  await expect(directionDot).toHaveClass(/circle/);
  await expect(directionDot).toHaveCSS("width", "8px");
  await expect(directionDot).toHaveCSS("height", "8px");
  expect(
    await directionDot.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--material-rim-visibility").trim(),
    ),
  ).toBe("hidden");

  const [dialBounds, directionBounds] = await Promise.all([
    dial.boundingBox(),
    directionDot.boundingBox(),
  ]);
  expect(dialBounds).not.toBeNull();
  expect(directionBounds).not.toBeNull();
  expect(directionBounds!.x).toBeGreaterThanOrEqual(dialBounds!.x);
  expect(directionBounds!.y).toBeGreaterThanOrEqual(dialBounds!.y);
  expect(directionBounds!.x + directionBounds!.width).toBeLessThanOrEqual(
    dialBounds!.x + dialBounds!.width,
  );
  expect(directionBounds!.y + directionBounds!.height).toBeLessThanOrEqual(
    dialBounds!.y + dialBounds!.height,
  );
  const initialTransform = await directionDot.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d };
  });
  expect(initialTransform).toEqual({ a: 1, b: 0, c: 0, d: 1 });
  const initialDirectionOffsetX =
    directionBounds!.x + directionBounds!.width / 2 -
    (dialBounds!.x + dialBounds!.width / 2);

  const value = dial.locator(".dial-value");
  await expect(value).toHaveText("320");
  await expect(dial).toHaveAttribute("aria-valuetext", "320");
  await expect(value).toHaveCSS("font-family", /Bitcount Grid Single/);
  await expect(
    page.getByRole("group", { name: "Skeuomorphic dial" }).locator("output"),
  ).toHaveCount(0);

  const markers = dial.locator(".dial-marker");
  await expect(markers).toHaveCount(36);
  await expect(
    page.getByRole("slider", { name: "Minimal dial" }).locator(".dial-marker"),
  ).toHaveCount(36);
  await expect(dial.locator('.dial-marker.selected[data-marker-angle="320"]')).toHaveCount(1);
  await expect(markers.first()).toHaveCSS("width", "3px");
  await expect(markers.first()).toHaveCSS("height", "3px");
  await expect(markers.first()).toHaveCSS("border-radius", "50%");
  const [dialBox, topMarkerBox] = await Promise.all([
    dial.boundingBox(),
    markers.first().boundingBox(),
  ]);
  expect(dialBox).not.toBeNull();
  expect(topMarkerBox).not.toBeNull();
  expect(dialBox!.y - (topMarkerBox!.y + topMarkerBox!.height)).toBeGreaterThanOrEqual(5);

  await expect(async () => {
    await dial.press("Home");
    expect(await dial.getAttribute("aria-valuenow")).toBe("0");
  }).toPass();
  await expect(value).toHaveText("0");
  const zeroMarker = dial.locator('.dial-marker.selected[data-marker-angle="0"]');
  await expect(zeroMarker).toHaveCount(1);
  await expect.poll(() =>
    zeroMarker.evaluate((element) => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return Math.hypot(matrix.a, matrix.b);
    }),
  ).toBeCloseTo(2);
  await dial.press("ArrowRight");
  await expect(dial).toHaveAttribute("aria-valuenow", "10");
  await expect(value).toHaveText("10");
  await expect(dial.locator('.dial-marker.selected[data-marker-angle="10"]')).toHaveCount(1);
  await dial.press("ArrowLeft");
  await expect(dial).toHaveAttribute("aria-valuenow", "0");
  const [rotatedDialBounds, rotatedDirectionBounds] = await Promise.all([
    dial.boundingBox(),
    directionDot.boundingBox(),
  ]);
  expect(rotatedDialBounds).not.toBeNull();
  expect(rotatedDirectionBounds).not.toBeNull();
  const rotatedDirectionOffsetX =
    rotatedDirectionBounds!.x + rotatedDirectionBounds!.width / 2;
  const rotatedDialCenterX =
    rotatedDialBounds!.x + rotatedDialBounds!.width / 2;
  expect(rotatedDirectionOffsetX - rotatedDialCenterX).toBeCloseTo(0);
  expect(initialDirectionOffsetX).not.toBeCloseTo(0);
  expect(rotatedDirectionBounds!.y).toBeLessThan(
    rotatedDialBounds!.y + rotatedDialBounds!.height / 2,
  );
  const rotatedTransform = await directionDot.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d };
  });
  expect(rotatedTransform).toEqual({ a: 1, b: 0, c: 0, d: 1 });

  const pointerDialBox = await dial.boundingBox();
  expect(pointerDialBox).not.toBeNull();
  await dial.hover({
    position: {
      x: pointerDialBox!.width - 2,
      y: pointerDialBox!.height / 2,
    },
  });
  await page.mouse.down();
  await expect(dial).toHaveClass(/dragging/);
  await expect(dial.locator(".dial-marker.selected")).toHaveCSS(
    "background-color",
    "rgb(255, 93, 15)",
  );
  await expect(dial.locator(".dial-marker.selected")).toHaveCSS(
    "transition-duration",
    "0.15s, 0s, 0.15s",
  );
  await page.mouse.up();
  await expect(dial).not.toHaveClass(/dragging/);
  await expect(dial.locator(".dial-marker.selected")).toHaveCSS(
    "transition-duration",
    "0.15s, 0.15s, 0.15s",
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(markers.first()).toHaveCSS("transition-duration", "0s");
});
