import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { readFile as readFileRaw } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

let JSZipInstance = globalThis.JSZip;
const require = createRequire(import.meta.url);

async function ensureJSZip() {
  if (JSZipInstance) {
    return JSZipInstance;
  }
  try {
    const module = require('../../jszip.min.js');
    JSZipInstance = module?.default || module?.JSZip || module;
  } catch (error) {
    // ignore require errors, fallback to VM eval
  }
  const isValid = JSZipInstance && typeof JSZipInstance.loadAsync === 'function';
  if (!isValid) {
    const source = await readFileRaw(new URL('../../jszip.min.js', import.meta.url), 'utf8');
    const context = {
      globalThis,
      global: globalThis,
      window: globalThis,
      self: globalThis,
      Buffer,
      process,
      setImmediate,
      clearImmediate,
      setTimeout,
      clearTimeout
    };
    vm.runInNewContext(source, context);
    JSZipInstance = globalThis.JSZip;
  }
  if (!JSZipInstance) {
    throw new Error('JSZip is not available on globalThis');
  }
  return JSZipInstance;
}

export async function loadZipFromFile(fileUrl) {
  const JSZip = await ensureJSZip();
  const buffer = await readFile(fileUrl);
  return JSZip.loadAsync(buffer);
}

export async function readZipText(zip, path) {
  const entry = zip.file(path);
  if (!entry) {
    throw new Error(`Missing entry: ${path}`);
  }
  return entry.async('string');
}

export function validateXhtmlContract(xhtml) {
  const errors = [];

  try {
    new JSDOM(xhtml, { contentType: 'application/xhtml+xml' });
  } catch (error) {
    errors.push(`xml-parse:${error.message}`);
  }

  const patterns = [
    { name: 'picture', regex: /<picture\b/i },
    { name: 'source', regex: /<source\b/i },
    { name: 'svg', regex: /<svg\b/i },
    { name: 'br', regex: /<br\b(?![^>]*\/>)[^>]*>/i },
    { name: 'hr', regex: /<hr\b(?![^>]*\/>)[^>]*>/i }
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(xhtml)) {
      errors.push(`forbidden:${pattern.name}`);
    }
  }

  return errors;
}

export function collectImageRefsFromXhtml(xhtml) {
  const refs = new Set();
  const regex = /<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = regex.exec(xhtml)) !== null) {
    refs.add(match[1]);
  }
  return refs;
}

export function collectManifestHrefs(opf) {
  const hrefs = new Set();
  const regex = /<item\b[^>]*\bhref="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = regex.exec(opf)) !== null) {
    hrefs.add(match[1]);
  }
  return hrefs;
}

export function listZipImageEntries(zip) {
  return zip.file(/OEBPS\/images\/.+/).map((entry) => entry.name.replace(/^OEBPS\//, ''));
}
