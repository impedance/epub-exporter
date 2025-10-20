/* AICODE-WHY: Centralized type definitions ensure consistent cross-module contracts and reduce duplication [2025-08-15] */

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
