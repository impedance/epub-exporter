import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import '../jszip.min.js';
import { sanitizeXhtml } from '../epub/sanitize_xhtml.js';

const JSZip = globalThis.JSZip;

function usage() {
  return `Usage: node scripts/repair_epub.js <input.epub> [output.epub]

Repairs PocketBook XHTML issues by sanitizing chapter*.xhtml with the same
sanitizer used in EPUB generation. The output preserves the required mimetype
rules for EPUB packaging.`;
}

async function repairEpub(inputPath, outputPath) {
  if (!JSZip) {
    throw new Error('JSZip is not available on globalThis');
  }

  const buffer = await readFile(inputPath);
  const zip = await JSZip.loadAsync(buffer);
  const outputZip = new JSZip();

  const entries = Object.values(zip.files);
  const chapterEntries = entries.filter((entry) => /OEBPS\/chapter\d+\.xhtml$/.test(entry.name));

  if (!zip.files.mimetype) {
    throw new Error('Missing mimetype entry in EPUB');
  }

  const mimetype = await zip.files.mimetype.async('string');
  outputZip.file('mimetype', mimetype, { compression: 'STORE' });

  let totals = {
    chapters: 0,
    sourceRemoved: 0,
    svgRemoved: 0,
    brNormalized: 0,
    hrNormalized: 0,
    widgetTagsRemoved: 0
  };

  for (const entry of entries) {
    if (entry.name === 'mimetype') {
      continue;
    }
    if (entry.dir) {
      outputZip.folder(entry.name);
      continue;
    }

    if (/OEBPS\/chapter\d+\.xhtml$/.test(entry.name)) {
      const before = await entry.async('string');
      const { xhtml: after, report } = sanitizeXhtml(before);

      totals.chapters += 1;
      totals.sourceRemoved += report.sourceRemoved;
      totals.svgRemoved += report.svgRemoved;
      totals.brNormalized += report.brNormalized;
      totals.hrNormalized += report.hrNormalized;
      totals.widgetTagsRemoved += report.widgetTagsRemoved;

      outputZip.file(entry.name, after);
      continue;
    }

    const data = await entry.async('uint8array');
    outputZip.file(entry.name, data);
  }

  if (chapterEntries.length === 0) {
    console.warn('No chapter XHTML entries found; output will match input.');
  }

  const outputBuffer = await outputZip.generateAsync({
    type: 'nodebuffer',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  await writeFile(outputPath, outputBuffer);

  console.log('EPUB repair complete.');
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Chapters sanitized: ${totals.chapters}`);
  console.log(`Removed <source>: ${totals.sourceRemoved}`);
  console.log(`Removed <svg>: ${totals.svgRemoved}`);
  console.log(`Normalized <br>: ${totals.brNormalized}`);
  console.log(`Normalized <hr>: ${totals.hrNormalized}`);
  console.log(`Removed widget tags: ${totals.widgetTagsRemoved}`);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(usage());
  process.exit(0);
}

const inputPath = args[0];
const outputPath = args[1] || (() => {
  const ext = path.extname(inputPath);
  const base = ext ? inputPath.slice(0, -ext.length) : inputPath;
  const finalExt = ext || '.epub';
  return `${base}_repaired${finalExt}`;
})();

repairEpub(inputPath, outputPath).catch((error) => {
  console.error('Failed to repair EPUB:', error);
  process.exit(1);
});
