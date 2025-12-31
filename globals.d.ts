/* AICODE-NOTE: DECISION/TS-GLOBALS decision: minimal globals keep typecheck working when npm types is unavailable. */
declare const chrome: any;
declare const JSZip: any;
declare const module: any;
declare const Buffer: any;
declare const DOMPurify: any;
declare class Readability {
    constructor(doc: Document | Node, options?: any);
    parse(): {
        title: string;
        content: string;
        textContent: string;
        length: number;
        excerpt: string;
        byline: string;
        dir: string;
        siteName: string;
        lang: string;
    };
}
// AICODE-LINK: ./types.d.ts#ExtractedContent
declare function extractContentFromTab(tabId: number): Promise<{ success: boolean, data?: import('./types').ExtractedContent, error?: string }>;
