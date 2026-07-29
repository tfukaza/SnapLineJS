import { expect, test } from "@playwright/test";
import { mergeDefined } from "../../src";

test("mergeDefined preserves defaults for undefined overrides", () => {
  const defaults = {
    enabled: true,
    count: 10,
    label: "default",
  };

  expect(
    mergeDefined(defaults, {
      enabled: undefined,
      count: 0,
      label: "",
    }),
  ).toEqual({
    enabled: true,
    count: 0,
    label: "",
  });
});

test("mergeDefined does not mutate the defaults object", () => {
  const defaults = { enabled: true };
  const merged = mergeDefined(defaults, { enabled: false });

  expect(merged).not.toBe(defaults);
  expect(defaults).toEqual({ enabled: true });
  expect(merged).toEqual({ enabled: false });
});
