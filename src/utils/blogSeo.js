const cheerio = require('cheerio');
const slugify = require('slugify');

const BLOG_BASE_URL = process.env.BLOG_BASE_URL || 'https://easytorent.com/blog';
const SITE_NAME = 'EasyToRent';
const SITE_DESCRIPTION = 'Find the best PG accommodations near your college';

/**
 * Generate a URL-friendly slug from a title string
 * @param {string} title - Blog title
 * @returns {string} URL-friendly slug
 */
function generateSlug(title) {
  return slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });
}

/**
 * Calculate reading time from HTML content
 * @param {string} html - Blog content in HTML format
 * @param {number} wpm - Words per minute (default: 200)
 * @returns {number} Reading time in minutes
 */
function calculateReadingTime(html, wpm = 200) {
  const $ = cheerio.load(html);
  const text = $.text();
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / wpm));
  return minutes;
}

/**
 * Count words in HTML content
 * @param {string} html - Blog content in HTML format
 * @returns {number} Word count
 */
function countWords(html) {
  const $ = cheerio.load(html);
  const text = $.text();
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Generate Table of Contents from HTML content
 * Parses h2, h3, h4 tags and returns structured TOC
 * @param {string} html - Blog content in HTML format
 * @returns {Array<{id: string, text: string, level: number}>}
 */
function generateTableOfContents(html) {
  const $ = cheerio.load(html);
  const toc = [];
  const usedIds = new Set();

  $('h2, h3, h4').each((_, element) => {
    const $el = $(element);
    const text = $el.text().trim();
    const tagName = element.tagName.toLowerCase();
    const level = parseInt(tagName.charAt(1));

    if (!text) return;

    // Generate unique ID from text
    let id = slugify(text, { lower: true, strict: true });
    if (usedIds.has(id)) {
      let counter = 1;
      while (usedIds.has(`${id}-${counter}`)) counter++;
      id = `${id}-${counter}`;
    }
    usedIds.add(id);

    // Add ID to the heading element
    $el.attr('id', id);

    toc.push({
      id,
      text,
      level,
    });
  });

  return {
    toc,
    updatedHtml: $.html(),
  };
}

/**
 * Generate canonical URL for a blog post
 * @param {string} slug - Blog slug
 * @returns {string} Full canonical URL
 */
function generateCanonicalUrl(slug) {
  return `${BLOG_BASE_URL}/${slug}`;
}

/**
 * Generate JSON-LD Breadcrumb schema
 * @param {object} category - Blog category object {name, slug}
 * @param {string} title - Blog title
 * @returns {object} BreadcrumbList schema
 */
function generateBreadcrumbSchema(category, title) {
  const itemListElement = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://easytorent.com',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Blog',
      item: 'https://easytorent.com/blog',
    },
  ];

  if (category) {
    itemListElement.push({
      '@type': 'ListItem',
      position: 3,
      name: category.name,
      item: `https://easytorent.com/blog/category/${category.slug}`,
    });
    itemListElement.push({
      '@type': 'ListItem',
      position: 4,
      name: title,
      item: generateCanonicalUrl(''),
    });
  } else {
    itemListElement.push({
      '@type': 'ListItem',
      position: 3,
      name: title,
      item: generateCanonicalUrl(''),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  };
}

/**
 * Generate JSON-LD Article schema
 * @param {object} blog - Blog document
 * @param {object} author - Author object {name, url?}
 * @returns {object} Article schema
 */
function generateArticleSchema(blog, author) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: blog.seoTitle || blog.title,
    description: blog.metaDescription || blog.shortDescription,
    image: blog.featuredImage || blog.openGraphImage,
    author: {
      '@type': 'Person',
      name: author?.name || 'EasyToRent Team',
    },
    publisher: {
      '@type': 'Organization',
      name: 'EasyToRent',
      logo: {
        '@type': 'ImageObject',
        url: 'https://easytorent.com/logo.png',
      },
    },
    datePublished: blog.publishedAt || blog.publishDate || blog.createdAt,
    dateModified: blog.updatedAt || blog.createdAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': generateCanonicalUrl(blog.slug),
    },
    wordCount: blog.wordCount || countWords(blog.content),
    timeRequired: blog.readingTime ? `PT${blog.readingTime}M` : undefined,
  };

  return schema;
}

/**
 * Generate JSON-LD FAQ schema from FAQ content in blog
 * @param {Array<{question: string, answer: string}>} faqs - FAQ entries
 * @returns {object|null} FAQPage schema or null
 */
function generateFaqSchema(faqs) {
  if (!faqs || faqs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate Open Graph meta tags object
 * @param {object} blog - Blog document
 * @returns {object} OG tags key-value pairs
 */
function generateOpenGraphTags(blog) {
  const image = blog.openGraphImage || blog.featuredImage || '';
  const title = blog.seoTitle || blog.title;
  const description = blog.metaDescription || blog.shortDescription;

  return {
    'og:title': title,
    'og:description': description,
    'og:image': image,
    'og:url': generateCanonicalUrl(blog.slug),
    'og:type': 'article',
    'og:site_name': SITE_NAME,
    'og:locale': 'en_IN',
    'article:published_time': blog.publishedAt || blog.publishDate || blog.createdAt,
    'article:modified_time': blog.updatedAt || blog.createdAt,
    'article:author': blog.authorRef?.name || 'EasyToRent Team',
  };
}

/**
 * Generate Twitter Card meta tags object
 * @param {object} blog - Blog document
 * @returns {object} Twitter card tags key-value pairs
 */
function generateTwitterCard(blog) {
  const image = blog.twitterImage || blog.openGraphImage || blog.featuredImage || '';
  const title = blog.seoTitle || blog.title;
  const description = blog.metaDescription || blog.shortDescription;

  return {
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': image,
    'twitter:site': '@easytorent',
    'twitter:creator': '@easytorent',
  };
}

/**
 * Generate XML sitemap entry for a blog post
 * @param {object} blog - Blog document
 * @returns {string} XML <url> entry
 */
function generateSitemapEntry(blog) {
  const lastmod = blog.updatedAt || blog.publishedAt || new Date();
  const priority = blog.featured ? '0.9' : '0.7';
  const changefreq = blog.status === 'published' ? 'weekly' : 'never';

  return `  <url>
    <loc>${generateCanonicalUrl(blog.slug)}</loc>
    <lastmod>${new Date(lastmod).toISOString()}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/**
 * Calculate SEO score (0-100) based on various factors
 * @param {object} blog - Blog document
 * @returns {{ score: number, issues: Array<{field: string, issue: string, severity: string, suggestion: string}> }}
 */
function calculateSeoScore(blog) {
  let score = 0;
  const issues = [];
  const title = blog.seoTitle || blog.title || '';
  const description = blog.metaDescription || '';
  const content = blog.content || '';
  const focusKeyword = blog.focusKeyword || '';

  // 1. Title length check (40-60 chars) → 15pts
  if (title.length >= 40 && title.length <= 60) {
    score += 15;
  } else if (title.length >= 30 && title.length <= 70) {
    score += 10;
  } else if (title.length > 0) {
    score += 5;
    issues.push({
      field: 'seoTitle',
      issue: title.length < 40 ? 'Title too short (min 40 chars)' : 'Title too long (max 60 chars)',
      severity: title.length < 30 || title.length > 70 ? 'error' : 'warning',
      suggestion: title.length < 40
        ? `Add ${40 - title.length} more characters to the title`
        : `Remove ${title.length - 60} characters from the title`,
    });
  } else {
    issues.push({
      field: 'seoTitle',
      issue: 'Missing SEO title',
      severity: 'error',
      suggestion: 'Add an SEO title between 40-60 characters',
    });
  }

  // 2. Meta description length (120-160 chars) → 15pts
  if (description.length >= 120 && description.length <= 160) {
    score += 15;
  } else if (description.length >= 100 && description.length <= 180) {
    score += 10;
  } else if (description.length > 0) {
    score += 5;
    issues.push({
      field: 'metaDescription',
      issue: description.length < 100 ? 'Meta description too short (min 120 chars)' : 'Meta description too long (max 160 chars)',
      severity: description.length < 80 || description.length > 200 ? 'error' : 'warning',
      suggestion: description.length < 100
        ? `Add ${120 - description.length} more characters to the meta description`
        : `Remove ${description.length - 160} characters from the meta description`,
    });
  } else {
    issues.push({
      field: 'metaDescription',
      issue: 'Missing meta description',
      severity: 'error',
      suggestion: 'Add a meta description between 120-160 characters',
    });
  }

  // 3. Focus keyword in title → 10pts
  if (focusKeyword && title.toLowerCase().includes(focusKeyword.toLowerCase())) {
    score += 10;
  } else if (focusKeyword) {
    issues.push({
      field: 'focusKeyword',
      issue: 'Focus keyword not found in SEO title',
      severity: 'warning',
      suggestion: `Add "${focusKeyword}" to the SEO title`,
    });
  } else {
    issues.push({
      field: 'focusKeyword',
      issue: 'No focus keyword set',
      severity: 'warning',
      suggestion: 'Set a focus keyword to improve search ranking',
    });
  }

  // 4. Focus keyword in first 100 words of content → 10pts
  if (focusKeyword && content) {
    const $ = cheerio.load(content);
    const text = $.text().trim().split(/\s+/).filter(Boolean);
    const first100 = text.slice(0, 100).join(' ');
    if (first100.toLowerCase().includes(focusKeyword.toLowerCase())) {
      score += 10;
    } else {
      issues.push({
        field: 'content',
        issue: 'Focus keyword not found in first 100 words',
        severity: 'warning',
        suggestion: `Include "${focusKeyword}" within the first 100 words`,
      });
    }
  }

  // 5. Image alt texts → 10pts
  if (content) {
    const $ = cheerio.load(content);
    const images = $('img');
    const imagesWithAlt = images.filter((_, el) => $(el).attr('alt') && $(el).attr('alt').trim().length > 0);

    if (images.length === 0) {
      score += 5; // No images = partial points
    } else {
      const altRatio = imagesWithAlt.length / images.length;
      if (altRatio >= 0.8) {
        score += 10;
      } else if (altRatio >= 0.5) {
        score += 5;
        issues.push({
          field: 'content',
          issue: `${images.length - imagesWithAlt.length} image(s) missing alt text`,
          severity: 'warning',
          suggestion: 'Add descriptive alt text to all images',
        });
      } else {
        issues.push({
          field: 'content',
          issue: `${images.length - imagesWithAlt.length} image(s) missing alt text`,
          severity: 'error',
          suggestion: 'Add descriptive alt text to all images',
        });
      }
    }
  }

  // 6. Internal links → 10pts
  if (content) {
    const $ = cheerio.load(content);
    const internalLinks = $('a[href*="easytorent.com"], a[href^="/"]');
    if (internalLinks.length >= 2) {
      score += 10;
    } else if (internalLinks.length === 1) {
      score += 5;
      issues.push({
        field: 'content',
        issue: 'Only 1 internal link found',
        severity: 'info',
        suggestion: 'Add at least 1 more internal link to other blog posts or pages',
      });
    } else {
      issues.push({
        field: 'content',
        issue: 'No internal links found',
        severity: 'warning',
        suggestion: 'Add internal links to other relevant blog posts or pages',
      });
    }
  }

  // 7. External links → 5pts
  if (content) {
    const $ = cheerio.load(content);
    const externalLinks = $('a[href^="http"]').filter((_, el) => {
      const href = $(el).attr('href') || '';
      return !href.includes('easytorent.com') && !href.startsWith('/');
    });
    if (externalLinks.length >= 1) {
      score += 5;
    } else {
      issues.push({
        field: 'content',
        issue: 'No external links found',
        severity: 'info',
        suggestion: 'Add external links to authoritative sources',
      });
    }
  }

  // 8. Reading time > 3 min → 5pts
  if ((blog.readingTime || 0) >= 3) {
    score += 5;
  } else {
    issues.push({
      field: 'content',
      issue: 'Content is too short (reading time < 3 min)',
      severity: 'info',
      suggestion: 'Aim for at least 600 words for better engagement',
    });
  }

  // 9. Heading hierarchy → 5pts
  if (content) {
    const $ = cheerio.load(content);
    const h2Count = $('h2').length;
    const h3Count = $('h3').length;
    if (h2Count >= 1) {
      score += 3;
      if (h3Count >= 1) {
        score += 2;
      } else {
        issues.push({
          field: 'content',
          issue: 'No H3 subheadings found',
          severity: 'info',
          suggestion: 'Use H3 subheadings under H2 sections for better structure',
        });
      }
    } else {
      issues.push({
        field: 'content',
        issue: 'No H2 headings found',
        severity: 'warning',
        suggestion: 'Use H2 headings to structure your content',
      });
    }
  }

  // 10. Canonical URL → 5pts
  if (blog.canonicalUrl) {
    score += 5;
  } else {
    issues.push({
      field: 'canonicalUrl',
      issue: 'Missing canonical URL',
      severity: 'info',
      suggestion: 'Set a canonical URL to prevent duplicate content issues',
    });
  }

  // 11. Schema markup → 5pts
  if (blog.schemaMarkup) {
    score += 5;
  } else {
    issues.push({
      field: 'schemaMarkup',
      issue: 'Missing schema markup',
      severity: 'info',
      suggestion: 'Add JSON-LD schema markup for rich search results',
    });
  }

  // 12. OG image → 5pts
  if (blog.openGraphImage || blog.featuredImage) {
    score += 5;
  } else {
    issues.push({
      field: 'openGraphImage',
      issue: 'Missing Open Graph image',
      severity: 'info',
      suggestion: 'Add an Open Graph image for better social media previews',
    });
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    issues,
  };
}

/**
 * Generate internal linking suggestions based on content keywords
 * @param {string} content - Blog content
 * @param {Array} allBlogs - Array of {title, slug, shortDescription}
 * @returns {Array<{text: string, url: string, relevance: number}>}
 */
function suggestInternalLinks(content, allBlogs) {
  if (!content || !allBlogs || allBlogs.length === 0) return [];

  const $ = cheerio.load(content);
  const text = $.text().toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words);

  const suggestions = [];

  for (const blog of allBlogs) {
    if (!blog.title) continue;

    const blogWords = blog.title.toLowerCase().split(/\s+/).filter(Boolean);
    let matchCount = 0;

    for (const word of blogWords) {
      if (word.length > 3 && uniqueWords.has(word)) {
        matchCount++;
      }
    }

    if (matchCount >= 2) {
      const relevance = Math.min(100, Math.round((matchCount / blogWords.length) * 100));
      suggestions.push({
        text: blog.title,
        url: `/blog/${blog.slug}`,
        relevance,
      });
    }
  }

  return suggestions
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5);
}

/**
 * Optimize image metadata
 * @param {object} file - Uploaded file object
 * @returns {object} Optimized metadata
 */
function optimizeImageMetadata(file) {
  return {
    filename: file.originalname
      ? slugify(file.originalname.replace(/\.[^/.]+$/, ''), { lower: true, strict: true })
      : `image-${Date.now()}`,
    originalName: file.originalname || 'unnamed',
    mimeType: file.mimetype || 'image/jpeg',
    size: file.size || 0,
    alt: file.originalname
      ? file.originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim()
      : '',
  };
}

/**
 * Extract FAQ items from blog content
 * Looks for FAQ sections with structured question/answer patterns
 * @param {string} html - Blog content
 * @returns {Array<{question: string, answer: string}>}
 */
function extractFaqs(html) {
  if (!html) return [];

  const $ = cheerio.load(html);
  const faqs = [];

  // Look for FAQ patterns: h3/h4 followed by paragraph
  $('h3, h4').each((_, el) => {
    const question = $(el).text().trim();
    if (
      !question ||
      !(
        question.toLowerCase().includes('?') ||
        question.toLowerCase().startsWith('what') ||
        question.toLowerCase().startsWith('how') ||
        question.toLowerCase().startsWith('why') ||
        question.toLowerCase().startsWith('can') ||
        question.toLowerCase().startsWith('is') ||
        question.toLowerCase().startsWith('do')
      )
    ) {
      return;
    }

    let answer = '';
    let next = $(el).next();
    while (next.length && !next.is('h2, h3, h4')) {
      if (next.is('p, ul, ol')) {
        answer += next.text().trim() + ' ';
      }
      next = next.next();
    }

    if (answer.trim().length > 10) {
      faqs.push({
        question,
        answer: answer.trim(),
      });
    }
  });

  return faqs;
}

module.exports = {
  generateSlug,
  calculateReadingTime,
  countWords,
  generateTableOfContents,
  generateCanonicalUrl,
  generateBreadcrumbSchema,
  generateArticleSchema,
  generateFaqSchema,
  generateOpenGraphTags,
  generateTwitterCard,
  generateSitemapEntry,
  calculateSeoScore,
  suggestInternalLinks,
  optimizeImageMetadata,
  extractFaqs,
};

