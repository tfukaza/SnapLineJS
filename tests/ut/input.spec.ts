import { expect, test } from "@playwright/test";
import SnapLine from "../../src/index";
import { InputControl, cursorState } from "../../src/input";
import { JSDOM } from "jsdom";
const port = 3001;

function initInputControl() {
  const dom = new JSDOM(
    `<html>
      <body>
        <div id="target" style="width: 100px; height: 100px;"></div>
      </body>
    </html>`,
    { 
      url: `http://localhost:${port}`,
      contentType: "text/html",
    });
  const window = dom.window;
  const document = dom.window.document;
  const target = document.querySelector("#target");
  const inputControl = new InputControl(target, document);
  
  return [inputControl, window, document, target];
}

test.describe("Test mouse input handler", () => {
    test("Mousedown event", async ({ page }) => {

      const [inputControl, window, document, target] = initInputControl();
      // Create a mock event
      const event = new window.MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
        button: 0,

      });
 
      let called: boolean = false;
      inputControl._onCursorDown = (e, callbackTarget, button, x, y) => {
        expect(e).toBeDefined();
        expect(callbackTarget).toBe(target);
        expect(button).toBe(cursorState.mouseLeft);
        expect(x).toBe(100);
        expect(y).toBe(100);
        called = true;
      };

      target.dispatchEvent(event);
      expect(called).toBe(true);

    });

    test("Mousemove event", async ({ page }) => {
      const [inputControl, window, document, target] = initInputControl();
      document.elementFromPoint = () => {
        return target;
      };
      // Create a mock event
      const event = new window.MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
      });

      let called: boolean = false;
      inputControl._onCursorMove = (e, callbackTarget, state, x, y) => {
        called = true;
        expect(e).toBeDefined();
        expect(callbackTarget).toBe(target);
        expect(x).toBe(100);
        expect(y).toBe(100);
      };

      target.dispatchEvent(event);
      expect(called).toBe(true);
    });

    test("Mouseup event", async ({ page }) => {
      const [inputControl, window, document, target] = initInputControl();
      // Create a mock event
      const event = new window.MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
        button: 0,
      });

      let called: boolean = false;
      inputControl._onCursorUp = (e, callbackTarget, button,  x, y) => {
        expect(e).toBeDefined();
        expect(callbackTarget).toBe(target);
        expect(button).toBe(cursorState.mouseLeft);
        expect(x).toBe(100);
        expect(y).toBe(100);
        called = true;
      };

      target.dispatchEvent(event);
      expect(called).toBe(true);
    });

    test(("Mousewheel event"), async ({ page }) => {
      const [inputControl, window, document, target] = initInputControl();
      // Create a mock event
      const event = new window.WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100,
        deltaY: 200,
      });

      let called: boolean = false;
      inputControl._onScroll = (e, callbackTarget, state, clientX, clientY, deltaY) => {
        called = true;
        expect(e).toBeDefined();
        expect(callbackTarget).toBe(target);
        expect(clientX).toBe(100);
        expect(clientY).toBe(100);
        expect(deltaY).toBe(200);
      };

      target.dispatchEvent(event);
      expect(called).toBe(true);
    });
});

type touchEntry = {
  clientX: number;
  clientY: number;
  identifier: number;
}


class MockTouch {
  identifier: number;
  clientX: number;
  clientY: number;
  target: Element;
  constructor(identifier: number, clientX: number, clientY: number, target: Element) {
    this.identifier = identifier;
    this.clientX = clientX;
    this.clientY = clientY;
    this.target = target;
  }
}

class MockTouchList extends Array<MockTouch> {
  constructor(private touches: MockTouch[] = []) {
    super(...touches);
  }
  item(index: number): MockTouch | null {
    return this.touches[index] || null;
  }
}

function initTouchEvent(window: any, eventName: string, target: Element, touches: touchEntry[], changedTouches: touchEntry[] = []) {
  const touchList:MockTouchList = new MockTouchList();
  for (const touch of touches) {
    touchList.push(new MockTouch(touch.identifier, touch.clientX, touch.clientY, target));
  }
  const changedTouchList:MockTouchList = new MockTouchList();
  for (const touch of changedTouches) {
    changedTouchList.push(new MockTouch(touch.identifier, touch.clientX, touch.clientY, target));
  }
  return new window.TouchEvent(eventName, {
    bubbles: true,
    cancelable: true,
    touches: touchList,
    changedTouches: changedTouchList,
  });
}

test.describe("Test touch input handler", () => {
  test("Pressing a single touch point", async ({ page }) => {
    const [inputControl, window, document, target] = initInputControl();
    const event = initTouchEvent(window, "touchstart", target, [], [{
      clientX: 100,
      clientY: 100,
      identifier: 1,
    }]);

    let called: boolean = false;
    inputControl._onCursorDown = (e, callbackTarget, button, x, y) => {
      called = true;
      expect(e).toBeDefined();
      expect(callbackTarget).toBe(target);
      expect(x).toBe(100);
      expect(y).toBe(100);
    };

    target.dispatchEvent(event);
    expect(called).toBe(true);
  });

  test("When two touches are started, the last one should be used", async ({ page }) => {
    page.on('console', msg => console.log(msg.text()));
    const [inputControl, window, document, target] = initInputControl();
    const eventStart = initTouchEvent(window, "touchstart", target, [],  [{
      clientX: 100,
      clientY: 100,
      identifier: 1,
    }, {
      clientX: 200,
      clientY: 200,
      identifier: 2,
    }]);

    let called: boolean = false;
    inputControl._onCursorDown = (e, callbackTarget, button, x, y) => {
      called = true;
      expect(e).toBeDefined();
      expect(callbackTarget).toBe(target);
      expect(button).toBe(cursorState.mouseLeft);
      expect(x).toBe(100);
      expect(y).toBe(100);
    };

    target.dispatchEvent(eventStart);
    expect(called).toBe(true);

  });

  test("Touchmove event with a single touch", async ({ page }) => {
    const [inputControl, window, document, target] = initInputControl();
    const downTouches = [
      {
        clientX: 100,
        clientY: 100,
        identifier: 1,
      }
    ]
    const moveTouches = [
      {
        clientX: 101,
        clientY: 101,
        identifier: 1,
      }
    ]

    const touchStart = initTouchEvent(window, "touchstart", target, downTouches, downTouches);
    const touchMove = initTouchEvent(window, "touchmove", target, moveTouches, []);

    let called: boolean = false;
    inputControl._onCursorMove = (e, callbackTarget, button, x, y) => {
      called = true;
      // Moving a touch point should be treated as dragging a mouse while holding the left button
      expect(e).toBeDefined();
      expect(callbackTarget).toBe(target);
      expect(button).toBe(cursorState.mouseLeft);
      expect(x).toBe(101);
      expect(y).toBe(101);
    };

    target.dispatchEvent(touchStart);
    target.dispatchEvent(touchMove);
    expect(called).toBe(true);
  });

  test("Touchmove event with multiple simultaneous touches", async ({ page }) => {
    const [inputControl, window, document, target] = initInputControl();  
    const downTouches = [
      {
        clientX: 100,
        clientY: 100,
        identifier: 1,
      },
      {
        clientX: 200,
        clientY: 200,
        identifier: 2,
      }
    ];
    const moveTouches = [
      {
        clientX: 101,
        clientY: 101,
        identifier: 1,
      },
      {
        clientX: 201,
        clientY: 201,
        identifier: 2,
      }
    ];
    const eventDown = initTouchEvent(window, "touchstart", target, downTouches, downTouches);
    const eventMove = initTouchEvent(window, "touchmove", target, moveTouches, []);

    let called: boolean = false;
    inputControl._onCursorMove = (e, callbackTarget, button, x, y) => {
      called = true;
      // Moving two touch points should be treated as dragging a mouse while holding the middle button
      expect(e).toBeDefined();
      expect(callbackTarget).toBe(target);
      expect(button).toBe(cursorState.mouseMiddle);
      expect(x).toBe(151);
      expect(y).toBe(151);
    };

    target.dispatchEvent(eventDown);
    target.dispatchEvent(eventMove);
    expect(called).toBe(true);
  });

  test("Touchmove event for pan and pinch zoom", async ({ page }) => {
    const [inputControl, window, document, target] = initInputControl();
    const downTouches = [
      {
        clientX: 0,
        clientY: 100,
        identifier: 1,
      },
      {
        clientX: 0, 
        clientY: -100,
        identifier: 2,
      }
    ];
    const moveTouches_0 = [
      {
        clientX: 0,
        clientY: 100,
        identifier: 1,
      },
      {
        clientX: 0,
        clientY: -100,
        identifier: 2,
      }
    ];
    const moveTouches_1 = [
      {
        clientX: 30,
        clientY: 50,
        identifier: 1,
      },
      {
        clientX: 30,
        clientY: -50,
        identifier: 2,
      }
    ];
   

    const touchStart = initTouchEvent(window, "touchstart", target, downTouches, downTouches);
    const touchMove_0 = initTouchEvent(window, "touchmove", target, moveTouches_0, []);
    const touchMove_1 = initTouchEvent(window, "touchmove", target, moveTouches_1, []);

    
    target.dispatchEvent(touchStart);
    target.dispatchEvent(touchMove_0);
    
    let scrollCalled: boolean = false;
    let moveCalled: boolean = false;
    inputControl._onScroll = (e, callbackTarget, button, clientX, clientY, deltaY) => {
      scrollCalled = true;
      expect(e).toBeDefined();
      expect(callbackTarget).toBe(target);
      expect(clientX).toBe(30);
      expect(clientY).toBe(0);
      expect(deltaY).toBe(-100);
    };
    inputControl._onCursorMove = (e, callbackTarget, button, x, y) => {
      moveCalled = true;
      expect(e).toBeDefined();
      expect(callbackTarget).toBe(target);
      expect(button).toBe(cursorState.mouseMiddle);
      expect(x).toBe(30);
      expect(y).toBe(0);
    };

    target.dispatchEvent(touchMove_1);
    // expect(inputControl._zoom).toBe(0.5);
    expect(scrollCalled).toBe(true);
    expect(moveCalled).toBe(true);
  });


});
