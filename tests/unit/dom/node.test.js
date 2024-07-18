SnapLine = require("../../../dist/snapline.umd");

const testNodeHTML = `
    <div class="sl-node" sl-init="initMath">
      <div class="sl-row right">
        <span class="sl-label right">Result</span>
        <span class="sl-connector right" id="result"></span>
      </div>
      <div class="sl-row">
        <select class="sl-input" sl-name="operation" id="operation">
          <option value="+">Add</option>
          <option value="-">Subtract</option>
          <option value="*">Multiply</option>
          <option value="/">Divide</option>
        </select>
      </div>
      <div class="sl-row">
        <span class="sl-connector left" id="input_1"></span>
        <span class="sl-label">Input 1</span>
        <input class="sl-input" type="number" value="0" id="form_1" />
      </div>
      <div class="sl-row">
        <span class="sl-connector left" id="input_2"></span>
        <span class="sl-label">Input 2</span>
        <input class="sl-input" type="number" value="0" id="form_2" />
      </div>
    </div>
`.trim();

const mockContainer = `
     <main>
      <div id="sl-canvas-container">
        <div id="sl-canvas">
          <div id="sl-background"></div>
        </div>
        <div id="sl-selection"></div>
      </div>
    </main>
`.trim();

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe("Check that the demo site loads the expected nodes after startup.", () => {
  let sl = null;

  beforeEach(() => {
    document.getElementsByTagName("html")[0].innerHTML = mockContainer;
    sl = new SnapLine();
    sl.initSnapLine(
      document.getElementById("sl-canvas-container"),
      document.getElementById("sl-canvas"),
      document.getElementById("sl-background"),
      document.getElementById("sl-selection"),
    );
  });

  afterEach(() => {
    document.getElementsByTagName("html")[0].innerHTML = "";
  });

  it("should be able to initialize the sample node", async () => {
    let mockNode = document.createElement("div");
    mockNode.innerHTML = testNodeHTML;
    mockNode = mockNode.firstChild;

    let node = sl.createNode();
    node.initNode(mockNode);
    // The div should have data-snapline-type = "node"
    expect(mockNode.getAttribute("data-snapline-type")).toBe("node");
  });

  it("should initialize the DOM for connectors", async () => {
    let mockNode = document.createElement("div");
    mockNode.innerHTML = testNodeHTML;
    mockNode = mockNode.firstChild;

    let node = sl.createNode();
    node.initNode(mockNode);

    let connectors = mockNode.querySelectorAll(".sl-connector");
    expect(connectors.length).toBe(3);
    for (let i = 0; i < connectors.length; i++) {
      expect(connectors[i].getAttribute("data-snapline-type")).toBe(
        "connector",
      );
    }
  });
});
