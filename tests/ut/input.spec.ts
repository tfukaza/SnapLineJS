import { expect, test } from "@playwright/test";
import SnapLine from "../../src/index";
import { InputControl } from "../../src/input";

const port = 3001;


test.describe("Test input handler", () => {
    test("Mousedown event should be handled correctly", async () => {
      const inputControl = new InputControl(document.createElement("div"));
      inputControl._onCursorDown = (e, target, button, x, y) => {
        expect(e).toBeDefined();
        expect(target).toBeDefined();
        expect(button).toBeDefined();
        expect(x).toBeDefined();
        expect(y).toBeDefined();
      };

      const event = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
      });

      inputControl.onMouseDown(event);
      
    });
});