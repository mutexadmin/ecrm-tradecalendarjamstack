const core = require('./.core-eleventy.js');
const app = require('./.app-eleventy.js');
const eleventyNavigationPlugin = require('@11ty/eleventy-navigation');

module.exports = function (eleventyConfig) {
  core.configFunc(eleventyConfig);
  app.configFunc(eleventyConfig);
  eleventyConfig.addPlugin(eleventyNavigationPlugin);

  // Return your Object options:
  return { ...core.configObj, ...app.configObj };
};
