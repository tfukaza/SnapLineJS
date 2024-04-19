import terser from '@rollup/plugin-terser';

const dev = (process.env.BUILD_ENV === 'dev');


export default {
  input: 'out-tsc/main.js',
  output: {
    file: dev ? 'demo/lib/snapline.js' : 'dist/snapline.js',
    name: "SnapLine",
    format: 'module',
    sourcemap: dev,
    plugins: [
      !dev && terser(),
    ],
  },
  watch: {
    include: 'out-tsc/**/*',
  },
};