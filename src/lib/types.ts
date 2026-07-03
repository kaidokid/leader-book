/** 共享类型定义 */

export interface ModelPreset {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  modelName: string;
  description: string;
  recommended?: boolean;
}

export interface ModelConfig {
  presetId: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

export interface BookResult {
  id: string;
  title: string;
  authors: string[];
  description: string;
  thumbnail?: string;
  publisher?: string;
  publishedDate?: string;
  categories?: string[];
  infoLink?: string;
}

export interface SearchResponse {
  found: boolean;
  source: string;
  results: BookResult[];
  notice?: string;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  fileSize: number;
  extractedText: string;
  charCount: number;
  preview: string;
  inferredTitle: string;
  /** 编码或提取警告 */
  warning?: string;
}

export interface ReportMeta {
  id: string;
  title: string;
  author?: string;
  createdAt: string;
  relevance: 'high' | 'medium' | 'low';
  source: string;
  fileName: string;
  readTime?: string;
}

export interface Report extends ReportMeta {
  content: string;
}

export interface JobEvent {
  type: 'step' | 'content' | 'done' | 'error' | 'end';
  step?: number;
  title?: string;
  text?: string;
  reportId?: string;
  message?: string;
}
