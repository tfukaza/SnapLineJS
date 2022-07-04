export const youtube = {
  functions: {
    visualize: {
      inputs: ['Video ID', 'Show Controls'],
      outputs: [],
      functionInit: (self) => {
        self.yt = self.dom.querySelector('.yt');

      },
      functionUpdate: (self, url, controls) => {
        if (!url) url = "m4-HM_sCvtQ";
        self.yt.src = `https://www.youtube.com/embed/` + url + `?autoplay=1&controls=` + (controls ? '1' : '0');
      }
    }
  },
  elements: [
    { type: 'input-text', name: 'Video ID' },
    { type: 'input-bool', name: 'Show Controls' },
    {
      type: 'custom',
      html: `
        <iframe class="yt rounded-lg" width="560" height="315" src="https://www.youtube.com/embed/m4-HM_sCvtQ?autoplay=1&controls=0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      `}
  ]
};




