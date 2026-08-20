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

export const defaultMaterialSettings: Readonly<MaterialSettings> = {
  lightAngle: 325,
  ambientBrightness: 0.1,
  shadowDistance: 6,
  shadowBlur: 5,
  shadowStrength: 1,
  specularIntensity: 0.85,
  specularPower: 10,
  rimWidth: 2,
  rimBlur: 0.75,
  creviceBrightness: 0,
  shadedRim: true,
  creviceOutline: true,
};

export const defaultCreviceFreeMaterialSettings: Readonly<MaterialSettings> = {
  ...defaultMaterialSettings,
  creviceOutline: false,
};
