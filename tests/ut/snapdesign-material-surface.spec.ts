import { expect, test } from "@playwright/test";
import {
  createMaterialStyle,
  defaultMaterialSettings,
} from "../../website/src/lib/components/materialSurface";

test("serializes material lighting without a browser", () => {
  const raisedStyle = createMaterialStyle("raised", defaultMaterialSettings);
  const recessedStyle = createMaterialStyle(
    "recessed",
    defaultMaterialSettings,
  );

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
