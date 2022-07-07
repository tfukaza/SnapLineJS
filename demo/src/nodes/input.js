import iro from '@jaames/iro';

export const colorPicker = {
  functions: {
    output: {
      inputs: [],
      outputs: ["Hex String", "R", "G", "B"],
      functionInit: (self) => {
        self.iro = new iro.ColorPicker('#picker', {});
        self.iro.on('input:start', (_)=>{
          self.freeze = true;
        });
        self.iro.on('color:change', (_)=>{
          self.run();
        });
        self.iro.on('input:end', (_)=>{
          self.freeze = false;
        });
      },
      functionUpdate: (self) => {
        return [self.iro.color.hexString, self.iro.color.red, self.iro.color.green, self.iro.color.blue];
      }
        
    },
  },
  elements: [
    { type: "output-text", name: "Hex String" },
    { type: "output-text", name: "R" },
    { type: "output-text", name: "G" },
    { type: "output-text", name: "B" },
    { type: "custom",
      name: "RGB",
      html: `
      <div class="relative">
      <div class=" relative z-20" id="picker"></div>
      <div class="pointer-events-none absolute top-0 left-0 h-full w-full z-10"></div>
      <p class="text-sm text-gray-400">Powered by iro.js</p>
      </div>
      `,
    },
  ],
};