

const dev = (process.env.BUILD_ENV === 'dev');


export default {
  input: 'out-tsc/main.js',
  output: {
    file: dev ? 'demo/lib/snapline.js' : 'dist/snapline.js',
    format: 'iife',
    name: "SnapLine",
    sourcemap: dev,
  },
  watch: {
    include: 'out-tsc/**/*',
  },
};