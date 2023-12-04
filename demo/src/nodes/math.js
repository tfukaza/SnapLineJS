export const math = {
  functions: {
    output: {
      inputs: ["Input 1", "Input 2", "Operation"],
      outputs: ["Result"],
      functionUpdate: (self, a, b, op) => {
        switch (op) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "*":
            return a * b;
          case "/":
            return a / b;
          default:
            return 0;
        }
      },
    },
  },
  elements: [
    { type: "output-text", name: "Result" },
    [
      {
        type: "ui-dropdown",
        name: "Operation",
        values: [
          { value: "+", label: "Add" },
          { value: "-", label: "Subtract" },
          { value: "*", label: "Multiply" },
          { value: "/", label: "Divide" },
        ],
      },
    ],
    [
      {
        type: "input-text",
        name: "Input 1",
      },
    ],
    [
      {
        type: "input-text",
        name: "Input 2",
      },
    ],
  ],
};

export const clamp = {
  functions: {
    output: {
      inputs: ["Min", "Max", "Value"],
      outputs: ["Result"],
      functionUpdate: (self, min, max, val) => {
        return Math.min(Math.max(min, val), max);
      },
    },
  },
  elements: [
    { type: "output-text", name: "Result" },
    {
      type: "input-float-infinite",
      name: "Min",
    },
    {
      type: "input-float-infinite",
      name: "Max",
    },
    {
      type: "input-float-infinite",
      name: "Value",
    },
  ],
};

export const lerp = {
  functions: {
    output: {
      inputs: ["Input 1", "Input 2", "Alpha"],
      outputs: ["Result"],
      functionUpdate: (self, a, b, alpha) => {
        a = parseFloat(a);
        b = parseFloat(b);
        alpha = parseFloat(alpha);
        return a + (b-a) * alpha;
      }
        
    },
  },
  elements: [
    { type: "output-text", name: "Result" },
    {
        type: "input-text",
        name: "Input 1",
    },
    {
        type: "input-text",
        name: "Input 2",
    },
    {
      type: "input-float",
      name: "Alpha",
      min: 0,
      max: 1,
    },
    
  ],
};

export const constantFloat = {
  functions: {
    output: {
      inputs: ["Input 1"],
      outputs: ["Result"],
      functionUpdate: (self, a) => {
        return parseFloat(a);
      }
        
    },
  },
  elements: [
    { type: "output-text", name: "Result" },
    {
        type: "input-float-infinite",
        name: "Input 1",
    },
    
  ],
};

export const displayData = {
  functions: {
    output: {
      inputs: ["Input"],
      outputs: [],
      functionInit: (self, i) => {
        self.display = self.dom.querySelector(".display");
      },
      functionUpdate: (self, i) => {
        self.display.innerText = i;
      }
    },
  },
  elements: [
    { type: "custom",
      name: "Display",
      html: `
      <div class="bg-white w-full">
        Display
      </div>
      `,
    },
    {
      type: "input-text",
      name: "Input",
    },
    { type: "custom",
      name: "Display",
      html: `
      <div class="bg-red rounded-lg">
        <span class="display text-3xl"></span>
      </div>
      `,
    },
  ],
};