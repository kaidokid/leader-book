/**
 * 书籍检索服务（浏览器端版本）
 * 通过 CORS 代理访问 Open Library / Google Books
 * 即使检索失败，也允许用户基于书名生成报告（UI 层已处理）
 */
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

/** 带超时的 fetch */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 调用 Open Library API（通过 CORS 代理） */
async function searchOpenLibrary(query: string): Promise<BookResult[]> {
  const targetUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=key,title,author_name,first_sentence,cover_i,publisher,first_publish_year,subject`;
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
  const res = await fetchWithTimeout(proxyUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Open Library 请求失败：${res.status}`);
  }
  const data = await res.json();
  const docs = (data.docs || []) as any[];
  return docs.map((doc) => ({
    id: doc.key || String(doc.seed || ''),
    title: doc.title || '未知书名',
    authors: doc.author_name || [],
    description: doc.first_sentence
      ? Array.isArray(doc.first_sentence)
        ? doc.first_sentence.join(' ')
        : String(doc.first_sentence)
      : '',
    thumbnail: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : undefined,
    publisher: doc.publisher ? doc.publisher[0] : undefined,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
    categories: doc.subject ? doc.subject.slice(0, 5) : undefined,
    infoLink: doc.key ? `https://openlibrary.org${doc.key}` : undefined,
  }));
}

/** 调用 Google Books API（通过 CORS 代理） */
async function searchGoogleBooks(query: string): Promise<BookResult[]> {
  const targetUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&printType=books`;
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
  const res = await fetchWithTimeout(proxyUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Google Books 请求失败：${res.status}`);
  }
  const data = await res.json();
  const items = (data.items || []) as any[];
  return items.map((item) => {
    const v = item.volumeInfo || {};
    return {
      id: item.id || '',
      title: v.title || '未知书名',
      authors: v.authors || [],
      description: v.description || '',
      thumbnail: v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail,
      publisher: v.publisher,
      publishedDate: v.publishedDate,
      categories: v.categories,
      infoLink: v.infoLink || v.canonicalVolumeLink,
    };
  });
}

/** 判断是否为精确匹配（书名与查询相似度高） */
function isLikelyExactMatch(results: BookResult[], query: string): boolean {
  if (results.length === 0) return false;
  const q = query.trim().toLowerCase().replace(/[\s《》]/g, '');
  const top = results[0].title.trim().toLowerCase().replace(/[\s《》]/g, '');
  if (!q || !top) return false;
  return top.includes(q) || q.includes(top);
}

/** 主入口 */
export async function searchBooks(query: string): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { found: false, source: '', results: [], notice: '请输入书名' };
  }

  let results: BookResult[] = [];
  const sources: string[] = [];
  const errors: string[] = [];

  // 优先 Open Library（通过 CORS 代理）
  try {
    const ol = await searchOpenLibrary(trimmed);
    if (ol.length > 0) {
      results = results.concat(ol);
      sources.push('Open Library');
    }
  } catch (e) {
    errors.push(`Open Library: ${(e as Error).message}`);
    console.error('Open Library 检索失败：', e);
  }

  // 备用 Google Books（通过 CORS 代理，失败不阻塞）
  try {
    const google = await searchGoogleBooks(trimmed);
    if (google.length > 0) {
      // 去重：按书名+首位作者
      const existKeys = new Set(
        results.map((r) => `${r.title}|${r.authors[0] || ''}`.toLowerCase()),
      );
      const newOnes = google.filter(
        (r) => !existKeys.has(`${r.title}|${r.authors[0] || ''}`.toLowerCase()),
      );
      results = results.concat(newOnes);
      sources.push('Google Books');
    }
  } catch (e) {
    errors.push(`Google Books: ${(e as Error).message}`);
    console.error('Google Books 检索失败：', e);
  }

  // 去重（跨源）
  const seen = new Set<string>();
  results = results.filter((r) => {
    const key = `${r.title}|${r.authors[0] || ''}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  results = results.slice(0, 10);

  const found = isLikelyExactMatch(results, trimmed);
  const source = sources.join('、') || '公开书籍资源';

  let notice: string | undefined;
  if (results.length === 0) {
    // 所有源都失败或无结果
    if (errors.length > 0) {
      notice = `未能从公开资源检索到本书（${errors.join('；')}）。你可以直接点击「生成精读报告」，系统将基于书名及通用知识生成，内容可能存在偏差，请结合原书核实。`;
    } else {
      notice =
        '未在公开资源中找到本书。你可以直接点击「生成精读报告」，系统将基于书名及通用知识生成，内容可能存在偏差，请结合原书核实。';
    }
  } else if (!found) {
    notice =
      '未找到本书的精确匹配，以下为相关检索结果。报告将基于检索到的书籍信息生成，可能存在信息不完整，请在报告开头查看资料依据说明。';
  }

  return { found, source, results, notice };
}

/** 将检索结果转为可供 LLM 的资料文本 */
export function buildBookInfoText(book: BookResult): string {
  const lines: string[] = [];
  lines.push(`书名：${book.title}`);
  if (book.authors.length > 0) lines.push(`作者：${book.authors.join('、')}`);
  if (book.publisher) lines.push(`出版社：${book.publisher}`);
  if (book.publishedDate) lines.push(`出版日期：${book.publishedDate}`);
  if (book.categories && book.categories.length > 0)
    lines.push(`分类：${book.categories.join('、')}`);
  if (book.description) lines.push(`\n书籍简介：\n${book.description}`);
  return lines.join('\n');
}
