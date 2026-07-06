export interface ModelPreset {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  modelName: string;
  description: string;
  recommended?: boolean;
  /** 上下文长度（token） */
  contextLength?: number;
  /** 申请 API Key 的链接 */
  apiKeyUrl?: string;
}

/**
 * 模型预设列表（2026-07 更新）
 * 优先推荐 1M 上下文模型，适合长文本书籍精读
 */
export const MODEL_PRESETS: ModelPreset[] = [
  // ============ DeepSeek（1M 上下文，默认推荐）============
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek-V4-Flash',
    provider: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-v4-flash',
    description: '1M 上下文，价格极低，缓存命中再降 90%，长文本性价比首选',
    recommended: true,
    contextLength: 1_000_000,
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek-V4-Pro',
    provider: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-v4-pro',
    description: '1M 上下文，Agent 能力最强，推理性能国内领先',
    contextLength: 1_000_000,
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
  },

  // ============ 智谱 GLM（同一 API Key 通用）============
  {
    id: 'glm-5.2',
    name: 'GLM-5.2',
    provider: '智谱AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelName: 'glm-5.2',
    description: '智谱 2026-06 旗舰，1M 上下文，幻觉极低，中文理解顶尖',
    recommended: true,
    contextLength: 1_000_000,
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    id: 'glm-5.1',
    name: 'GLM-5.1',
    provider: '智谱AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelName: 'glm-5.1',
    description: '智谱 2026-04 开源旗舰，256K 上下文，与 GLM-5.2 共用同一 API Key',
    contextLength: 256_000,
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },

  // ============ Kimi K2.6（256K 上下文）============
  {
    id: 'kimi-k2.6',
    name: 'Kimi K2.6',
    provider: 'Moonshot AI',
    baseUrl: 'https://api.moonshot.cn/v1',
    modelName: 'kimi-k2-latest',
    description: '2026-04 发布，256K 上下文，代码能力顶尖，开源最强',
    contextLength: 256_000,
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
  },

  // ============ MiniMax M3（1M 上下文）============
  {
    id: 'minimax-m3',
    name: 'MiniMax M3',
    provider: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    modelName: 'MiniMax-M3',
    description: '2026-06 发布，1M 超长上下文，原生多模态，前沿 Coding 能力',
    contextLength: 1_000_000,
    apiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
  },

  // ============ 通义千问 Qwen Plus（1M 上下文）============
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    provider: '阿里云百炼',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelName: 'qwen-plus',
    description: '1M 上下文，多模态智能体模型，文档解析能力强',
    contextLength: 1_000_000,
    apiKeyUrl: 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
  },

  // ============ OpenAI GPT-5.4（1M 上下文）============
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-5.4',
    description: 'OpenAI 2026-03 旗舰，1M 上下文，首次融合推理与编码能力',
    contextLength: 1_000_000,
    apiKeyUrl: 'https://platform.openai.com/api-keys',
  },

  // ============ 自定义（Base URL 可编辑）============
  {
    id: 'custom',
    name: '自定义模型',
    provider: '自定义',
    baseUrl: '',
    modelName: '',
    description: '支持 OpenAI 兼容接口的任意模型，Base URL 与模型名均可自行编辑',
  },
];
