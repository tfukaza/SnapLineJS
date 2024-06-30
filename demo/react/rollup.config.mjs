import sucrase from '@rollup/plugin-sucrase';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'
import postcss from 'rollup-plugin-postcss'
import copy from 'rollup-plugin-copy-watch';


export default {
  onwarn(warning, warn) {
    if (warning.code === 'THIS_IS_UNDEFINED') return;
    warn(warning);
  },
  input: 'demo/react/src/index.jsx',
  output: {
    file: 'demo/react/dist/index.js',
    format: 'cjs',
  },
  watch: {
    include: ['demo/react/src/**'],
  },
  plugins: [
    replace({
      'process.env.NODE_ENV': JSON.stringify('development'),
      preventAssignment: true,
    }),
    postcss({
      extract: false,
      minimize: true,
      sourceMap: 'inline',
    }),
    resolve({
      extensions: ['.js', '.jsx'],
    }),
    sucrase({
      exclude: ['node_modules/**'],
      transforms: ['jsx'],
    }),
    commonjs(),
    copy({
      targets: [
        { src: 'src/lib/standard_light.css', dest: 'dist/lib' },
        { src: 'src/lib/standard_dark.css', dest: 'dist/lib' },
        { src: 'src/lib/retro.css', dest: 'dist/lib' },
      ],
    }),
    serve({
      open: true,
      contentBase: 'demo/react/dist',
      host: 'localhost',
      port: 5000,
    }),
    livereload({
      watch: 'demo/react/dist',
    }),
  ],
};