export interface ModelPreset {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  modelName: string;
  description: string;
  recommended?: boolean;
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek-V4-Flash',
    provider: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-v4-flash',
    description: '性价比高，1M 上下文，适合长文本书籍，默认推荐',
    recommended: true,
  },
  {
    id: 'glm-4.6',
    name: 'GLM-4.6',
    provider: '智谱AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelName: 'glm-4.6',
    description: '中文理解强，长文本处理优秀',
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek-V4-Pro',
    provider: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-v4-pro',
    description: '性能最强，Agent 能力大幅提升',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o',
    description: '综合能力强，适合英文书籍',
  },
  {
    id: 'claude-3.5-sonnet',
    name: 'Claude-3.5-Sonnet',
    provider: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    modelName: 'claude-3-5-sonnet-20241022',
    description: '长文本分析与结构化输出优秀',
  },
  {
    id: 'custom',
    name: '自定义模型',
    provider: '自定义',
    baseUrl: '',
    modelName: '',
    description: '支持 OpenAI 兼容接口的任意模型',
  },
];
