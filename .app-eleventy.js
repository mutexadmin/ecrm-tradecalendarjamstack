appConfigFunc = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    'src/assets': 'international-trade-events-calendar/assets',
  });

  eleventyConfig.addFilter('display_date_en', (date) => {
    date = new Date(date);
    return Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  });

  eleventyConfig.addFilter('display_date_fr', (date) => {
    date = new Date(date);
    return Intl.DateTimeFormat('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  });

  /*eleventyConfig.addFilter('truncateOnFirstPeriod', (content) => {
    return content.split(". ")[0] + ". ...";
  });*/

  /*eleventyConfig.addFilter('truncateOnFirstPeriod', (content) => {
    const firstSentenceMatch = content.match(/[^.!?]+[.!?]/);
    const firstSentence = firstSentenceMatch ? firstSentenceMatch[0].trim() : content;
    const isTruncated = content.length > firstSentence.length;
    return firstSentence + (isTruncated ? '...' : '');
  });*/

  eleventyConfig.addFilter('truncateOnFirstPeriod', (content) => {
    const normalizedContent = content.replace(/\s{2,}/g, ' ').trim(); // Replace multiple spaces with single space

    if (normalizedContent.length <= 360) {
      return normalizedContent;
    }

    const sentences = normalizedContent.match(/[^.!?]+[.!?]*/g);
    let truncated = '';
    let i = 0;

    while (i < sentences.length && (truncated.length + sentences[i].length + 1) <= 360) {
      if ((truncated.length + sentences[i].length + 1) >= 330) {
        truncated += (truncated.length > 0 ? ' ' : '') + sentences[i].trim();
        break;
      }
      truncated += (truncated.length > 0 ? ' ' : '') + sentences[i].trim();
      i++;
    }

    // If no sentence ending was found within the 330-360 character range, truncate at 360 characters
    if (truncated.length < 330) {
      truncated = normalizedContent.substring(0, 360);
      let lastSpace = truncated.lastIndexOf(" ");
      if (lastSpace > 330) { // Only truncate at the last space if it's after the 330 character limit
        truncated = truncated.substring(0, lastSpace);
      }
    }

    // Add ellipsis if the content has been truncated
    if (truncated.length < normalizedContent.length) {
      truncated += '...';
    }

    return truncated;
  });





};

appConfigObj = {
  dir: {
    input: 'src',
    output: 'dist',
  },
};

module.exports = {
  configFunc: appConfigFunc,
  configObj: appConfigObj,
};
