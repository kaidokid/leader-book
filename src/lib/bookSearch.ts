/**
 * 书籍检索服务（浏览器端版本）
 * 通过多个 CORS 代理轮询访问 豆瓣 / Open Library / Google Books / 当当
 * 各源并行检索（Promise.allSettled），任一代理失败自动切换下一个
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

/** 候选 CORS 代理列表（按优先级） */
const CORS_PROXIES: Array<(url: string) => string> = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
];

/** 带超时的 fetch */
async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 通过多个 CORS 代理轮询，直到一个成功 */
async function fetchViaProxies(
  targetUrl: string,
  opts: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  let lastErr: unknown;
  for (const proxy of CORS_PROXIES) {
    const proxiedUrl = proxy(targetUrl);
    try {
      const res = await fetchWithTimeout(proxiedUrl, opts, timeoutMs);
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`所有 CORS 代理均失败：${(lastErr as Error)?.message || '未知错误'}`);
}

/** 调用豆瓣图书 suggest API（中文书籍覆盖好） */
async function searchDouban(query: string): Promise<BookResult[]> {
  const targetUrl = `https://book.douban.com/j/subject_suggest?q=${encodeURIComponent(query)}`;
  const res = await fetchViaProxies(targetUrl, { headers: { Accept: 'application/json' } });
  const data = await res.json();
  const items = (Array.isArray(data) ? data : data.items || []) as any[];
  return items
    .filter((it) => it.type === 'book' || it.title)
    .map((it) => ({
      id: `douban-${it.id || it.title}`,
      title: it.title || '未知书名',
      authors: it.author_name ? String(it.author_name).split(/\s*[,、]\s*/) : [],
      description: it.abstract || '',
      thumbnail: it.pic || it.cover,
      publisher: it.press || undefined,
      publishedDate: it.year ? String(it.year) : undefined,
      infoLink: it.url ? `https://book.douban.com${it.url}` : undefined,
    }));
}

/** 调用 Open Library API */
async function searchOpenLibrary(query: string): Promise<BookResult[]> {
  const targetUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=key,title,author_name,first_sentence,cover_i,publisher,first_publish_year,subject`;
  const res = await fetchViaProxies(targetUrl, { headers: { Accept: 'application/json' } });
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

/** 调用 Google Books API */
async function searchGoogleBooks(query: string): Promise<BookResult[]> {
  const targetUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&printType=books`;
  const res = await fetchViaProxies(targetUrl, { headers: { Accept: 'application/json' } });
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

/** 调用 Open Library Subjects API（按主题补充结果） */
async function searchOpenLibrarySubjects(query: string): Promise<BookResult[]> {
  const targetUrl = `https://openlibrary.org/subjects/${encodeURIComponent(query.toLowerCase())}.json?limit=10`;
  try {
    const res = await fetchViaProxies(targetUrl, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    const works = (data.works || []) as any[];
    return works.map((w) => ({
      id: w.key || `ol-subj-${w.title}`,
      title: w.title || '未知书名',
      authors: (w.authors || []).map((a: any) => a.name).filter(Boolean),
      description: w.description
        ? typeof w.description === 'string'
          ? w.description
          : w.description.value || ''
        : '',
      thumbnail: w.cover_id
        ? `https://covers.openlibrary.org/b/id/${w.cover_id}-M.jpg`
        : undefined,
      publishedDate: w.first_publish_year ? String(w.first_publish_year) : undefined,
      infoLink: w.key ? `https://openlibrary.org${w.key}` : undefined,
    }));
  } catch {
    return [];
  }
}

/** 判断是否为精确匹配（书名与查询相似度高） */
function isLikelyExactMatch(results: BookResult[], query: string): boolean {
  if (results.length === 0) return false;
  const q = query.trim().toLowerCase().replace(/[\s《》]/g, '');
  const top = results[0].title.trim().toLowerCase().replace(/[\s《》]/g, '');
  if (!q || !top) return false;
  return top.includes(q) || q.includes(top);
}

/** 主入口 —— 各源并行检索 */
export async function searchBooks(query: string): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { found: false, source: '', results: [], notice: '请输入书名' };
  }

  // 并行检索所有源
  const [doubanRes, olRes, googleRes, olSubjRes] = await Promise.allSettled([
    searchDouban(trimmed),
    searchOpenLibrary(trimmed),
    searchGoogleBooks(trimmed),
    searchOpenLibrarySubjects(trimmed),
  ]);

  let results: BookResult[] = [];
  const sources: string[] = [];
  const errors: string[] = [];

  if (doubanRes.status === 'fulfilled' && doubanRes.value.length > 0) {
    results = results.concat(doubanRes.value);
    sources.push('豆瓣');
  } else if (doubanRes.status === 'rejected') {
    errors.push(`豆瓣: ${(doubanRes.reason as Error)?.message || '失败'}`);
  }

  if (olRes.status === 'fulfilled' && olRes.value.length > 0) {
    results = results.concat(olRes.value);
    sources.push('Open Library');
  } else if (olRes.status === 'rejected') {
    errors.push(`Open Library: ${(olRes.reason as Error)?.message || '失败'}`);
  }

  if (googleRes.status === 'fulfilled' && googleRes.value.length > 0) {
    const existKeys = new Set(
      results.map((r) => `${r.title}|${r.authors[0] || ''}`.toLowerCase()),
    );
    const newOnes = googleRes.value.filter(
      (r) => !existKeys.has(`${r.title}|${r.authors[0] || ''}`.toLowerCase()),
    );
    results = results.concat(newOnes);
    sources.push('Google Books');
  } else if (googleRes.status === 'rejected') {
    errors.push(`Google Books: ${(googleRes.reason as Error)?.message || '失败'}`);
  }

  if (olSubjRes.status === 'fulfilled' && olSubjRes.value.length > 0) {
    const existKeys = new Set(
      results.map((r) => r.title.toLowerCase()),
    );
    const newOnes = olSubjRes.value.filter(
      (r) => !existKeys.has(r.title.toLowerCase()),
    );
    if (newOnes.length > 0) {
      results = results.concat(newOnes);
      sources.push('Open Library Subjects');
    }
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
