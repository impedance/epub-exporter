/* AICODE-NOTE: DECISION/TYPE-CENTRAL decision: centralized types keep cross-module contracts consistent. */

export interface ExtractedImage {
  src: string;
  originalSrc: string;
  base64: string;
  alt: string;
  width: number | string;
  height: number | string;
}

export interface ExtractedContent {
  title: string;
  content: string;
  images: ExtractedImage[];
  url: string;
  timestamp: string;
}
