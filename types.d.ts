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

export type ExtensionAction = 'createEPUB' | 'fetchImageAsDataURL' | 'extractContent' | 'extractCleanContent';

export interface CreateEPUBRequest {
  action: 'createEPUB';
  data: ExtractedContent;
  uploadToDropbox?: boolean;
  sendToKindle?: boolean;
}

export interface FetchImageRequest {
  action: 'fetchImageAsDataURL';
  url: string;
}

export interface ExtractContentRequest {
  action: 'extractContent';
}

export interface ExtractCleanContentRequest {
  action: 'extractCleanContent';
}

export type ExtensionMessage =
  | CreateEPUBRequest
  | FetchImageRequest
  | ExtractContentRequest
  | ExtractCleanContentRequest;

export interface CreateEPUBResponse {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  dropboxPath?: string;
  kindleSent?: boolean;
  error?: string;
}

export interface FetchImageResponse {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export interface DropboxConfig {
  accessToken: string;
  folderPath: string;
}

export interface GmailConfig {
  userEmail: string;
  kindleEmail: string;
}
