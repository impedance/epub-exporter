// @ts-check
/* global chrome */
import EPUBGenerator from './epub_generator.js';
import DropboxClient from './dropbox_client.js';
import GmailClient from './gmail_client.js';
import { fetchImageAsDataURL, prepareImages, extractImageCandidatesFromHtml, optimizeImage } from './background/images.js';

// AICODE-NOTE: NAV/BACKGROUND entry: chrome.runtime.onMessage -> createEPUBFile ref: background.js
// AICODE-LINK: ./types.d.ts#ExtractedImage
// AICODE-LINK: ./types.d.ts#ExtractedContent
// AICODE-LINK: ./types.d.ts#ExtensionMessage
// AICODE-LINK: ./epub_generator.js#createEPUB
// AICODE-LINK: ./background/images.js#prepareImages

/** @typedef {import('./types').ExtractedContent} ExtractedContent */
/** @typedef {import('./types').ExtensionMessage} ExtensionMessage */
/** @typedef {import('./types').CreateEPUBResponse} CreateEPUBResponse */
/** @typedef {import('./types').FetchImageResponse} FetchImageResponse */

const dropboxClient = new DropboxClient();
const gmailClient = new GmailClient();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const message = /** @type {ExtensionMessage} */ (request);

  if (message.action === 'createEPUB') {
    createEPUBFile(message.data, {
      uploadToDropbox: Boolean(message.uploadToDropbox),
      sendToKindle: Boolean(message.sendToKindle)
    })
      .then((result) => sendResponse(/** @type {CreateEPUBResponse} */ ({ success: true, ...result })))
      .catch((error) =>
        sendResponse(/** @type {CreateEPUBResponse} */ ({ success: false, error: error.message }))
      );
    return true;
  }

  if (message.action === 'fetchImageAsDataURL' && message.url) {
    fetchImageAsDataURL(message.url)
      .then((dataUrl) => sendResponse(/** @type {FetchImageResponse} */ ({ success: true, dataUrl })))
      .catch((error) =>
        sendResponse(/** @type {FetchImageResponse} */ ({ success: false, error: error.message }))
      );
    return true;
  }
});

/**
 * Создает EPUB файл из переданных данных.
 * @param {ExtractedContent} data
 * @param {{ uploadToDropbox?: boolean, sendToKindle?: boolean }} [options]
 * @returns {Promise<{downloadUrl: string, filename: string, dropboxPath?: string, kindleSent?: boolean}>}
 */
async function createEPUBFile(data, options = {}) {
  try {
    const generator = new EPUBGenerator();
    const { title, content, images, url } = data;
    const preparedImages = await prepareImages(images, url, content);
    const result = await generator.createEPUB(title, content, preparedImages, url);

    let dropboxPath;
    if (options.uploadToDropbox) {
      const blobSize = typeof result.blob.size === 'number' ? result.blob.size : undefined;
      console.log('[background][dropbox] upload requested', {
        filename: result.filename,
        bytes: blobSize ?? 'unknown'
      });
      dropboxPath = await dropboxClient.uploadFile(result.blob, result.filename);
      console.log('[background][dropbox] upload completed', {
        filename: result.filename,
        dropboxPath
      });
    }

    let kindleSent = false;
    if (options.sendToKindle) {
      console.log('[background][kindle] send requested', { filename: result.filename });
      await gmailClient.sendEmail(result.blob, result.filename, '');
      kindleSent = true;
      console.log('[background][kindle] send completed');
    }

    return {
      downloadUrl: result.downloadUrl,
      filename: result.filename,
      dropboxPath,
      kindleSent
    };
  } catch (error) {
    const epubError = /** @type {Error} */ (error);
    console.error('Ошибка создания EPUB:', epubError);
    throw epubError;
  }
}

export { prepareImages, extractImageCandidatesFromHtml, optimizeImage };
