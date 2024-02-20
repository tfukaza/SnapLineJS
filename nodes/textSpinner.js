const textSpinner = {
  functions: {
    visualize: {
      inputs: ['text', 'speed'],
      outputs: ['sum'],
      functionInit: function init(self) {
        self.text = self.dom.querySelector('.spinner-text');

      },
      functionUpdate: function update(self, text, speed) {
        console.log(self)
        self.text.innerText = text;
        self.text.style['animation-duration'] = `${speed}s`;
        return speed;
      }
    }
  },
  elements: [
    { type: 'output-text', name: 'sum' },
    { type: 'input-text', name: 'text' },
    { type: 'input-text', name: 'speed' },
    {
      type: 'custom',
      html: `
        <div class="spinner flex w-full justify-items-center">
          <span class="spinner-text animate-spin text-4xl">Hello</span>
        </div>
    `}
  ]
};


