import { expect, test } from "@playwright/test";

const geometryTolerance = 0.5;
const precisionCenterGap = 20;
const precisionIdleTickHeight = 8;
const precisionTickOpacity = 1;
const precisionTickWidth = 2;
const visibleLabelOpacity = 0.29;
const minimumLabelDarkness = 70;
const maximumLabelDarkness = 94;

type OrangeAlignment = {
  orangeCount: number;
  markerIndex: number;
  centerDelta: number;
};

type SelectionPresentation = {
  accentColor: string;
  tickColor: string;
  labelColor: string;
  accentTickCount: number;
  accentLabelCount: number;
  activeZIndex: number;
  maximumZIndex: number;
  maximumZIndexCount: number;
  tickTransitionProperty: string;
  labelTransitionProperty: string;
};

test("sliders keep native controls in SSR and own unique Engine visual layers", async ({
  page,
  request,
}) => {
  const response = await request.get("/snapdesign");

  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('id="precision-range"');
  expect(html).toContain('id="precision-range-engine"');
  expect(html).toContain('type="range"');

  await page.goto("/snapdesign");

  const sliderCount = await page.locator(".slider").count();
  expect(sliderCount).toBeGreaterThan(0);
  await expect(page.locator(".slider > input[type=range]")).toHaveCount(
    sliderCount,
  );
  await expect(
    page.locator(".slider > .snap-engine-canvas.slider-visual"),
  ).toHaveCount(sliderCount);

  const engineIds = await page
    .locator(".slider > .snap-engine-canvas.slider-visual")
    .evaluateAll((engines) => engines.map((engine) => engine.id));
  expect(engineIds.every(Boolean)).toBe(true);
  expect(new Set(engineIds).size).toBe(engineIds.length);
});

test("precision slider uses stable compositor-only markers with a tapered lens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto("/snapdesign");

  const input = page.getByRole("slider", { name: "Precision slider" });
  const slider = input.locator("..");
  const ruler = slider.locator(".precision-ruler");
  const marks = ruler.locator(".precision-mark");
  const ticks = ruler.locator(".precision-tick");
  const labels = ruler.locator(".precision-label");

  await input.scrollIntoViewIfNeeded();
  await expect(ruler).toHaveCSS("opacity", "1");
  await expect(marks).toHaveCount(101);
  await expect(ticks).toHaveCount(101);
  await expect(labels).toHaveCount(101);
  await expect(ruler.locator(".precision-coarse-mark")).toHaveCount(0);
  await expect(ruler.locator(".precision-zoom-mark")).toHaveCount(0);

  expect(
    await marks.evaluateAll((elements) =>
      elements.every(
        (element) =>
          element.querySelectorAll(".precision-tick").length === 1 &&
          element.querySelectorAll(".precision-label").length === 1,
      ),
    ),
  ).toBe(true);
  expect(
    await ticks.evaluateAll((elements) =>
      elements.every((element) => getComputedStyle(element).height === "24px"),
    ),
  ).toBe(true);
  expect(
    await labels.evaluateAll((elements) =>
      elements.every(
        (element) => Number.parseFloat(getComputedStyle(element).opacity) === 0,
      ),
    ),
  ).toBe(true);

  const idleTickMetrics = await ticks.evaluateAll((elements) => {
    const metrics = elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        height: box.height,
        opacity: Number.parseFloat(getComputedStyle(element).opacity),
        width: box.width,
      };
    });
    return {
      minimumHeight: Math.min(...metrics.map(({ height }) => height)),
      maximumHeight: Math.max(...metrics.map(({ height }) => height)),
      minimumOpacity: Math.min(...metrics.map(({ opacity }) => opacity)),
      maximumOpacity: Math.max(...metrics.map(({ opacity }) => opacity)),
      minimumWidth: Math.min(...metrics.map(({ width }) => width)),
      maximumWidth: Math.max(...metrics.map(({ width }) => width)),
    };
  });
  expect(idleTickMetrics.minimumHeight).toBeCloseTo(precisionIdleTickHeight, 2);
  expect(idleTickMetrics.maximumHeight).toBeCloseTo(precisionIdleTickHeight, 2);
  expect(idleTickMetrics.minimumOpacity).toBeCloseTo(precisionTickOpacity, 3);
  expect(idleTickMetrics.maximumOpacity).toBeCloseTo(precisionTickOpacity, 3);
  expect(idleTickMetrics.minimumWidth).toBeCloseTo(precisionTickWidth, 2);
  expect(idleTickMetrics.maximumWidth).toBeCloseTo(precisionTickWidth, 2);

  const initialMarkCount = await marks.count();
  const initialLabelCount = await labels.count();
  const initialPrecisionNodes = await ruler.evaluateHandle((element) => [
    ...element.querySelectorAll(
      ".precision-mark, .precision-tick, .precision-label",
    ),
  ]);
  const markerBounds = await ticks.evaluateAll((elements) => {
    const firstBox = elements[0].getBoundingClientRect();
    const lastBox = elements[elements.length - 1].getBoundingClientRect();
    return {
      start: firstBox.left + firstBox.width / 2,
      end: lastBox.left + lastBox.width / 2,
    };
  });
  const inputBox = await input.boundingBox();
  expect(inputBox).not.toBeNull();

  const readVisibleLabelTexts = () =>
    labels.evaluateAll(
      (elements, opacityThreshold) =>
        elements
          .filter(
            (element) =>
              Number.parseFloat(getComputedStyle(element).opacity) >=
              opacityThreshold,
          )
          .map((element) => element.textContent?.trim()),
      visibleLabelOpacity,
    );

  const readOrangeAlignment = () =>
    slider.evaluate((root) => {
      const thumb = root.querySelector<HTMLElement>(".slider-thumb");
      const orangeMarks = [
        ...root.querySelectorAll<HTMLElement>(".precision-mark"),
      ].filter(
        (mark) =>
          mark.querySelector<HTMLElement>(".precision-tick")?.style
            .backgroundColor === "var(--slider-accent-color)",
      );
      const orangeTick =
        orangeMarks[0]?.querySelector<HTMLElement>(".precision-tick");

      if (!thumb || !orangeTick || orangeMarks.length !== 1) {
        return {
          orangeCount: orangeMarks.length,
          markerIndex: -1,
          centerDelta: Number.POSITIVE_INFINITY,
        };
      }

      const thumbBox = thumb.getBoundingClientRect();
      const tickBox = orangeTick.getBoundingClientRect();
      return {
        orangeCount: orangeMarks.length,
        markerIndex: Number(orangeMarks[0].dataset.markerIndex),
        centerDelta:
          tickBox.left +
          tickBox.width / 2 -
          (thumbBox.left + thumbBox.width / 2),
      };
    });

  const assertOrangeAlignment = (
    alignment: OrangeAlignment,
    currentValue: string,
  ) => {
    expect(alignment.orangeCount).toBe(1);
    expect(alignment.markerIndex).toBe(Math.round(Number(currentValue)));
    expect(Math.abs(alignment.centerDelta)).toBeLessThan(geometryTolerance);
  };

  const assertOrangeAligned = async () => {
    const [alignment, currentValue] = await Promise.all([
      readOrangeAlignment(),
      input.inputValue(),
    ]);
    assertOrangeAlignment(alignment, currentValue);
  };

  const waitForLensFrame = () =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        }),
    );

  const setDraggedValue = async (nextValue: number) => {
    return slider.evaluate((root, value) => {
      const inputElement = root.querySelector<HTMLInputElement>(
        'input[type="range"]',
      );
      if (!inputElement) throw new Error("Precision slider input is missing");

      inputElement.value = String(value);
      inputElement.dispatchEvent(new Event("input", { bubbles: true }));

      return new Promise<{
        alignment: OrangeAlignment;
        currentValue: string;
        presentation: SelectionPresentation;
      }>((resolve) => {
        requestAnimationFrame(() => {
          const thumb = root.querySelector<HTMLElement>(".slider-thumb");
          const markerNodes = [
            ...root.querySelectorAll<HTMLElement>(".precision-mark"),
          ];
          const orangeMarks = markerNodes.filter(
            (mark) =>
              mark.querySelector<HTMLElement>(".precision-tick")?.style
                .backgroundColor === "var(--slider-accent-color)",
          );
          const orangeTick =
            orangeMarks[0]?.querySelector<HTMLElement>(".precision-tick");
          const activeIndex = Math.round(Number(inputElement.value));
          const activeMarker = markerNodes.find(
            (marker) => Number(marker.dataset.markerIndex) === activeIndex,
          );
          const activeTick =
            activeMarker?.querySelector<HTMLElement>(".precision-tick");
          const activeLabel =
            activeMarker?.querySelector<HTMLElement>(".precision-label");
          const accentProbe = document.createElement("span");
          accentProbe.style.backgroundColor = "var(--slider-accent-color)";
          root.append(accentProbe);
          const accentColor = getComputedStyle(accentProbe).backgroundColor;
          accentProbe.remove();
          const zIndices = markerNodes.map((marker) => {
            const zIndex = Number.parseInt(getComputedStyle(marker).zIndex, 10);
            return Number.isNaN(zIndex) ? 0 : zIndex;
          });
          const maximumZIndex = Math.max(...zIndices);
          const presentation = {
            accentColor,
            tickColor: activeTick
              ? getComputedStyle(activeTick).backgroundColor
              : "",
            labelColor: activeLabel ? getComputedStyle(activeLabel).color : "",
            accentTickCount: markerNodes.filter((marker) => {
              const tick = marker.querySelector<HTMLElement>(".precision-tick");
              return tick
                ? getComputedStyle(tick).backgroundColor === accentColor
                : false;
            }).length,
            accentLabelCount: markerNodes.filter((marker) => {
              const label =
                marker.querySelector<HTMLElement>(".precision-label");
              return label
                ? getComputedStyle(label).color === accentColor
                : false;
            }).length,
            activeZIndex: activeMarker
              ? Number.parseInt(getComputedStyle(activeMarker).zIndex, 10)
              : Number.NEGATIVE_INFINITY,
            maximumZIndex,
            maximumZIndexCount: zIndices.filter(
              (zIndex) => zIndex === maximumZIndex,
            ).length,
            tickTransitionProperty: activeTick
              ? getComputedStyle(activeTick).transitionProperty
              : "",
            labelTransitionProperty: activeLabel
              ? getComputedStyle(activeLabel).transitionProperty
              : "",
          };

          if (!thumb || !orangeTick || orangeMarks.length !== 1) {
            resolve({
              alignment: {
                orangeCount: orangeMarks.length,
                markerIndex: -1,
                centerDelta: Number.POSITIVE_INFINITY,
              },
              currentValue: inputElement.value,
              presentation,
            });
            return;
          }

          const thumbBox = thumb.getBoundingClientRect();
          const tickBox = orangeTick.getBoundingClientRect();
          resolve({
            alignment: {
              orangeCount: orangeMarks.length,
              markerIndex: Number(orangeMarks[0].dataset.markerIndex),
              centerDelta:
                tickBox.left +
                tickBox.width / 2 -
                (thumbBox.left + thumbBox.width / 2),
            },
            currentValue: inputElement.value,
            presentation,
          });
        });
      });
    }, nextValue);
  };

  const assertSelectionPresentation = (presentation: SelectionPresentation) => {
    expect(presentation.tickColor).toBe(presentation.accentColor);
    expect(presentation.labelColor).toBe(presentation.accentColor);
    expect(presentation.accentTickCount).toBe(1);
    expect(presentation.accentLabelCount).toBe(1);
    expect(presentation.activeZIndex).toBe(presentation.maximumZIndex);
    expect(presentation.maximumZIndexCount).toBe(1);
    expect(
      presentation.tickTransitionProperty
        .split(",")
        .map((property) => property.trim()),
    ).toEqual(["transform"]);
    expect(
      presentation.labelTransitionProperty
        .split(",")
        .map((property) => property.trim()),
    ).toEqual(["transform", "opacity"]);
  };

  await page.mouse.move(
    inputBox!.x + inputBox!.width / 2,
    inputBox!.y + inputBox!.height / 2,
  );
  await expect.poll(readVisibleLabelTexts).toEqual(["50"]);
  const hoverReadout = await marks
    .filter({ has: page.locator('.precision-label:text-is("50")') })
    .evaluate((marker) => {
      const tick = marker.querySelector<HTMLElement>(".precision-tick");
      const label = marker.querySelector<HTMLElement>(".precision-label");
      if (!tick || !label) throw new Error("Hover readout is incomplete");
      const markerNodes = [
        ...(marker.parentElement?.querySelectorAll<HTMLElement>(
          ".precision-mark",
        ) ?? []),
      ];
      const ordinaryMarker = markerNodes.find(
        (candidate) => candidate.dataset.markerIndex === "49",
      );
      const ordinaryTick =
        ordinaryMarker?.querySelector<HTMLElement>(".precision-tick");
      const ordinaryLabel =
        ordinaryMarker?.querySelector<HTMLElement>(".precision-label");
      if (!ordinaryTick || !ordinaryLabel) {
        throw new Error("Ordinary precision marker is missing");
      }
      const zIndices = markerNodes.map((candidate) => {
        const zIndex = Number.parseInt(getComputedStyle(candidate).zIndex, 10);
        return Number.isNaN(zIndex) ? 0 : zIndex;
      });
      const maximumZIndex = Math.max(...zIndices);
      return {
        labelHeight: label.getBoundingClientRect().height,
        labelFontSize: Number.parseFloat(getComputedStyle(label).fontSize),
        labelOpacity: Number.parseFloat(getComputedStyle(label).opacity),
        labelColor: getComputedStyle(label).color,
        ordinaryLabelColor: getComputedStyle(ordinaryLabel).color,
        tickHeight: tick.getBoundingClientRect().height,
        tickOpacity: Number.parseFloat(getComputedStyle(tick).opacity),
        tickColor: getComputedStyle(tick).backgroundColor,
        ordinaryTickColor: getComputedStyle(ordinaryTick).backgroundColor,
        zIndex: Number.parseInt(getComputedStyle(marker).zIndex, 10),
        maximumZIndex,
        maximumZIndexCount: zIndices.filter(
          (zIndex) => zIndex === maximumZIndex,
        ).length,
      };
    });
  expect(hoverReadout.labelHeight).toBeCloseTo(
    hoverReadout.labelFontSize * 0.78,
    1,
  );
  expect(hoverReadout.labelOpacity).toBe(1);
  expect(hoverReadout.labelColor).toBe(hoverReadout.ordinaryLabelColor);
  expect(hoverReadout.tickHeight).toBeCloseTo(precisionIdleTickHeight, 2);
  expect(hoverReadout.tickOpacity).toBe(precisionTickOpacity);
  expect(hoverReadout.tickColor).toBe(hoverReadout.ordinaryTickColor);
  expect(hoverReadout.zIndex).toBe(hoverReadout.maximumZIndex);
  expect(hoverReadout.maximumZIndexCount).toBe(1);

  await page.mouse.move(inputBox!.x - 10, inputBox!.y + inputBox!.height / 2);
  await expect.poll(readVisibleLabelTexts).toEqual([]);

  await page.mouse.move(
    inputBox!.x + inputBox!.width / 2,
    inputBox!.y + inputBox!.height / 2,
  );
  await page.mouse.down();
  await expect(slider).toHaveClass(/dragging/);

  const initialSnapshot = await setDraggedValue(50);
  assertOrangeAlignment(
    initialSnapshot.alignment,
    initialSnapshot.currentValue,
  );
  assertSelectionPresentation(initialSnapshot.presentation);

  await expect
    .poll(readVisibleLabelTexts)
    .toEqual(["48", "49", "50", "51", "52"]);
  await assertOrangeAligned();

  const draggedTickMetrics = await ticks.evaluateAll((elements) => {
    const metrics = elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        height: box.height,
        opacity: Number.parseFloat(getComputedStyle(element).opacity),
        width: box.width,
      };
    });
    return {
      minimumHeight: Math.min(...metrics.map(({ height }) => height)),
      minimumOpacity: Math.min(...metrics.map(({ opacity }) => opacity)),
      maximumOpacity: Math.max(...metrics.map(({ opacity }) => opacity)),
      minimumWidth: Math.min(...metrics.map(({ width }) => width)),
      maximumWidth: Math.max(...metrics.map(({ width }) => width)),
    };
  });
  expect(draggedTickMetrics.minimumHeight).toBeGreaterThanOrEqual(
    precisionIdleTickHeight - 0.01,
  );
  expect(draggedTickMetrics.minimumOpacity).toBeGreaterThanOrEqual(
    precisionTickOpacity - 0.001,
  );
  expect(draggedTickMetrics.maximumOpacity).toBeLessThanOrEqual(
    precisionTickOpacity,
  );
  expect(draggedTickMetrics.minimumWidth).toBeCloseTo(precisionTickWidth, 2);
  expect(draggedTickMetrics.maximumWidth).toBeCloseTo(precisionTickWidth, 2);

  const grayTickPresentation = await ticks.evaluateAll((elements) => {
    const grayTicks = elements.filter(
      (element) =>
        element.style.backgroundColor !== "var(--slider-accent-color)",
    );
    return {
      count: grayTicks.length,
      colors: [
        ...new Set(
          grayTicks.map((element) => getComputedStyle(element).backgroundColor),
        ),
      ],
      opacities: [
        ...new Set(
          grayTicks.map((element) =>
            Number.parseFloat(getComputedStyle(element).opacity),
          ),
        ),
      ],
    };
  });
  expect(grayTickPresentation.count).toBe(100);
  expect(grayTickPresentation.colors).toHaveLength(1);
  expect(grayTickPresentation.opacities).toEqual([precisionTickOpacity]);

  const selectedTick = marks
    .filter({ has: page.locator('.precision-label:text-is("50")') })
    .locator(".precision-tick");
  await expect
    .poll(() =>
      selectedTick.evaluate(
        (element) => element.getBoundingClientRect().height,
      ),
    )
    .toBeGreaterThan(23.5);

  const visibleReadouts = await marks.evaluateAll(
    (elements, opacityThreshold) =>
      elements
        .flatMap((marker) => {
          const label = marker.querySelector<HTMLElement>(".precision-label");
          const tick = marker.querySelector<HTMLElement>(".precision-tick");
          if (
            !label ||
            !tick ||
            Number.parseFloat(getComputedStyle(label).opacity) <
              opacityThreshold
          ) {
            return [];
          }

          const markerBox = marker.getBoundingClientRect();
          const tickBox = tick.getBoundingClientRect();
          const labelBox = label.getBoundingClientRect();
          return [
            {
              index: Number(marker.getAttribute("data-marker-index")),
              text: label.textContent?.trim(),
              markerCenter: markerBox.left + markerBox.width / 2,
              tickCenter: tickBox.left + tickBox.width / 2,
              tickHeight: tickBox.height,
              labelCenter: labelBox.left + labelBox.width / 2,
              labelColor: label.style.color,
            },
          ];
        })
        .sort((left, right) => left.index - right.index),
    visibleLabelOpacity,
  );

  expect(visibleReadouts.map(({ text }) => text)).toEqual([
    "48",
    "49",
    "50",
    "51",
    "52",
  ]);
  for (let index = 0; index < visibleReadouts.length; index += 1) {
    const readout = visibleReadouts[index];
    expect(Math.abs(readout.markerCenter - readout.tickCenter)).toBeLessThan(
      geometryTolerance,
    );
    expect(Math.abs(readout.labelCenter - readout.tickCenter)).toBeLessThan(
      geometryTolerance,
    );
  }

  const visibleGaps = visibleReadouts
    .slice(1)
    .map(
      (readout, index) =>
        readout.tickCenter - visibleReadouts[index].tickCenter,
    );
  expect(visibleGaps[1]).toBeCloseTo(precisionCenterGap, 0);
  expect(visibleGaps[2]).toBeCloseTo(precisionCenterGap, 0);
  expect(visibleGaps[0]).toBeGreaterThan(0);
  expect(visibleGaps[0]).toBeLessThan(visibleGaps[1]);
  expect(visibleGaps[3]).toBeGreaterThan(0);
  expect(visibleGaps[3]).toBeLessThan(visibleGaps[2]);

  const lensCenters = await marks.evaluateAll((elements) =>
    elements.slice(46, 55).map((element) => {
      const tick = element.querySelector<HTMLElement>(".precision-tick");
      const box = tick?.getBoundingClientRect();
      return box ? box.left + box.width / 2 : Number.NaN;
    }),
  );
  const leftLensGaps = [
    lensCenters[4] - lensCenters[3],
    lensCenters[3] - lensCenters[2],
    lensCenters[2] - lensCenters[1],
    lensCenters[1] - lensCenters[0],
  ];
  const rightLensGaps = [
    lensCenters[5] - lensCenters[4],
    lensCenters[6] - lensCenters[5],
    lensCenters[7] - lensCenters[6],
    lensCenters[8] - lensCenters[7],
  ];
  for (const gaps of [leftLensGaps, rightLensGaps]) {
    expect(gaps[0]).toBeCloseTo(precisionCenterGap, 0);
    for (let index = 1; index < gaps.length; index += 1) {
      expect(gaps[index]).toBeGreaterThan(0);
      expect(gaps[index]).toBeLessThan(gaps[index - 1]);
    }
  }

  for (const readout of visibleReadouts.filter(({ index }) => index !== 50)) {
    const darkness = Number(readout.labelColor.match(/ (\d+)%/)?.[1]);
    expect(darkness).toBeGreaterThanOrEqual(minimumLabelDarkness);
    expect(darkness).toBeLessThanOrEqual(maximumLabelDarkness);
  }
  expect(visibleReadouts[2].tickHeight).toBeGreaterThan(
    visibleReadouts[1].tickHeight,
  );
  expect(visibleReadouts[1].tickHeight).toBeGreaterThan(
    visibleReadouts[0].tickHeight,
  );
  expect(visibleReadouts[2].tickHeight).toBeGreaterThan(
    visibleReadouts[3].tickHeight,
  );
  expect(visibleReadouts[3].tickHeight).toBeGreaterThan(
    visibleReadouts[4].tickHeight,
  );

  expect(
    await marks.evaluateAll((elements) =>
      elements.every((marker) => {
        const label = marker.querySelector<HTMLElement>(".precision-label");
        const tick = marker.querySelector<HTMLElement>(".precision-tick");
        return (
          marker.getAttribute("style")?.includes("translate3d") === true &&
          marker.style.left === "" &&
          marker.style.height === "" &&
          tick?.style.height === "" &&
          tick?.style.opacity === "" &&
          label?.style.left === "" &&
          label?.style.bottom === "" &&
          label?.style.fontSize === ""
        );
      }),
    ),
  ).toBe(true);
  expect(
    await labels.evaluateAll(
      (elements) =>
        new Set(elements.map((element) => getComputedStyle(element).fontSize))
          .size,
    ),
  ).toBe(1);
  await expect(selectedTick).toHaveCSS("box-shadow", "none");
  const selectedLabel = marks
    .filter({ has: page.locator('.precision-label:text-is("50")') })
    .locator(".precision-label");
  await expect(selectedLabel).toHaveCSS("font-weight", "400");
  await expect(selectedLabel).toHaveCSS("text-shadow", "none");
  expect(
    await selectedTick.evaluate((element) => element.style.backgroundColor),
  ).toBe("var(--slider-accent-color)");
  expect(await selectedLabel.evaluate((element) => element.style.color)).toBe(
    "var(--slider-accent-color)",
  );

  const assertOrderedAndContained = async () => {
    const centers = await ticks.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return box.left + box.width / 2;
      }),
    );
    for (let index = 0; index < centers.length; index += 1) {
      expect(centers[index]).toBeGreaterThanOrEqual(
        markerBounds.start - geometryTolerance,
      );
      expect(centers[index]).toBeLessThanOrEqual(
        markerBounds.end + geometryTolerance,
      );
      if (index > 0) {
        expect(centers[index]).toBeGreaterThanOrEqual(centers[index - 1]);
      }
    }
  };

  const assertEdgeSelectionDominates = async (
    rimIndex: number,
    activeIndex: number,
    interiorIndex: number,
  ) => {
    await expect
      .poll(() =>
        marks.evaluateAll(
          (elements, { indices, idleHeight }) => {
            const [rim, active, interior] = indices.map((index) => {
              const marker = elements[index];
              const tick = marker.querySelector<HTMLElement>(".precision-tick");
              const label =
                marker.querySelector<HTMLElement>(".precision-label");
              return {
                tickHeight: tick?.getBoundingClientRect().height ?? 0,
                labelHeight: label?.getBoundingClientRect().height ?? 0,
              };
            });
            return {
              rimUsesIdleHeight: Math.abs(rim.tickHeight - idleHeight) < 0.1,
              selectedUsesFullHeight: active.tickHeight > 23.5,
              selectedTickDominates: active.tickHeight > rim.tickHeight,
              selectedLabelDominates: active.labelHeight > rim.labelHeight,
              interiorTapers:
                interior.tickHeight > rim.tickHeight &&
                interior.tickHeight < active.tickHeight,
              rimFallsOffFaster: rim.labelHeight < interior.labelHeight,
            };
          },
          {
            indices: [rimIndex, activeIndex, interiorIndex],
            idleHeight: precisionIdleTickHeight,
          },
        ),
      )
      .toEqual({
        rimUsesIdleHeight: true,
        selectedUsesFullHeight: true,
        selectedTickDominates: true,
        selectedLabelDominates: true,
        interiorTapers: true,
        rimFallsOffFaster: true,
      });
  };

  await assertOrderedAndContained();

  for (const nextValue of [8, 50.4, 92]) {
    const snapshot = await setDraggedValue(nextValue);
    assertOrangeAlignment(snapshot.alignment, snapshot.currentValue);
    assertSelectionPresentation(snapshot.presentation);
    await assertOrderedAndContained();
  }
  const centeredSnapshot = await setDraggedValue(50);
  assertOrangeAlignment(
    centeredSnapshot.alignment,
    centeredSnapshot.currentValue,
  );
  assertSelectionPresentation(centeredSnapshot.presentation);

  const nearLeftSnapshot = await setDraggedValue(1);
  assertOrangeAlignment(
    nearLeftSnapshot.alignment,
    nearLeftSnapshot.currentValue,
  );
  assertSelectionPresentation(nearLeftSnapshot.presentation);
  await assertEdgeSelectionDominates(0, 1, 2);
  await assertOrderedAndContained();

  const nearRightSnapshot = await setDraggedValue(99);
  assertOrangeAlignment(
    nearRightSnapshot.alignment,
    nearRightSnapshot.currentValue,
  );
  assertSelectionPresentation(nearRightSnapshot.presentation);
  await assertEdgeSelectionDominates(100, 99, 98);
  await assertOrderedAndContained();

  await page.mouse.move(inputBox!.x + 1, inputBox!.y + inputBox!.height / 2);
  await expect.poll(() => input.inputValue()).toBe("0");
  await waitForLensFrame();
  await assertOrangeAligned();
  await expect.poll(readVisibleLabelTexts).toEqual(["0", "1", "2"]);
  await assertOrderedAndContained();

  await page.mouse.move(
    inputBox!.x + inputBox!.width - 1,
    inputBox!.y + inputBox!.height / 2,
  );
  await expect.poll(() => input.inputValue()).toBe("100");
  await waitForLensFrame();
  await assertOrangeAligned();
  await expect.poll(readVisibleLabelTexts).toEqual(["98", "99", "100"]);
  await assertOrderedAndContained();

  expect(await marks.count()).toBe(initialMarkCount);
  expect(await labels.count()).toBe(initialLabelCount);
  await page.mouse.up();
  await expect(slider).not.toHaveClass(/dragging/);
  await expect.poll(readVisibleLabelTexts).toEqual(["100"]);
  expect((await readOrangeAlignment()).orangeCount).toBe(0);
  await page.mouse.move(
    inputBox!.x + inputBox!.width + 10,
    inputBox!.y + inputBox!.height / 2,
  );
  await expect.poll(readVisibleLabelTexts).toEqual([]);
  await expect
    .poll(() =>
      ticks.evaluateAll((elements) =>
        Math.max(
          ...elements.map((element) => element.getBoundingClientRect().height),
        ),
      ),
    )
    .toBeLessThan(8.5);
  const releasedTickMetrics = await ticks.evaluateAll((elements) => ({
    minimumHeight: Math.min(
      ...elements.map((element) => element.getBoundingClientRect().height),
    ),
    minimumOpacity: Math.min(
      ...elements.map((element) =>
        Number.parseFloat(getComputedStyle(element).opacity),
      ),
    ),
    maximumOpacity: Math.max(
      ...elements.map((element) =>
        Number.parseFloat(getComputedStyle(element).opacity),
      ),
    ),
  }));
  expect(releasedTickMetrics.minimumHeight).toBeGreaterThanOrEqual(
    precisionIdleTickHeight - 0.01,
  );
  expect(releasedTickMetrics.minimumOpacity).toBeGreaterThanOrEqual(
    precisionTickOpacity - 0.001,
  );
  expect(releasedTickMetrics.maximumOpacity).toBeLessThanOrEqual(
    precisionTickOpacity,
  );
  expect(await marks.count()).toBe(initialMarkCount);
  expect(await labels.count()).toBe(initialLabelCount);
  expect(
    await ruler.evaluate((element, initialNodes) => {
      const currentNodes = [
        ...element.querySelectorAll(
          ".precision-mark, .precision-tick, .precision-label",
        ),
      ];
      return (
        currentNodes.length === initialNodes.length &&
        currentNodes.every((node, index) => node === initialNodes[index])
      );
    }, initialPrecisionNodes),
  ).toBe(true);
  await initialPrecisionNodes.dispose();
});
