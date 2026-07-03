/**
 * 报告本地存储服务（浏览器端版本）
 * 使用 IndexedDB（idb 库）存储报告，替代 Node 版的文件系统存储
 * 数据库名：leader-book-db，store 名：reports
 */
import { openDB } from 'idb';

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

interface StoredRecord {
  meta: ReportMeta;
  content: string;
}

const dbPromise = openDB('leader-book-db', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('reports')) {
      db.createObjectStore('reports', { keyPath: 'meta.id' });
    }
  },
});

/** 保存一条报告 */
export async function saveReport(
  content: string,
  meta: Omit<ReportMeta, 'fileName' | 'createdAt'> & { createdAt?: string },
): Promise<ReportMeta> {
  const id = meta.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const createdAt = meta.createdAt || new Date().toISOString();
  const reportMeta: ReportMeta = {
    id,
    title: meta.title,
    author: meta.author,
    createdAt,
    relevance: meta.relevance,
    source: meta.source,
    fileName: '', // 纯前端不需要 fileName，保留字段兼容
    readTime: meta.readTime,
  };
  await dbPromise.then((db) => db.put('reports', { meta: reportMeta, content } as StoredRecord));
  return reportMeta;
}

/** 获取报告列表（元信息），按 createdAt 降序 */
export async function listReports(): Promise<ReportMeta[]> {
  const all = (await dbPromise.then((db) => db.getAll('reports'))) as StoredRecord[];
  return all
    .map((r) => r.meta)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** 获取单条报告内容 */
export async function getReport(
  id: string,
): Promise<{ meta: ReportMeta; content: string } | null> {
  // keyPath 是 'meta.id'，所以 get 时直接传 id 作为 key
  const result = (await dbPromise.then((db) => db.get('reports', id))) as
    | StoredRecord
    | undefined;
  if (!result) return null;
  return { meta: result.meta, content: result.content };
}

/** 删除报告 */
export async function deleteReport(id: string): Promise<boolean> {
  await dbPromise.then((db) => db.delete('reports', id));
  return true;
}
