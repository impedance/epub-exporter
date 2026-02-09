// @ts-check
// AICODE-LINK: ../docs/decisions/ADR-0002-pocketbook-xhtml-contract.md

const WIDGET_TAGS = [
  'input',
  'button',
  'select',
  'option',
  'textarea',
  'label',
  'fieldset',
  'form',
  'details',
  'summary',
  'dialog',
  'output',
  'datalist',
  'optgroup',
  'menu'
];

const WIDGET_INLINE_TAGS = ['label', 'button', 'option', 'summary', 'legend', 'output', 'optgroup'];
const WIDGET_BLOCK_TAGS = ['form', 'fieldset', 'details', 'dialog', 'select', 'textarea', 'datalist', 'menu'];

// HTML named entity to XML numeric entity mapping
// Keep XML predefined entities unchanged: &amp; &lt; &gt; &quot; &apos;
const NAMED_ENTITY_MAP = {
  'nbsp': '&#160;',
  'copy': '&#169;',
  'reg': '&#174;',
  'trade': '&#8482;',
  'hellip': '&#8230;',
  'mdash': '&#8212;',
  'ndash': '&#8211;',
  'laquo': '&#171;',
  'raquo': '&#187;',
  'lsquo': '&#8216;',
  'rsquo': '&#8217;',
  'ldquo': '&#8220;',
  'rdquo': '&#8221;',
  'bull': '&#8226;',
  'middot': '&#183;',
  'deg': '&#176;',
  'plusmn': '&#177;',
  'times': '&#215;',
  'divide': '&#247;',
  'frac12': '&#189;',
  'frac14': '&#188;',
  'frac34': '&#190;',
  'euro': '&#8364;',
  'pound': '&#163;',
  'yen': '&#165;',
  'cent': '&#162;',
  'sect': '&#167;',
  'para': '&#182;',
  'dagger': '&#8224;',
  'Dagger': '&#8225;',
  'permil': '&#8240;',
  'prime': '&#8242;',
  'Prime': '&#8243;',
  'larr': '&#8592;',
  'rarr': '&#8594;',
  'uarr': '&#8593;',
  'darr': '&#8595;',
  'harr': '&#8596;',
  'iexcl': '&#161;',
  'iquest': '&#191;',
  'acute': '&#180;',
  'cedil': '&#184;',
  'macr': '&#175;',
  'shy': '&#173;'
};

// XML predefined entities - do not convert these
const XML_PREDEFINED = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

/**
 * Normalize HTML named entities to XML-safe numeric entities.
 * - Preserves XML predefined entities (&amp; &lt; &gt; &quot; &apos;)
 * - Converts known named entities to numeric equivalents
 * - For unknown entities, escapes the ampersand to preserve literal text
 * - Does not double-escape existing numeric entities
 * @param {string} html
 * @returns {{ html: string, entitiesConverted: number }}
 */
function normalizeNamedEntities(html) {
  let entitiesConverted = 0;

  // Match named entities like &nbsp; but not numeric like &#160; or &#x00A0;
  const result = html.replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (match, name) => {
    // Keep XML predefined entities as-is
    if (XML_PREDEFINED.has(name)) {
      return match;
    }
    // Convert known named entities to numeric
    const mapped = /** @type {string | undefined} */ (NAMED_ENTITY_MAP[/** @type {keyof NAMED_ENTITY_MAP} */ (name)]);
    if (mapped) {
      entitiesConverted += 1;
      return mapped;
    }
    // Unknown entity: escape ampersand to preserve literal text
    entitiesConverted += 1;
    return `&amp;${name};`;
  });

  return { html: result, entitiesConverted };
}

/**
 * @param {string} text
 * @param {RegExp} regex
 * @returns {number}
 */
function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * @param {string} tagName
 * @param {string} [attrs='']
 * @returns {string}
 */
function formatVoidTag(tagName, attrs = '') {
  const cleaned = String(attrs).replace(/\/\s*$/, '').trim();
  const suffix = cleaned ? ` ${cleaned}` : '';
  return `<${tagName}${suffix} />`;
}

/**
 * @param {string} html
 * @returns {{ xhtml: string, report: { widgetTagsRemoved: number, widgetTextBlocks: number } }}
 */
function flattenWidgetElements(html) {
  let sanitized = html;
  const report = {
    widgetTagsRemoved: 0,
    widgetTextBlocks: 0
  };

  const widgetRegex = new RegExp(`<(${WIDGET_TAGS.join('|')})\\b`, 'gi');
  report.widgetTagsRemoved = countMatches(sanitized, widgetRegex);

  /** @param {string} value */
  const stripTags = (value) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  /**
   * @param {string} tag
   * @param {string} wrapperTag
   */
  const replaceContainer = (tag, wrapperTag) => {
    const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, (_, inner) => {
      const text = stripTags(inner);
      if (!text) {
        return '';
      }
      report.widgetTextBlocks += 1;
      return `<${wrapperTag} class="widget-text">${text}</${wrapperTag}>`;
    });
  };

  WIDGET_INLINE_TAGS.forEach((tag) => replaceContainer(tag, 'span'));
  WIDGET_BLOCK_TAGS.forEach((tag) => replaceContainer(tag, 'p'));

  const widgetPattern = WIDGET_TAGS.join('|');
  sanitized = sanitized.replace(new RegExp(`<(${widgetPattern})\\b[^>]*\\/?>`, 'gi'), '');
  sanitized = sanitized.replace(new RegExp(`<\\/(${widgetPattern})>`, 'gi'), '');

  return { xhtml: sanitized, report };
}

/**
 * @param {string} html
 * @param {Object} [options={}]
 * @param {boolean} [options.flattenWidgets]
 * @returns {{ xhtml: string, report: any }}
 */
export function sanitizeXhtml(html, options = {}) {
  const settings = {
    flattenWidgets: true,
    ...options
  };

  let sanitized = html;
  const report = {
    pictureReplaced: 0,
    pictureRemoved: 0,
    sourceRemoved: 0,
    svgRemoved: 0,
    figureConverted: 0,
    figcaptionConverted: 0,
    articleConverted: 0,
    sectionConverted: 0,
    brNormalized: 0,
    hrNormalized: 0,
    widgetTagsRemoved: 0,
    widgetTextBlocks: 0,
    linkTagsRemoved: 0,
    entitiesConverted: 0
  };

  report.sourceRemoved += countMatches(sanitized, /<source\b/gi);

  sanitized = sanitized.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, (match) => {
    const imgMatch = /** @type {RegExpMatchArray | null} */ (match.match(/<img\b[^>]*>/i));
    if (imgMatch && imgMatch[0]) {
      report.pictureReplaced += 1;
      return imgMatch[0];
    }
    report.pictureRemoved += 1;
    return '';
  });

  sanitized = sanitized.replace(/<picture\b[^>]*\/>/gi, () => {
    report.pictureRemoved += 1;
    return '';
  });

  sanitized = sanitized.replace(/<source\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/source>/gi, '');

  report.svgRemoved += countMatches(sanitized, /<svg\b/gi);
  sanitized = sanitized.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');
  sanitized = sanitized.replace(/<svg\b[^>]*\/>/gi, '');

  report.figureConverted += countMatches(sanitized, /<figure\b/gi);
  report.figcaptionConverted += countMatches(sanitized, /<figcaption\b/gi);
  sanitized = sanitized.replace(/<figure\b[^>]*>/gi, '<div>');
  sanitized = sanitized.replace(/<\/figure>/gi, '</div>');
  sanitized = sanitized.replace(/<figcaption\b[^>]*>/gi, '<p class="caption">');
  sanitized = sanitized.replace(/<\/figcaption>/gi, '</p>');

  report.articleConverted += countMatches(sanitized, /<article\b/gi);
  report.sectionConverted += countMatches(sanitized, /<section\b/gi);
  sanitized = sanitized.replace(/<article\b[^>]*>/gi, '<div>');
  sanitized = sanitized.replace(/<\/article>/gi, '</div>');
  sanitized = sanitized.replace(/<section\b[^>]*>/gi, '<div>');
  sanitized = sanitized.replace(/<\/section>/gi, '</div>');

  if (settings.flattenWidgets) {
    const widgetResult = flattenWidgetElements(sanitized);
    sanitized = widgetResult.xhtml;
    report.widgetTagsRemoved += widgetResult.report.widgetTagsRemoved;
    report.widgetTextBlocks += widgetResult.report.widgetTextBlocks;
  }

  report.linkTagsRemoved += countMatches(sanitized, /<a\b/gi);
  sanitized = sanitized.replace(/<a\b[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/a>/gi, '');

  report.brNormalized += countMatches(sanitized, /<br\b(?![^>]*\/>)[^>]*>/gi);
  report.hrNormalized += countMatches(sanitized, /<hr\b(?![^>]*\/>)[^>]*>/gi);
  sanitized = sanitized.replace(/<br\b([^>]*)>/gi, (/** @type {any} */ _, /** @type {string} */ attrs) => formatVoidTag('br', attrs));
  sanitized = sanitized.replace(/<hr\b([^>]*)>/gi, (/** @type {any} */ _, /** @type {string} */ attrs) => formatVoidTag('hr', attrs));

  // Normalize HTML named entities to XML-safe numeric entities
  const entityResult = normalizeNamedEntities(sanitized);
  sanitized = entityResult.html;
  report.entitiesConverted = entityResult.entitiesConverted;

  return { xhtml: sanitized, report };
}
