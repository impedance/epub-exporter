import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMimetypeTemplate,
  getContainerTemplate,
  getContentOpfTemplate,
  getTocNcxTemplate,
  getChapterXhtmlTemplate,
  getStylesTemplate
} from '../epub/templates/index.js';

test('mimetype template returns EPUB media type string', () => {
  const mimetype = getMimetypeTemplate();
  assert.equal(mimetype, 'application/epub+zip');
});

test('container template points to packaged OPF manifest', () => {
  const container = getContainerTemplate();
  assert.match(container, /<rootfile full-path="OEBPS\/content\.opf"/);
  assert.match(container, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
});

test('content.opf template exposes required placeholders', () => {
  const opf = getContentOpfTemplate();
  assert.match(opf, /<dc:identifier id="BookId">{{BOOK_ID}}<\/dc:identifier>/);
  assert.match(opf, /<dc:title>{{TITLE}}<\/dc:title>/);
  assert.match(opf, /<dc:date>{{TIMESTAMP}}<\/dc:date>/);
  assert.match(opf, /<manifest>{{MANIFEST}}/);
});

test('toc.ncx template includes book metadata placeholders', () => {
  const toc = getTocNcxTemplate();
  assert.match(toc, /<meta name="dtb:uid" content="{{BOOK_ID}}"/);
  assert.match(toc, /<text>{{TITLE}}<\/text>/);
  assert.match(toc, /<content src="chapter1.xhtml"\/>/);
});

test('chapter template includes title and content placeholders', () => {
  const chapter = getChapterXhtmlTemplate();
  assert.match(chapter, /<title>{{TITLE}}<\/title>/);
  assert.match(chapter, /<h1>{{TITLE}}<\/h1>/);
  assert.match(chapter, /{{CONTENT}}/);
});

test('styles template contains core typography rules', () => {
  const styles = getStylesTemplate();
  assert.match(styles, /body\s*{\s*font-family:/);
  assert.match(styles, /img\s*{\s*max-width: 100%/);
  assert.match(styles, /\.hljs-keyword/);
});
