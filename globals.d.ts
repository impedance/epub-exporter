/* AICODE-NOTE: DECISION/TS-GLOBALS decision: minimal globals keep typecheck working when npm types are unavailable. */
declare const chrome: any;
declare const JSZip: any;
declare const module: any;
declare const Buffer: any;
// AICODE-LINK: ./types.d.ts#ExtractedContent
declare function extractContentFromTab(tabId: number): Promise<{success: boolean, data?: import('./types').ExtractedContent, error?: string}>;
