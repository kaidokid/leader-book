/** 前端 API 请求封装（纯前端版本）
 * 所有原 /api/... 的 fetch 请求改为直接调用浏览器端服务模块
 * 函数签名与返回类型保持不变，页面组件无需修改
 */
import type {
  ModelPreset,
  ModelConfig,
  SearchResponse,
  UploadResult,
  ReportMeta,
  Report,
  JobEvent,
} from '@/lib/types';
import { extractBook } from '@/lib/bookExtractor';
import { searchBooks as doSearchBooks } from '@/lib/bookSearch';
import { MODEL_PRESETS } from '@/lib/modelPresets';
import { testModel as doTestModel } from '@/lib/llmClient';
import {
  startGenerateJob,
  subscribeJob,
  abortJob,
  getJob,
} from '@/lib/reportGenerate';
import {
  listReports as listReportsFromStorage,
  getReport as getReportFromStorage,
  deleteReport as deleteReportFromStorage,
} from '@/lib/reportStorage';

/** 上传书籍文件 */
export async function uploadBook(file: File): Promise<UploadResult> {
  const result = await extractBook(file);
  return {
    fileId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    fileSize: file.size,
    extractedText: result.text,
    charCount: result.charCount,
    preview: result.preview,
    inferredTitle: result.inferredTitle,
    warning: result.warning,
  };
}

/** 书名检索 */
export async function searchBooks(query: string): Promise<SearchResponse> {
  return await doSearchBooks(query);
}

/** 获取模型预设 */
export async function getModelPresets(): Promise<ModelPreset[]> {
  return MODEL_PRESETS;
}

/** 测试模型连通性 */
export async function testModel(
  config: Pick<ModelConfig, 'apiKey' | 'baseUrl' | 'modelName'>,
): Promise<{ ok: boolean; message: string }> {
  return await doTestModel(config);
}

/** 启动报告生成任务 */
export async function startGenerate(body: {
  mode: 'upload' | 'search';
  bookText?: string;
  bookTitle?: string;
  bookInfo?: import('@/lib/types').BookResult;
  found?: boolean;
  modelConfig: Pick<ModelConfig, 'apiKey' | 'baseUrl' | 'modelName'>;
}): Promise<{ jobId: string }> {
  const jobId = startGenerateJob(body);
  return { jobId };
}

/** 订阅生成任务事件流 */
export function subscribeGenerate(
  jobId: string,
  onEvent: (evt: JobEvent) => void,
  onError?: (err: Error) => void,
): () => void {
  // 订阅前同步检查任务是否存在（不存在通常是页面刷新导致内存任务丢失）
  const job = getJob(jobId);
  if (!job) {
    onError?.(new Error('任务不存在，可能页面已被刷新，请重新生成报告'));
    return () => {};
  }
  // 任务存在则正常订阅；onEnd 不再误报错误
  // 错误只能通过 'error' 事件传递，正常结束（done/aborted）不会触发 onError
  return subscribeJob(jobId, onEvent, () => {});
}

/** 中止生成任务 */
export async function abortGenerate(jobId: string): Promise<void> {
  abortJob(jobId);
}

/** 获取报告列表 */
export async function listReports(): Promise<ReportMeta[]> {
  return await listReportsFromStorage();
}

/** 获取单条报告 */
export async function getReport(id: string): Promise<Report> {
  const result = await getReportFromStorage(id);
  if (!result) throw new Error('报告不存在');
  return { ...result.meta, content: result.content };
}

/** 删除报告 */
export async function deleteReport(id: string): Promise<void> {
  await deleteReportFromStorage(id);
}
