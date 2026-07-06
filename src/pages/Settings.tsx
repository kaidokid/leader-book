/** 设置页：模型配置 + 数据管理 */
import { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Star,
} from 'lucide-react';
import { useModelStore } from '@/store/modelStore';
import { getModelPresets, testModel, deleteReport } from '@/api/client';
import { useReportStore } from '@/store/reportStore';

export default function SettingsPage() {
  const modelStore = useModelStore();
  const { reports, fetchReports, removeReport } = useReportStore();

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    getModelPresets().then(modelStore.setPresets).catch(() => {});
    fetchReports();
  }, [modelStore.setPresets, fetchReports]);

  const { presets, config } = modelStore;
  const isCustom = config.presetId === 'custom';

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testModel({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        modelName: config.modelName,
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, message: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('确认清除所有历史报告？此操作不可撤销。')) return;
    // 纯前端版本：通过 client 调用 IndexedDB 删除
    for (const r of reports) {
      removeReport(r.id);
      try {
        await deleteReport(r.id);
      } catch {
        // 忽略删除失败
      }
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <h1 className="flex items-center gap-2 font-serif text-xl font-bold text-ink-900">
        <SettingsIcon size={20} className="text-gold-500" />
        模型配置
      </h1>

      {/* 模型预设选择 */}
      <section>
        <h2 className="mb-2 text-xs font-medium text-ink-500">选择模型</h2>
        <div className="space-y-2">
          {presets.map((p) => {
            const active = config.presetId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => modelStore.selectPreset(p.id)}
                className={`card flex w-full items-center gap-3 p-3 text-left transition-all ${
                  active ? 'ring-2 ring-gold-400' : 'hover:border-gold-300'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-serif text-sm font-bold text-ink-900">
                      {p.name}
                    </span>
                    {p.recommended && (
                      <span className="flex items-center gap-0.5 rounded bg-gold-100 px-1.5 py-0.5 text-[10px] text-gold-700">
                        <Star size={9} /> 推荐
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-400">{p.provider}</p>
                  <p className="mt-0.5 text-[11px] text-ink-500">{p.description}</p>
                </div>
                {active && (
                  <CheckCircle2 size={18} className="flex-shrink-0 text-gold-500" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* API Key */}
      <section>
        <label className="mb-1 block text-xs font-medium text-ink-500">
          API Key <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            className="input pr-10 font-mono"
            placeholder="请输入 API Key"
            value={config.apiKey}
            onChange={(e) => modelStore.setApiKey(e.target.value)}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-gold-600"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-ink-400">
          密钥仅存储在本地浏览器，不会上传
        </p>
      </section>

      {/* Base URL（自定义时可编辑） */}
      <section>
        <label className="mb-1 block text-xs font-medium text-ink-500">
          Base URL
        </label>
        <input
          className="input font-mono text-xs"
          placeholder="https://..."
          value={config.baseUrl}
          onChange={(e) => modelStore.setBaseUrl(e.target.value)}
          disabled={!isCustom}
        />
      </section>

      {/* 模型名称（自定义时可编辑） */}
      <section>
        <label className="mb-1 block text-xs font-medium text-ink-500">
          模型名称
        </label>
        <input
          className="input font-mono text-xs"
          placeholder="model-name"
          value={config.modelName}
          onChange={(e) => modelStore.setModelName(e.target.value)}
          disabled={!isCustom}
        />
      </section>

      {/* 测试连接 */}
      <button
        onClick={handleTest}
        disabled={testing || !config.apiKey || !config.baseUrl || !config.modelName}
        className="btn-secondary w-full"
      >
        {testing ? (
          <>
            <Loader2 size={16} className="animate-spin" /> 测试中…
          </>
        ) : (
          '测试连接'
        )}
      </button>

      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-lg p-3 text-xs ${
            testResult.ok
              ? 'border border-green-200 bg-green-50 text-green-700'
              : 'border border-red-200 bg-red-50 text-red-600'
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle size={16} className="flex-shrink-0 mt-0.5" />
          )}
          <p className="break-all">{testResult.message}</p>
        </div>
      )}

      {/* 数据管理 */}
      <section className="border-t border-paper-300 pt-5">
        <h2 className="mb-2 text-xs font-medium text-ink-500">数据管理</h2>
        <button
          onClick={handleClearAll}
          disabled={reports.length === 0}
          className="flex w-full items-center gap-2 rounded-lg border border-red-200 px-4 py-3 text-sm text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40"
        >
          <Trash2 size={15} />
          清除所有历史报告（{reports.length}）
        </button>
      </section>

      {/* 关于 */}
      <section className="rounded-lg bg-paper-200/60 p-4 text-xs text-ink-400">
        <p className="font-medium text-ink-500">关于</p>
        <p className="mt-1">
          精读萃取 · 基于 leader-book-skill 十步萃取流程，为管理者快速榨干一本书。
        </p>
        <p className="mt-2">
          作者：Mercury
          <br />
          邮箱：
          <a
            href="mailto:siweiwang555@foxmail.com"
            className="text-gold-600 hover:text-gold-700"
          >
            siweiwang555@foxmail.com
          </a>
        </p>
      </section>
    </div>
  );
}
