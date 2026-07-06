/** 模型配置状态：持久化到 localStorage */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModelPreset, ModelConfig } from '@/lib/types';

interface ModelStore {
  presets: ModelPreset[];
  config: ModelConfig;
  setPresets: (presets: ModelPreset[]) => void;
  selectPreset: (presetId: string) => void;
  setApiKey: (apiKey: string) => void;
  setBaseUrl: (baseUrl: string) => void;
  setModelName: (modelName: string) => void;
  /** 是否已完成有效配置 */
  isConfigured: () => boolean;
  /** 导出供后端使用的配置 */
  toApiConfig: () => { apiKey: string; baseUrl: string; modelName: string };
}

const DEFAULT_CONFIG: ModelConfig = {
  presetId: 'deepseek-v4-flash',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  modelName: 'deepseek-v4-flash',
};

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      presets: [],
      config: DEFAULT_CONFIG,
      setPresets: (presets) => set({ presets }),
      selectPreset: (presetId) => {
        const preset = get().presets.find((p) => p.id === presetId);
        if (!preset) return;
        set({
          config: {
            ...get().config,
            presetId,
            baseUrl: preset.id === 'custom' ? get().config.baseUrl : preset.baseUrl,
            modelName: preset.id === 'custom' ? get().config.modelName : preset.modelName,
          },
        });
      },
      setApiKey: (apiKey) =>
        set({ config: { ...get().config, apiKey } }),
      setBaseUrl: (baseUrl) =>
        set({ config: { ...get().config, baseUrl } }),
      setModelName: (modelName) =>
        set({ config: { ...get().config, modelName } }),
      isConfigured: () => {
        const { apiKey, baseUrl, modelName } = get().config;
        return Boolean(apiKey && baseUrl && modelName);
      },
      toApiConfig: () => {
        const { apiKey, baseUrl, modelName } = get().config;
        return { apiKey, baseUrl, modelName };
      },
    }),
    { name: 'leader-book-model-config' },
  ),
);
