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

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function formatVoidTag(tagName, attrs = '') {
  const cleaned = String(attrs).replace(/\/\s*$/, '').trim();
  const suffix = cleaned ? ` ${cleaned}` : '';
  return `<${tagName}${suffix} />`;
}

function flattenWidgetElements(html) {
  let sanitized = html;
  const report = {
    widgetTagsRemoved: 0,
    widgetTextBlocks: 0
  };

  const widgetRegex = new RegExp(`<(${WIDGET_TAGS.join('|')})\\b`, 'gi');
  report.widgetTagsRemoved = countMatches(sanitized, widgetRegex);

  const stripTags = (value) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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
    brNormalized: 0,
    hrNormalized: 0,
    widgetTagsRemoved: 0,
    widgetTextBlocks: 0
  };

  report.sourceRemoved += countMatches(sanitized, /<source\b/gi);

  sanitized = sanitized.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, (match) => {
    const imgMatch = match.match(/<img\b[^>]*>/i);
    if (imgMatch) {
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

  if (settings.flattenWidgets) {
    const widgetResult = flattenWidgetElements(sanitized);
    sanitized = widgetResult.xhtml;
    report.widgetTagsRemoved += widgetResult.report.widgetTagsRemoved;
    report.widgetTextBlocks += widgetResult.report.widgetTextBlocks;
  }

  report.brNormalized += countMatches(sanitized, /<br\b(?![^>]*\/>)[^>]*>/gi);
  report.hrNormalized += countMatches(sanitized, /<hr\b(?![^>]*\/>)[^>]*>/gi);
  sanitized = sanitized.replace(/<br\b([^>]*)>/gi, (_, attrs) => formatVoidTag('br', attrs));
  sanitized = sanitized.replace(/<hr\b([^>]*)>/gi, (_, attrs) => formatVoidTag('hr', attrs));

  return { xhtml: sanitized, report };
}
