/* AICODE-WHY: Minimal global declarations to satisfy TypeScript when npm types unavailable [2025-08-13] */
declare const chrome: any;
declare const JSZip: any;
declare const module: any;
declare const Buffer: any;
// AICODE-LINK: ./types.d.ts#ExtractedContent
declare function extractContentFromTab(tabId: number): Promise<{success: boolean, data?: import('./types').ExtractedContent, error?: string}>;
