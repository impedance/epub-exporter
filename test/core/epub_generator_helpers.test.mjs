import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeImageInputs } from '../../epub/assets.js';
import { sanitizeXhtml } from '../../epub/sanitize_xhtml.js';

test('sanitizeXhtml removes PocketBook triggers and reports changes', () => {
  const html = [
    '<picture>',
    '<source srcset="hero.webp"/>',
    '<img src="hero.png">',
    '</picture>',
    '<p><a href="https://example.com">Link</a> text</p>',
    '<article><section><p>Nested</p></section></article>',
    '<svg><path/></svg>',
    '<figure><img src="figure.png"></figure>',
    '<figcaption>Caption</figcaption>',
    '<br>',
    '<hr>'
  ].join('');
  const { xhtml, report } = sanitizeXhtml(html);

  assert.ok(!xhtml.includes('<picture'), 'Picture wrapper should be removed');
  assert.ok(!xhtml.includes('<source'), 'Source tags should be removed');
  assert.ok(!xhtml.includes('<a '), 'Anchor tags should be removed');
  assert.ok(!xhtml.includes('<svg'), 'Inline SVG should be removed');
  assert.ok(!xhtml.includes('<article'), 'Article tags should be removed');
  assert.ok(!xhtml.includes('<section'), 'Section tags should be removed');
  assert.match(xhtml, /<div><img src="figure\.png"><\/div>/, 'Figure should become div');
  assert.match(xhtml, /<p class="caption">Caption<\/p>/, 'Figcaption should become caption paragraph');
  assert.match(xhtml, /<br \/>/, 'br should be self-closed');
  assert.match(xhtml, /<hr \/>/, 'hr should be self-closed');

  assert.equal(report.pictureReplaced, 1);
  assert.equal(report.sourceRemoved, 1);
  assert.equal(report.linkTagsRemoved, 1);
  assert.equal(report.articleConverted, 1);
  assert.equal(report.sectionConverted, 1);
  assert.equal(report.svgRemoved, 1);
  assert.equal(report.figureConverted, 1);
  assert.equal(report.figcaptionConverted, 1);
  assert.equal(report.brNormalized, 1);
  assert.equal(report.hrNormalized, 1);
});

test('sanitizeImageInputs filters out incomplete image records', () => {
  const validImage = {
    src: 'resolved.png',
    originalSrc: 'original.png',
    base64: 'data:image/png;base64,ZmFrZQ=='
  };
  const missingBase64 = { src: 'resolved.png', originalSrc: 'original.png', base64: '' };
  const missingSrc = { src: '', originalSrc: 'original.png', base64: 'data:image/png;base64,ZmFrZQ==' };

  const sanitized = sanitizeImageInputs([validImage, missingBase64, missingSrc]);
  assert.equal(sanitized.length, 1);
  assert.deepEqual(sanitized[0], validImage);
});

test('sanitizeXhtml converts &nbsp; to &#160;', () => {
  const html = '<p>Hello&nbsp;World</p>';
  const { xhtml, report } = sanitizeXhtml(html);

  assert.ok(!xhtml.includes('&nbsp;'), 'Should not contain &nbsp;');
  assert.ok(xhtml.includes('&#160;'), 'Should contain &#160;');
  assert.equal(report.entitiesConverted, 1);
});

test('sanitizeXhtml converts multiple named entities', () => {
  const html = '<p>&mdash; &laquo;text&raquo; &copy; 2024</p>';
  const { xhtml, report } = sanitizeXhtml(html);

  assert.ok(!xhtml.includes('&mdash;'), 'Should not contain &mdash;');
  assert.ok(!xhtml.includes('&laquo;'), 'Should not contain &laquo;');
  assert.ok(!xhtml.includes('&raquo;'), 'Should not contain &raquo;');
  assert.ok(!xhtml.includes('&copy;'), 'Should not contain &copy;');
  assert.ok(xhtml.includes('&#8212;'), 'Should contain &#8212; (mdash)');
  assert.ok(xhtml.includes('&#171;'), 'Should contain &#171; (laquo)');
  assert.ok(xhtml.includes('&#187;'), 'Should contain &#187; (raquo)');
  assert.ok(xhtml.includes('&#169;'), 'Should contain &#169; (copy)');
  assert.equal(report.entitiesConverted, 4);
});

test('sanitizeXhtml preserves XML predefined entities', () => {
  const html = '<p>&lt;tag&gt; &amp; &quot;text&quot; &apos;s</p>';
  const { xhtml, report } = sanitizeXhtml(html);

  assert.ok(xhtml.includes('&lt;'), 'Should preserve &lt;');
  assert.ok(xhtml.includes('&gt;'), 'Should preserve &gt;');
  assert.ok(xhtml.includes('&amp;'), 'Should preserve &amp;');
  assert.ok(xhtml.includes('&quot;'), 'Should preserve &quot;');
  assert.ok(xhtml.includes("&apos;"), 'Should preserve &apos;');
  assert.equal(report.entitiesConverted, 0, 'No entities should be converted');
});

test('sanitizeXhtml does not double-escape numeric entities', () => {
  const html = '<p>&#160; &#8212; &#x00A0;</p>';
  const { xhtml, report } = sanitizeXhtml(html);

  assert.ok(xhtml.includes('&#160;'), 'Should preserve &#160;');
  assert.ok(xhtml.includes('&#8212;'), 'Should preserve &#8212;');
  assert.ok(xhtml.includes('&#x00A0;'), 'Should preserve &#x00A0;');
  assert.equal(report.entitiesConverted, 0, 'No entities should be converted');
});

test('sanitizeXhtml is idempotent for entity conversion', () => {
  const html = '<p>Hello&nbsp;World &mdash; test</p>';
  const { xhtml: first } = sanitizeXhtml(html);
  const { xhtml: second, report } = sanitizeXhtml(first);

  assert.equal(first, second, 'Running sanitizer twice should produce same output');
  assert.equal(report.entitiesConverted, 0, 'Second pass should convert no entities');
});

