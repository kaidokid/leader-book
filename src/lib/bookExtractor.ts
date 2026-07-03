/**
 * 书籍文本提取服务（浏览器端版本）：支持 PDF / TXT / EPUB
 * TXT: 优先 UTF-8（含 BOM 检测），失败回退 GBK / GB18030
 * PDF: 使用 pdfjs-dist（注意：对扫描版或自定义编码字体的 PDF 可能乱码）
 * EPUB: 使用 jszip 解压并按 spine 顺序拼接 XHTML 正文
 */
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import * as cheerio from 'cheerio';

// 设置 pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface ExtractResult {
  text: string;
  charCount: number;
  preview: string;
  inferredTitle: string;
  /** 编码或提取警告（如 PDF 乱码提示），无则 undefined */
  warning?: string;
}

/** 从文件名推断书名（去除扩展名与常见干扰词） */
function inferTitle(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '');
  return base
    .replace(/[\[（(].*?[\]）)]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** 尝试用 UTF-8 解码 buffer，若无效（含替换符 U+FFFD 或非法字节）则返回 null */
function tryUtf8(buffer: Uint8Array): string | null {
  // 有 UTF-8 BOM
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer.slice(3));
  }
  // 用 TextDecoder fatal 模式验证 UTF-8 有效性
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const text = decoder.decode(buffer);
    // 额外检查：如果解码成功但包含大量替换符，也视为无效
    const replacementCount = (text.match(/\ufffd/g) || []).length;
    if (replacementCount > text.length * 0.01) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

/** 统计字符串中可读中文字符占比，用于判断是否乱码 */
function readableRatio(text: string): number {
  if (!text) return 0;
  const sample = text.slice(0, 2000);
  const readable = (sample.match(/[\u4e00-\u9fff\u3000-\u303f\w\s,.!?;:'"()【】《》、。，！？；：""''（）\-]/g) || []).length;
  return readable / sample.length;
}

/** 尝试修复双重编码乱码
 * 场景：原文本是 UTF-8 字节序列，但被错误地以 Latin-1 方式解码成字符串
 * 典型表现：中文「借势」显示为「åå¿」（每个 UTF-8 字节被当作一个 Latin-1 字符）
 * 修复：把每个字符码点当字节重新组合，再用 UTF-8 解码
 */
function tryFixDoubleEncoding(text: string): string | null {
  if (!text || text.length < 10) return null;

  // 检测：统计 Latin-1 补充字符（U+0080-U+00FF）占比
  const latin1Chars = (text.match(/[\u0080-\u00FF]/g) || []).length;
  if (latin1Chars < text.length * 0.2) return null;

  // 检查所有字符是否都在 Latin-1 范围内（码点 <= 255）
  // 若有码点 > 255 的字符，说明不是纯 Latin-1 双重编码，不修复
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 255) return null;
  }

  try {
    // 把字符串转换成字节数组（每个字符码点 = 一个字节值）
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i);
    }
    // 用 UTF-8 重新解码
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const fixed = decoder.decode(bytes);

    // 验证修复结果：修复后可读字符占比应显著提升
    const beforeRatio = readableRatio(text);
    const afterRatio = readableRatio(fixed);
    if (afterRatio > beforeRatio + 0.2) {
      return fixed;
    }
    return null;
  } catch {
    return null;
  }
}

/** 提取 PDF 文本 */
async function extractPdf(file: File): Promise<{ text: string; warning?: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    text += pageText + '\n\n';
  }
  text = text.replace(/\u0000/g, '').trim();

  // 尝试修复双重编码乱码（对中文 PDF 常见问题）
  const fixed = tryFixDoubleEncoding(text);
  if (fixed) {
    text = fixed;
  }

  // 乱码检测与警告
  let warning: string | undefined;
  if (text.length === 0) {
    warning =
      'PDF 未提取到任何文本，可能是扫描版 PDF（纯图片，无文本层）。建议：1) 换用 TXT 或 EPUB 格式；2) 或使用「书名检索」功能。';
  } else if (text.length > 100 && readableRatio(text) < 0.5) {
    warning =
      'PDF 文本提取可能存在乱码（pdf-parse 对部分中文 PDF 支持有限，尤其是扫描版或自定义字体编码的 PDF）。建议：1) 换用 TXT 或 EPUB 格式；2) 或使用「书名检索」功能。';
  } else if (text.length < 5000) {
    warning =
      `提取的文本较少（仅 ${text.length} 字），可能是扫描版 PDF、或 PDF 文本层不完整。建议换用 TXT 或 EPUB 格式以获得完整内容，或使用「书名检索」功能。`;
  }

  return { text, warning };
}

/** 提取 TXT 文本，自动检测编码（UTF-8 BOM → UTF-8 → GBK → GB18030） */
async function extractTxt(file: File): Promise<{ text: string; warning?: string }> {
  const buffer = new Uint8Array(await file.arrayBuffer());

  // 1. 尝试 UTF-8
  const utf8Text = tryUtf8(buffer);
  if (utf8Text !== null) {
    return { text: utf8Text.replace(/\r\n/g, '\n').trim() };
  }

  // 2. 回退 GBK
  try {
    const gbkText = new TextDecoder('gbk').decode(buffer);
    if (gbkText && !gbkText.includes('\ufffd')) {
      return { text: gbkText.replace(/\r\n/g, '\n').trim() };
    }
  } catch {
    // ignore
  }

  // 3. 回退 GB18030（GBK 超集，覆盖更多字符）
  try {
    const gb18030Text = new TextDecoder('gb18030').decode(buffer);
    return { text: gb18030Text.replace(/\r\n/g, '\n').trim() };
  } catch {
    // ignore
  }

  // 4. 最后回退：直接 UTF-8 解码（可能乱码但至少有内容）
  return {
    text: new TextDecoder('utf-8').decode(buffer).replace(/\r\n/g, '\n').trim(),
    warning: 'TXT 文件编码无法自动识别，预览可能存在乱码。建议将文件另存为 UTF-8 编码后重试。',
  };
}

/** 从 buffer 提取 HTML/XML 文本，自动检测编码
 * 1. 检查 XML/HTML 声明中的 encoding 属性
 * 2. 尝试 UTF-8（fatal 模式）
 * 3. 回退 GBK / GB18030
 * 4. 尝试修复双重编码
 */
function decodeHtmlBuffer(buffer: Uint8Array): string {
  // 先尝试从 XML 声明中获取编码
  const head = new TextDecoder('utf-8').decode(buffer.slice(0, 200));
  const encodingMatch = head.match(/encoding\s*=\s*["']([^"']+)["']/i);
  const declaredEncoding = encodingMatch ? encodingMatch[1].toLowerCase() : '';

  // 如果声明了 GBK / GB18030，优先使用
  if (declaredEncoding === 'gbk' || declaredEncoding === 'gb2312' || declaredEncoding === 'gb18030') {
    try {
      return new TextDecoder('gb18030').decode(buffer);
    } catch {
      // ignore
    }
  }

  // 尝试 UTF-8
  const utf8Text = tryUtf8(buffer);
  if (utf8Text !== null) {
    return utf8Text;
  }

  // 回退 GBK
  try {
    const gbkText = new TextDecoder('gbk').decode(buffer);
    if (gbkText && !gbkText.includes('\ufffd')) {
      return gbkText;
    }
  } catch {
    // ignore
  }

  // 回退 GB18030
  try {
    return new TextDecoder('gb18030').decode(buffer);
  } catch {
    // ignore
  }

  // 最后回退 UTF-8 解码，并尝试修复双重编码
  const raw = new TextDecoder('utf-8').decode(buffer);
  const fixed = tryFixDoubleEncoding(raw);
  return fixed || raw;
}

/** 将 HTML 转为纯文本，保留段落结构 */
function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  // 移除脚本与样式
  $('script,style,head').remove();
  // 将块级元素转为换行
  $('p,div,br,h1,h2,h3,h4,h5,h6,li,tr').append('\n');
  const text = $('body').text() || $.root().text();
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** POSIX 风格的 dirname */
function posixDirname(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx === -1 ? '' : p.slice(0, idx);
}

/** POSIX 风格的 join */
function posixJoin(dir: string, file: string): string {
  if (!dir) return file;
  return dir.replace(/\/$/, '') + '/' + file.replace(/^\//, '');
}

/** 提取 EPUB 文本：解压并按 spine 顺序拼接 XHTML 正文 */
async function extractEpub(file: File): Promise<{ text: string; warning?: string }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // 1. 读取 container.xml 定位 OPF
  const containerMatches = zip.filter((relativePath) => relativePath.endsWith('container.xml'));
  const containerFile = containerMatches[0];
  if (!containerFile) {
    // 回退：直接拼接所有 XHTML
    const xhtmlFiles = zip.filter((relativePath) => /\.x?html?$/i.test(relativePath));
    const parts: string[] = [];
    for (const f of xhtmlFiles) {
      const buf = await f.async('uint8array');
      parts.push(htmlToText(decodeHtmlBuffer(buf)));
    }
    return { text: parts.join('\n\n') };
  }

  const containerBuf = await containerFile.async('uint8array');
  const container = cheerio.load(decodeHtmlBuffer(containerBuf), { xml: true });
  const opfPath = container('rootfile').attr('full-path') || '';
  const opfDir = posixDirname(opfPath);

  // 2. 解析 OPF：manifest + spine
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    const xhtmlFiles = zip.filter((relativePath) => /\.x?html?$/i.test(relativePath));
    const parts: string[] = [];
    for (const f of xhtmlFiles) {
      const buf = await f.async('uint8array');
      parts.push(htmlToText(decodeHtmlBuffer(buf)));
    }
    return { text: parts.join('\n\n') };
  }

  const opfBuf = await opfFile.async('uint8array');
  const opf = cheerio.load(decodeHtmlBuffer(opfBuf), { xml: true });

  // manifest: id -> href
  const manifest = new Map<string, string>();
  opf('manifest item').each((_, el) => {
    const id = opf(el).attr('id') || '';
    const href = opf(el).attr('href') || '';
    if (id && href) manifest.set(id, href);
  });

  // spine: 有序 idref 列表
  const spineIds: string[] = [];
  opf('spine itemref').each((_, el) => {
    const idref = opf(el).attr('idref') || '';
    if (idref) spineIds.push(idref);
  });

  let parts: string[];
  if (spineIds.length === 0) {
    // 无 spine 时按 manifest 顺序提取
    parts = [];
    for (const href of manifest.values()) {
      const full = posixJoin(opfDir, href);
      const entry = zip.file(full);
      if (entry) {
        const buf = await entry.async('uint8array');
        parts.push(htmlToText(decodeHtmlBuffer(buf)));
      } else {
        parts.push('');
      }
    }
  } else {
    // 3. 按 spine 顺序提取文本
    parts = [];
    for (const id of spineIds) {
      const href = manifest.get(id);
      if (!href) continue;
      const full = posixJoin(opfDir, href);
      const entry = zip.file(full);
      if (!entry) continue;
      const buf = await entry.async('uint8array');
      parts.push(htmlToText(decodeHtmlBuffer(buf)));
    }
  }

  const text = parts.join('\n\n').trim();
  return { text };
}

/** 主入口：根据扩展名分发提取器 */
export async function extractBook(file: File): Promise<ExtractResult> {
  const fileName = file.name;
  const dotIdx = fileName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? fileName.slice(dotIdx).toLowerCase() : '';
  let text = '';
  let warning: string | undefined;

  if (ext === '.pdf') {
    const r = await extractPdf(file);
    text = r.text;
    warning = r.warning;
  } else if (ext === '.txt') {
    const r = await extractTxt(file);
    text = r.text;
    warning = r.warning;
  } else if (ext === '.epub') {
    const r = await extractEpub(file);
    text = r.text;
    warning = r.warning;
  } else {
    throw new Error(`暂不支持的文件类型：${ext}（支持 PDF / TXT / EPUB）`);
  }

  const charCount = text.length;
  const preview = text.slice(0, 500);

  return { text, charCount, preview, inferredTitle: inferTitle(fileName), warning };
}
