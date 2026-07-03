/**
 * 报告生成服务（浏览器端版本）
 * 读取 skill 提示词，构建请求，流式调用 LLM，保存报告（IndexedDB）
 * 包含内存中的任务管理，支持流式输出与中止
 * 浏览器端用 SimpleEmitter 替代 Node EventEmitter
 */
import { streamChat, type LLMConfig, type ChatMessage } from './llmClient';
import { buildBookInfoText, type BookResult } from './bookSearch';
import { saveReport, type ReportMeta } from './reportStorage';
import { loadSkillPrompt } from './skill';

/** 10 步骤定义，用于进度展示 */
const STEPS = [
  { step: 1, title: '执行摘要' },
  { step: 2, title: '书籍定位与价值锚定' },
  { step: 3, title: '全书结构总览' },
  { step: 4, title: '逐章精粹萃取' },
  { step: 5, title: '核心框架与模型提炼' },
  { step: 6, title: '关键反常识与认知突破' },
  { step: 7, title: '管理决策启示' },
  { step: 8, title: '行动与决策清单' },
  { step: 9, title: '金句与思想锚点' },
  { step: 10, title: '延伸阅读与终极结论' },
];

export type JobEventType = 'step' | 'content' | 'done' | 'error';
export interface JobEvent {
  type: JobEventType;
  step?: number;
  title?: string;
  text?: string;
  reportId?: string;
  message?: string;
}

/** 简单的事件发射器，替代 Node 的 EventEmitter */
type EventHandler<T = unknown> = (payload: T) => void;

class SimpleEmitter {
  private handlers = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  once(event: string, handler: EventHandler): void {
    const wrapper: EventHandler = (payload) => {
      handler(payload);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  emit(event: string, payload?: unknown): void {
    const set = this.handlers.get(event);
    if (set) {
      // 复制一份避免在回调中修改集合导致迭代问题
      [...set].forEach((h) => h(payload));
    }
  }
}

interface JobState {
  id: string;
  status: 'running' | 'done' | 'error' | 'aborted';
  events: JobEvent[];
  emitter: SimpleEmitter;
  abortController: AbortController;
  fullText: string;
  reportMeta?: ReportMeta;
}

const jobs = new Map<string, JobState>();

/** 构建 user prompt —— upload 模式 */
function buildUploadUserPrompt(bookText: string, title: string): string {
  // 不再截断，现代模型（如 DSv4）支持百万级 token 上下文
  // 若文本超长，由模型自行处理或 API 层报错
  const totalChars = bookText.length;
  return [
    `请基于以下书籍全文，执行 leader-book-skill 的 10 步精读萃取流程，生成一份完整的精读报告。`,
    `书籍标题：${title}`,
    `书籍全文长度：${totalChars.toLocaleString()} 字`,
    `\n--- 书籍全文开始 ---`,
    bookText,
    `--- 书籍全文结束 ---`,
    `\n请严格按技能要求的 10 个步骤与输出模板生成报告，使用 Markdown 格式，包含 Mermaid 图表与表格。`,
    `\n重要提示：Mermaid 图表中的节点 ID 必须使用英文字母/数字，不能使用中文（中文只能出现在方括号标签内，如 A["中文标签"]）。`,
  ].join('\n');
}

/** 构建 user prompt —— search 模式 */
function buildSearchUserPrompt(book: BookResult, found: boolean): string {
  const info = buildBookInfoText(book);
  const header = found
    ? `请基于以下检索到的书籍信息，执行 leader-book-skill 的 10 步精读萃取流程，生成一份完整的精读报告。`
    : `未检索到本书的完整原文。请基于以下检索到的书籍元信息（书名、作者、简介、目录摘要等）以及你对该书的了解，尽可能完整地执行 leader-book-skill 的 10 步精读萃取流程。由于缺乏完整原文，请在报告开头明确标注「资料来源说明」，说明本报告基于检索到的公开资料生成，部分章节内容可能为基于已知信息的合理推演，建议读者结合原书核实。`;
  return [
    header,
    `\n--- 检索到的书籍信息 ---`,
    info,
    `--- 信息结束 ---`,
    `\n请严格按技能要求的 10 个步骤与输出模板生成报告，使用 Markdown 格式，包含 Mermaid 图表与表格。`,
    found ? '' : `\n重要：报告开头必须包含「资料来源说明」段落，明确告知读者本报告的资料依据与可能局限。`,
  ].join('\n');
}

/** 根据流式内容推断当前步骤（启发式：匹配 ## 标题） */
function inferStep(text: string): { step: number; title: string } | null {
  // 匹配最后的 "## 〇/一/二..." 或 "## 步骤" 等
  const stepPatterns = [
    /执行摘要|〇/,
    /书籍定位|定位与价值|一、/,
    /全书结构|结构总览|二、/,
    /逐章精粹|逐章|三、/,
    /核心框架|框架与模型|四、/,
    /反常识|认知突破|五、/,
    /管理决策启示|决策启示|六、/,
    /行动与决策|行动清单|七、/,
    /金句|思想锚点|八、/,
    /延伸阅读|终极结论|九、/,
  ];
  for (let i = stepPatterns.length - 1; i >= 0; i--) {
    const re = new RegExp(`##\\s*[^\\n]*(${stepPatterns[i].source})`, 'm');
    if (re.test(text)) {
      return { step: i + 1, title: STEPS[i].title };
    }
  }
  return null;
}

/** 从生成内容中提取相关度 */
function extractRelevance(text: string): 'high' | 'medium' | 'low' {
  const m = text.match(/相关度[：:]\s*(高|中|低)/);
  if (m) {
    return m[1] === '高' ? 'high' : m[1] === '中' ? 'medium' : 'low';
  }
  return 'medium';
}

/** 从生成内容中提取阅读时间建议 */
function extractReadTime(text: string): string | undefined {
  const m = text.match(/阅读建议[：:][^\n]*?(\d+\s*分钟)[^\n]*/);
  return m ? m[1] : undefined;
}

export interface GenerateParams {
  mode: 'upload' | 'search';
  bookText?: string;
  bookTitle?: string;
  bookInfo?: BookResult;
  found?: boolean;
  modelConfig: LLMConfig;
}

/** 创建并启动生成任务 */
export function startGenerateJob(params: GenerateParams): string {
  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const emitter = new SimpleEmitter();
  const abortController = new AbortController();

  const job: JobState = {
    id: jobId,
    status: 'running',
    events: [],
    emitter,
    abortController,
    fullText: '',
  };
  jobs.set(jobId, job);

  // 异步执行生成
  runGenerate(jobId, params).catch((err) => {
    console.error(`任务 ${jobId} 异常：`, err);
  });

  return jobId;
}

async function runGenerate(jobId: string, params: GenerateParams): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  const emit = (evt: JobEvent) => {
    job.events.push(evt);
    job.emitter.emit('event', evt);
  };

  try {
    const system = await loadSkillPrompt();
    let user = '';
    let title = '';
    let source = '';

    if (params.mode === 'upload') {
      title = params.bookTitle || '未命名书籍';
      user = buildUploadUserPrompt(params.bookText || '', title);
      source = `用户上传书籍文件（${title}）全文提取`;
    } else {
      const book = params.bookInfo!;
      title = book.title;
      user = buildSearchUserPrompt(book, params.found ?? false);
      source = `书名检索（${params.found ? '精确匹配' : '相关匹配'}）：${book.title}${
        book.authors.length ? ' - ' + book.authors.join('、') : ''
      }`;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];

    let lastStep = 0;
    const fullText = await streamChat(
      params.modelConfig,
      messages,
      {
        onContent: (delta) => {
          job.fullText += delta;
          // 推断步骤切换
          const cur = inferStep(job.fullText);
          if (cur && cur.step > lastStep) {
            lastStep = cur.step;
            emit({ type: 'step', step: cur.step, title: cur.title });
          }
          emit({ type: 'content', text: delta });
        },
        signal: job.abortController.signal,
      },
    );

    if (job.abortController.signal.aborted) {
      job.status = 'aborted';
      return;
    }

    // 保存报告（IndexedDB 异步存储）
    const relevance = extractRelevance(fullText);
    const readTime = extractReadTime(fullText);
    const author =
      params.mode === 'search'
        ? params.bookInfo?.authors?.join('、')
        : undefined;

    const reportMeta = await saveReport(fullText, {
      id: '',
      title,
      author,
      relevance,
      source,
      readTime,
    });

    job.reportMeta = reportMeta;
    job.status = 'done';
    emit({ type: 'done', reportId: reportMeta.id });
  } catch (err) {
    job.status = 'error';
    emit({ type: 'error', message: (err as Error).message });
  } finally {
    job.emitter.emit('end');
  }
}

/** 获取任务状态与已缓冲事件 */
export function getJob(jobId: string): JobState | undefined {
  return jobs.get(jobId);
}

/** 订阅任务事件（用于 SSE） */
export function subscribeJob(
  jobId: string,
  onEvent: (evt: JobEvent) => void,
  onEnd: () => void,
): () => void {
  const job = jobs.get(jobId);
  if (!job) {
    onEnd();
    return () => {};
  }
  // 回放已缓冲事件
  for (const evt of job.events) {
    onEvent(evt);
  }
  if (job.status === 'done' || job.status === 'error' || job.status === 'aborted') {
    onEnd();
    return () => {};
  }
  const handler = (evt: JobEvent) => onEvent(evt);
  job.emitter.on('event', handler);
  job.emitter.once('end', () => {
    job.emitter.off('event', handler);
    onEnd();
  });
  return () => {
    job.emitter.off('event', handler);
  };
}

/** 中止任务 */
export function abortJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'running') return false;
  job.abortController.abort();
  return true;
}

/** 清理已完成任务（保留最近 20 个） */
export function cleanupJobs(): void {
  if (jobs.size <= 20) return;
  const toRemove: string[] = [];
  for (const [id, job] of jobs) {
    if (job.status !== 'running') toRemove.push(id);
  }
  toRemove.sort();
  while (toRemove.length > 0 && jobs.size > 20) {
    const id = toRemove.shift()!;
    jobs.delete(id);
  }
}
