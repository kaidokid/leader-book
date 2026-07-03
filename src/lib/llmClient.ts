/**
 * 大模型客户端：封装 OpenAI 兼容接口，支持流式输出（浏览器端版本）
 * 浏览器 fetch 原生支持 ReadableStream，逻辑与 Node 版基本一致
 * 注意 CORS：DeepSeek API 支持 CORS 可直连；GLM API 可能不支持，需反代
 */
export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onContent: (text: string) => void;
  onError?: (err: Error) => void;
  signal?: AbortSignal;
}

/** 规范化 baseUrl，确保以 /chat/completions 结尾
 * 兼容以下形式：
 *  - https://open.bigmodel.cn/api/paas/v4  → /v4/chat/completions
 *  - https://api.deepseek.com/v1            → /v1/chat/completions
 *  - https://api.openai.com/v1              → /v1/chat/completions
 *  - https://any.com/base/path              → /base/path/v1/chat/completions
 */
function normalizeChatUrl(baseUrl: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '');
  if (base.endsWith('/chat/completions')) return base;
  // 以 /v{数字} 结尾（如 /v1 /v4），直接追加 /chat/completions
  if (/\/v\d+$/.test(base)) return `${base}/chat/completions`;
  // 已包含 /v{数字}/ 路径段，直接追加 chat/completions
  if (/\/v\d+\//.test(base)) return `${base}/chat/completions`;
  // 默认追加 /v1/chat/completions
  return `${base}/v1/chat/completions`;
}

/** 判断是否为 CORS / 网络层失败（fetch 抛出 TypeError） */
function isCorsOrNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('cors') ||
    msg.includes('network') ||
    err.name === 'TypeError'
  );
}

/** 构建 CORS / 网络失败的友好提示 */
function buildCorsErrorMessage(err: Error): string {
  return `模型请求失败：可能是 CORS 跨域限制或 API Key 无效。错误：${err.message}。建议：1) 检查 API Key；2) 换用支持 CORS 的模型（如 DeepSeek）；3) 使用自定义反代地址。`;
}

/**
 * 流式调用 LLM，逐 token 回调
 * 兼容 OpenAI / DeepSeek / GLM 等 OpenAI 兼容接口
 * Anthropic 需使用兼容层（OpenAI 格式），baseUrl 指向其兼容端点
 */
export async function streamChat(
  config: LLMConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
): Promise<string> {
  const url = normalizeChatUrl(config.baseUrl);
  const fullText: string[] = [];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };

  const body = JSON.stringify({
    model: config.modelName,
    messages,
    stream: true,
    temperature: 0.7,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: callbacks.signal,
    });
  } catch (err) {
    // fetch 层面的失败：CORS / 网络 / DNS 等
    if ((err as Error).name === 'AbortError') {
      return fullText.join('');
    }
    if (isCorsOrNetworkError(err)) {
      const friendly = new Error(buildCorsErrorMessage(err as Error));
      callbacks.onError?.(friendly);
      throw friendly;
    }
    callbacks.onError?.(err as Error);
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`模型请求失败（${res.status}）：${errText.slice(0, 300)}`);
  }

  if (!res.body) {
    throw new Error('模型返回空响应体');
  }

  // 浏览器端 res.body 即 ReadableStream
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 以 \n\n 分隔事件
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const evt of events) {
        const lines = evt.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            return fullText.join('');
          }
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullText.push(delta);
              callbacks.onContent(delta);
            }
          } catch {
            // 忽略无法解析的行
          }
        }
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return fullText.join('');
    }
    if (isCorsOrNetworkError(err)) {
      const friendly = new Error(buildCorsErrorMessage(err as Error));
      callbacks.onError?.(friendly);
      throw friendly;
    }
    callbacks.onError?.(err as Error);
    throw err;
  }

  return fullText.join('');
}

/** 测试模型配置连通性 */
export async function testModel(config: LLMConfig): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const result = await streamChat(
      config,
      [
        { role: 'system', content: '你是一个测试助手。' },
        { role: 'user', content: '请回复"连接成功"四个字。' },
      ],
      { onContent: () => {}, signal: AbortSignal.timeout(15000) },
    );
    return {
      ok: true,
      message: result ? `连接成功：${result.slice(0, 50)}` : '连接成功',
    };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
