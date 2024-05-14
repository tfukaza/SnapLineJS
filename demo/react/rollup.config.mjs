import sucrase from '@rollup/plugin-sucrase';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'
import postcss from 'rollup-plugin-postcss'


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
    serve({
      open: true,
      contentBase: 'demo/react/dist',
      host: 'localhost',
      port: 5000,
    }),
    livereload({
      watch: 'demo/react/src',
    }),
  ],
};