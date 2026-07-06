/**
 * 报告本地存储服务（浏览器端版本）
 * 双写策略：IndexedDB 为主存储 + localStorage 作为镜像备份
 * 读取时合并两者，保证任意一端异常时历史不会丢失
 * 数据库名：leader-book-db，store 名：reports
 * localStorage key：leader-book-reports-backup
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

const DB_NAME = 'leader-book-db';
const STORE_NAME = 'reports';
const BACKUP_KEY = 'leader-book-reports-backup';

// IndexedDB 单例 promise（懒初始化，避免模块加载时即抛错）
let dbPromise: Promise<unknown> | null = null;
function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'meta.id' });
      }
    },
  }).catch((err) => {
    console.warn('[reportStorage] IndexedDB 初始化失败，回退到 localStorage：', err);
    return null;
  });
  return dbPromise;
}

// ---------- localStorage 备份 ----------
function readBackup(): Map<string, StoredRecord> {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as StoredRecord[];
    return new Map(arr.map((r) => [r.meta.id, r]));
  } catch (e) {
    console.warn('[reportStorage] localStorage 读取失败：', e);
    return new Map();
  }
}

function writeBackup(map: Map<string, StoredRecord>) {
  try {
    // localStorage 单条上限约 5MB，全量报告可能超限
    // 备份策略：只保留最近 50 条，且单条内容超过 1MB 时截断内容
    const items = [...map.values()]
      .sort((a, b) => new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime())
      .slice(0, 50)
      .map((r) => {
        if (r.content.length > 1_000_000) {
          return { meta: r.meta, content: r.content.slice(0, 1_000_000) + '\n\n…（备份内容已截断，完整内容请见 IndexedDB）' };
        }
        return r;
      });
    localStorage.setItem(BACKUP_KEY, JSON.stringify(items));
  } catch (e) {
    // 配额超限时：逐步丢弃最旧记录再试
    console.warn('[reportStorage] localStorage 写入失败，尝试清理旧数据：', e);
    try {
      const items = [...map.values()]
        .sort((a, b) => new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime())
        .slice(0, 20);
      localStorage.setItem(BACKUP_KEY, JSON.stringify(items));
    } catch (e2) {
      console.error('[reportStorage] localStorage 备份最终失败：', e2);
    }
  }
}

function upsertBackup(record: StoredRecord) {
  const map = readBackup();
  map.set(record.meta.id, record);
  writeBackup(map);
}

function deleteBackup(id: string) {
  const map = readBackup();
  if (map.delete(id)) writeBackup(map);
}

// ---------- 主接口 ----------
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
  const record: StoredRecord = { meta: reportMeta, content };

  // 1) 先写 localStorage 备份（同步、可靠）
  upsertBackup(record);

  // 2) 再写 IndexedDB（异步、容量大）
  try {
    const db = await getDB();
    if (db) {
      await (db as Awaited<ReturnType<typeof openDB>>).put(STORE_NAME, record);
    }
  } catch (e) {
    // IndexedDB 写失败不阻塞，已有 localStorage 备份
    console.warn('[reportStorage] IndexedDB 写入失败，已用 localStorage 备份：', e);
  }

  return reportMeta;
}

/** 获取报告列表（元信息），按 createdAt 降序 */
export async function listReports(): Promise<ReportMeta[]> {
  // 合并 IndexedDB + localStorage
  const merged = new Map<string, StoredRecord>();

  // 从 localStorage 读
  for (const [id, r] of readBackup()) merged.set(id, r);

  // 从 IndexedDB 读（覆盖 localStorage）
  try {
    const db = await getDB();
    if (db) {
      const all = (await (db as Awaited<ReturnType<typeof openDB>>).getAll(STORE_NAME)) as StoredRecord[];
      for (const r of all) merged.set(r.meta.id, r);
    }
  } catch (e) {
    console.warn('[reportStorage] IndexedDB 读取失败，仅用 localStorage：', e);
  }

  return [...merged.values()]
    .map((r) => r.meta)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** 获取单条报告内容 */
export async function getReport(
  id: string,
): Promise<{ meta: ReportMeta; content: string } | null> {
  // 先查 IndexedDB
  try {
    const db = await getDB();
    if (db) {
      const result = (await (db as Awaited<ReturnType<typeof openDB>>).get(STORE_NAME, id)) as
        | StoredRecord
        | undefined;
      if (result) return { meta: result.meta, content: result.content };
    }
  } catch (e) {
    console.warn('[reportStorage] IndexedDB 读取失败，回退 localStorage：', e);
  }

  // 回退 localStorage
  const backup = readBackup().get(id);
  if (backup) return { meta: backup.meta, content: backup.content };
  return null;
}

/** 删除报告 */
export async function deleteReport(id: string): Promise<boolean> {
  deleteBackup(id);
  try {
    const db = await getDB();
    if (db) {
      await (db as Awaited<ReturnType<typeof openDB>>).delete(STORE_NAME, id);
    }
  } catch (e) {
    console.warn('[reportStorage] IndexedDB 删除失败：', e);
  }
  return true;
}
