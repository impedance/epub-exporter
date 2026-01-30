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
    '<svg><path/></svg>',
    '<figure><img src="figure.png"></figure>',
    '<figcaption>Caption</figcaption>',
    '<br>',
    '<hr>'
  ].join('');
  const { xhtml, report } = sanitizeXhtml(html);

  assert.ok(!xhtml.includes('<picture'), 'Picture wrapper should be removed');
  assert.ok(!xhtml.includes('<source'), 'Source tags should be removed');
  assert.ok(!xhtml.includes('<svg'), 'Inline SVG should be removed');
  assert.match(xhtml, /<div><img src="figure\.png"><\/div>/, 'Figure should become div');
  assert.match(xhtml, /<p class="caption">Caption<\/p>/, 'Figcaption should become caption paragraph');
  assert.match(xhtml, /<br \/>/, 'br should be self-closed');
  assert.match(xhtml, /<hr \/>/, 'hr should be self-closed');

  assert.equal(report.pictureReplaced, 1);
  assert.equal(report.sourceRemoved, 1);
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
