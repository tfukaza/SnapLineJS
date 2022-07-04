

const dev = (process.env.BUILD_ENV !== 'production');
const deploy = (process.env.BUILD_ENV === 'deploy');


export default {
    input: 'out-tsc/main.js',
    output: {
      file: dev ? 'demo/src/lib/snapline.js' : 'dist/snapline.js',
      format: deploy ? 'module':'iife',
      name: "SnapLine",
      sourcemap: dev,
    },
    watch: {
        include: 'out-tsc/**/*',
    },
    // plugins: [
    //   scss({
    //     include: ["src/theme/*.scss"],
    //     output: 'dist/theme'
    //   }),
    // ]
  };