export type MaterialSettings = {
  lightAngle: number;
  ambientBrightness: number;
  shadowDistance: number;
  shadowBlur: number;
  shadowStrength: number;
  specularIntensity: number;
  specularPower: number;
  rimWidth: number;
  rimBlur: number;
  creviceBrightness: number;
  shadedRim: boolean;
  creviceOutline: boolean;
};

export type MaterialDepth = "raised" | "recessed";
export type MaterialShape = "rounded" | "circle";

export const defaultDialMaterialSettings: Readonly<MaterialSettings> = {
  lightAngle: 315,
  ambientBrightness: 0,
  shadowDistance: 14,
  shadowBlur: 11.25,
  shadowStrength: 1,
  specularIntensity: 0.34,
  specularPower: 31,
  rimWidth: 1.75,
  rimBlur: 0.7,
  creviceBrightness: 0.41,
  shadedRim: true,
  creviceOutline: true,
};

export const defaultButtonMaterialSettings: Readonly<MaterialSettings> = {
  lightAngle: 325,
  ambientBrightness: 0,
  shadowDistance: 6.5,
  shadowBlur: 6.25,
  shadowStrength: 1,
  specularIntensity: 0.85,
  specularPower: 10,
  rimWidth: 1,
  rimBlur: 0.1,
  creviceBrightness: 0.41,
  shadedRim: true,
  creviceOutline: true,
};

export const defaultToggleMaterialSettings: Readonly<MaterialSettings> = {
  lightAngle: 325,
  ambientBrightness: 0.1,
  shadowDistance: 6,
  shadowBlur: 5,
  shadowStrength: 1,
  specularIntensity: 0.85,
  specularPower: 10,
  rimWidth: 0.75,
  rimBlur: 0.75,
  creviceBrightness: 0,
  shadedRim: true,
  creviceOutline: false,
};

export const defaultSliderMaterialSettings: Readonly<MaterialSettings> = {
  ...defaultToggleMaterialSettings,
  shadowDistance: 3.5,
  shadowBlur: 9,
  rimBlur: 0.5,
};

export const defaultRaisedCardMaterialSettings: Readonly<MaterialSettings> = {
  ...defaultToggleMaterialSettings,
  shadowDistance: 3.75,
  shadowBlur: 5.25,
  rimWidth: 0.5,
  rimBlur: 0.1,
};

export const defaultInsetSlotMaterialSettings: Readonly<MaterialSettings> = {
  ...defaultRaisedCardMaterialSettings,
  ambientBrightness: 0,
  shadowDistance: 2.25,
  shadowBlur: 7.75,
};

// Generic surfaces retain stable aliases, while interactive components use
// their own tuned defaults above.
export const defaultMaterialSettings = defaultRaisedCardMaterialSettings;
export const defaultCreviceFreeMaterialSettings: Readonly<MaterialSettings> = {
  ...defaultRaisedCardMaterialSettings,
  creviceOutline: false,
};

const diffuseAnchors = [0, 45, 90, 135, 180] as const;
const roundedNormals = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const sides = [
  ["top", 0],
  ["right", 90],
  ["bottom", 180],
  ["left", 270],
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function diffuseAtAlignment(alignment: number, settings: Readonly<MaterialSettings>) {
  const wrappedLight = (alignment + 1) / 2;
  const diffuseAmount = wrappedLight * wrappedLight * (3 - 2 * wrappedLight);
  const ambient = clamp(settings.ambientBrightness, 0, 1);
  const brightness = ambient + (1 - ambient) * diffuseAmount;
  return `color-mix(in hsl, var(--material-diffuse-dark) ${((1 - brightness) * 100).toFixed(3)}%, var(--material-diffuse-light) ${(brightness * 100).toFixed(3)}%)`;
}

function shadedAtNormal(
  normal: number,
  settings: Readonly<MaterialSettings>,
  depth: MaterialDepth,
) {
  const effectiveNormal = normal + (depth === "recessed" ? 180 : 0);
  const difference = (effectiveNormal - settings.lightAngle) * Math.PI / 180;
  const alignment = Math.cos(difference);
  const diffuse = diffuseAtAlignment(alignment, settings);
  const specular = clamp(
    Math.pow(Math.max(0, alignment), Math.max(1, settings.specularPower)) *
      settings.specularIntensity,
    0,
    1,
  );

  return specular <= 0.0001
    ? diffuse
    : `color-mix(in hsl, ${diffuse}, var(--material-specular-color) ${(specular * 100).toFixed(3)}%)`;
}

export function createMaterialStyle(
  depth: MaterialDepth,
  settings: Readonly<MaterialSettings>,
) {
  const variables: Record<string, string> = {};
  const effectiveAngle = settings.lightAngle + (depth === "recessed" ? 180 : 0);
  const lightRadians = settings.lightAngle * Math.PI / 180;
  const lightX = Math.sin(lightRadians);
  const lightY = -Math.cos(lightRadians);
  const distance = Math.max(0, settings.shadowDistance);
  const shadowBlur = Math.max(0, settings.shadowBlur);
  const shadows = [
    { name: "far", x: -lightX, y: -lightY, distance },
    { name: "near", x: -lightX, y: -lightY, distance: distance / 2 },
    { name: "light", x: lightX, y: lightY, distance: distance / 2 },
  ] as const;

  variables["--material-light-angle"] = `${effectiveAngle}deg`;
  variables["--material-rim-width"] = `${Math.max(0, settings.rimWidth)}px`;
  variables["--material-rim-half-width"] = `${Math.max(0, settings.rimWidth) / 2}px`;
  variables["--material-rim-blur"] = `${Math.max(0, settings.rimBlur)}px`;
  variables["--material-crevice-color"] =
    `color-mix(in srgb, #000 ${((1 - clamp(settings.creviceBrightness, 0, 1)) * 100).toFixed(3)}%, #fff ${(clamp(settings.creviceBrightness, 0, 1) * 100).toFixed(3)}%)`;
  variables["--material-shadow-far-blur"] = `${shadowBlur}px`;
  variables["--material-shadow-near-blur"] = `${shadowBlur / 2}px`;
  variables["--material-shadow-light-blur"] = `${shadowBlur * 0.8}px`;
  variables["--material-shadow-strength"] = clamp(settings.shadowStrength, 0, 1).toFixed(3);
  variables["--material-rim-visibility"] = settings.shadedRim ? "visible" : "hidden";
  variables["--material-crevice-visibility"] = settings.creviceOutline ? "visible" : "hidden";

  for (const shadow of shadows) {
    variables[`--material-shadow-${shadow.name}-x`] = `${(shadow.x * shadow.distance).toFixed(3)}px`;
    variables[`--material-shadow-${shadow.name}-y`] = `${(shadow.y * shadow.distance).toFixed(3)}px`;
  }

  for (const offset of diffuseAnchors) {
    variables[`--material-diffuse-${offset}`] = diffuseAtAlignment(
      Math.cos(offset * Math.PI / 180),
      settings,
    );
  }

  for (const normal of roundedNormals) {
    variables[`--material-normal-${normal}`] = shadedAtNormal(normal, settings, depth);
  }

  for (const [side, normal] of sides) {
    variables[`--material-side-${side}`] = shadedAtNormal(normal, settings, depth);
  }

  const power = Math.max(1, settings.specularPower);
  const halfWidth = Math.acos(Math.pow(0.5, 1 / power)) * 180 / Math.PI;
  variables["--material-specular-from"] = `${effectiveAngle - halfWidth * 2}deg`;
  variables["--material-specular-stop-1"] = `${halfWidth}deg`;
  variables["--material-specular-stop-2"] = `${halfWidth * 2}deg`;
  variables["--material-specular-stop-3"] = `${halfWidth * 3}deg`;
  variables["--material-specular-stop-4"] = `${halfWidth * 4}deg`;
  variables["--material-specular-shoulder"] =
    `hsl(from var(--material-specular-color) h s l / ${clamp(settings.specularIntensity * 0.25, 0, 1).toFixed(3)})`;
  variables["--material-specular-peak"] =
    `hsl(from var(--material-specular-color) h s l / ${clamp(settings.specularIntensity, 0, 1).toFixed(3)})`;

  return Object.entries(variables)
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
}
