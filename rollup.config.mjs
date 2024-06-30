import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import typescript from '@rollup/plugin-typescript';

const dev = (process.env.BUILD_ENV !== 'production');
const devFramework = process.env.FRAMEWORK_ENV;


let outputFile;
if (dev) {
  if (devFramework === 'vanilla') {
    outputFile = 'vanilla/lib/snapline.js';
  } else if (devFramework === 'react') {
    outputFile = 'react/src/lib/snapline.js';
  } else {
    throw new Error('Invalid FRAMEWORK_ENV');
  }
} else {
  outputFile = 'snapline.js';
}

const outputDir = dev ? 'demo' : 'dist';
outputFile = `${outputDir}/${outputFile}`;

export default {
  input: 'src/main.ts',
  output: {
    file: outputFile,
    name: "SnapLine",
    format: 'es',
    sourcemap: dev,
  },
  watch: {
    include: ['src/**', 'demo/react/**'],
  },
  plugins: [
    postcss({
      include: 'src/theme/standard_light.scss',
      extract: "standard_light.css",
      minimize: !dev,
    }),
    postcss({
      include: 'src/theme/standard_dark.scss',
      extract: "standard_dark.css",
      minimize: !dev,
    }),
    postcss({
      include: 'src/theme/retro.scss',
      extract: "retro.css",
      minimize: !dev,
    }),
    typescript(
      {
        tsconfig: 'tsconfig.json',
        sourceMap: dev,
        inlineSources: dev,
      }
    ),
    !dev && terser(
      {
        compress: {
          drop_console: true,
          booleans_as_integers: true,
        }
      }
    ),
  ],
};