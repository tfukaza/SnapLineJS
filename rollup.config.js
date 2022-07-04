

const dev = (process.env.BUILD_ENV !== 'production');


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
    // plugins: [
    //   scss({
    //     include: ["src/theme/*.scss"],
    //     output: 'dist/theme'
    //   }),
    // ]
  };