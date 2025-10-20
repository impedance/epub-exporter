// AICODE-LINK: ../epub_generator.js#addImagesToZip
const DATA_URI_SEPARATOR = ',';

/**
 * @typedef {Object} ImageInput
 * @property {string} src
 * @property {string} originalSrc
 * @property {string} base64
 * @property {string} [alt]
 * @property {number|string} [width]
 * @property {number|string} [height]
 */

/**
 * Filters invalid image inputs before packaging.
 * @param {ImageInput[]} images
 * @returns {ImageInput[]}
 */
export function sanitizeImageInputs(images) {
    return images.filter(img => Boolean(img?.base64 && img?.src && img?.originalSrc));
}

/**
 * Detects extension from base64 data URI.
 * @param {string} base64String
 * @returns {string}
 */
export function getImageExtension(base64String) {
    if (base64String.includes('data:image/png')) return 'png';
    if (base64String.includes('data:image/gif')) return 'gif';
    if (base64String.includes('data:image/webp')) return 'webp';
    if (base64String.includes('data:image/jpeg') || base64String.includes('data:image/jpg')) return 'jpeg';
    return 'jpeg';
}

/**
 * Maps extension to EPUB media type.
 * @param {string} extension
 * @returns {string}
 */
export function getImageMediaType(extension) {
    switch (extension) {
        case 'png':
            return 'image/png';
        case 'gif':
            return 'image/gif';
        case 'webp':
            return 'image/webp';
        case 'jpeg':
        case 'jpg':
            return 'image/jpeg';
        default:
            return 'image/jpeg';
    }
}

/**
 * Converts base64 data URI into binary byte array.
 * @param {string} base64String
 * @returns {Uint8Array}
 */
export function decodeBase64Image(base64String) {
    const parts = base64String.split(DATA_URI_SEPARATOR);
    const payload = parts.length > 1 ? parts.slice(1).join(DATA_URI_SEPARATOR) : base64String;

    if (typeof atob === 'function') {
        const binaryData = atob(payload);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
        }
        return bytes;
    }

    return Uint8Array.from(Buffer.from(payload, 'base64'));
}
