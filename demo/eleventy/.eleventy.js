const { dir } = require("console");

module.exports = function (eleventyConfig) {

    const eleventyDir = "demo/eleventy";
    eleventyConfig.addPassthroughCopy(`${eleventyDir}/src/demo.css`);
    eleventyConfig.addPassthroughCopy(`${eleventyDir}/src/demo.js`);
    eleventyConfig.addPassthroughCopy(`${eleventyDir}/src/lib/*`);

    return {
        dir: {
            input: `${eleventyDir}/src`,
            output: `${eleventyDir}/_site`,
        },
    };
};