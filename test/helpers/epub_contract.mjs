import '../../jszip.min.js';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const JSZip = globalThis.JSZip;

export async function loadZipFromFile(fileUrl) {
  if (!JSZip) {
    throw new Error('JSZip is not available on globalThis');
  }
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
