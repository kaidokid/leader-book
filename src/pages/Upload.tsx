/** 书籍上传页 */
import { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, Loader2, CheckCircle2, ArrowLeft, AlertCircle, MessageCircle } from 'lucide-react';
import { uploadBook } from '@/api/client';
import { useModelStore } from '@/store/modelStore';
import { startGenerate } from '@/api/client';
import type { UploadResult } from '@/lib/types';

/** 检测当前是否在微信内置浏览器中 */
function isInWeChatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('micromessenger');
}

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wechatInputRef = useRef<HTMLInputElement>(null);
  // 直接订阅 config 字段，确保配置变化时组件重新渲染
  const config = useModelStore((s) => s.config);
  const toApiConfig = useModelStore((s) => s.toApiConfig);
  const configured = Boolean(config.apiKey && config.baseUrl && config.modelName);

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const inWeChat = useMemo(() => isInWeChatBrowser(), []);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['pdf', 'txt', 'epub'].includes(ext || '')) {
        setError('仅支持 PDF / TXT / EPUB 格式');
        return;
      }
      setUploading(true);
      setError('');
      setResult(null);
      try {
        const res = await uploadBook(file);
        setResult(res);
        setTitle(res.inferredTitle);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleGenerate = async () => {
    if (!result) return;
    if (!configured) {
      setError('请先在「设置」页面配置模型 API Key');
      setTimeout(() => navigate('/settings'), 1200);
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const { jobId } = await startGenerate({
        mode: 'upload',
        bookText: result.extractedText,
        bookTitle: title || result.inferredTitle,
        modelConfig: toApiConfig(),
      });
      navigate(`/generate/${jobId}`);
    } catch (err) {
      setError((err as Error).message);
      setGenerating(false);
    }
  };

  return (
    <div className="animate-fade-in-up space-y-5">
      <button
        onClick={() => navigate('/')}
        className="flex items-center text-xs text-ink-500 hover:text-gold-600"
      >
        <ArrowLeft size={14} className="mr-1" /> 返回首页
      </button>

      <h1 className="font-serif text-xl font-bold text-ink-900">上传一本书</h1>

      {/* 上传区 —— 用 label 包裹 input，兼容性更好 */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        htmlFor="main-file-input"
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors ${
          dragging
            ? 'border-gold-400 bg-gold-50'
            : 'border-ink-200 bg-paper-50 hover:border-gold-300'
        } ${uploading ? 'pointer-events-none' : ''}`}
      >
        {uploading ? (
          <>
            <Loader2 className="animate-spin text-gold-500" size={32} />
            <p className="text-sm text-ink-500">正在提取文本…</p>
          </>
        ) : (
          <>
            <UploadCloud size={32} className="text-gold-500" />
            <p className="text-sm font-medium text-ink-700">
              点击或拖拽文件到这里
            </p>
            <p className="text-xs text-ink-400">支持 PDF / TXT / EPUB，最大 100MB</p>
          </>
        )}
        <input
          id="main-file-input"
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.epub"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            // 重置 value，便于重复选择同一文件
            e.target.value = '';
          }}
        />
      </label>

      {/* 从微信聊天中选择 —— 用 label 包裹 input，避免 button.click() 被微信 WebView 拦截；
          不设 accept 属性，微信才会弹出含「聊天文件」入口的底部菜单 */}
      <div className="space-y-2">
        <label
          htmlFor="wechat-file-input"
          className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 ${
            uploading ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <MessageCircle size={16} />
          {inWeChat ? '从微信聊天中选择文件' : '选择文件'}
        </label>
        {inWeChat ? (
          <p className="text-center text-[11px] text-ink-400">
            点击后微信会弹出底部菜单，选择「聊天文件」即可从任一会话中选 PDF / TXT / EPUB
          </p>
        ) : (
          <div className="rounded-lg bg-paper-100 p-3 text-[11px] leading-relaxed text-ink-500">
            <p className="font-medium text-ink-600">无法直接访问微信聊天文件？</p>
            <p className="mt-1">
              在微信里收到书籍文件后，点击「保存到手机」，微信会提示保存路径。回到本页点击上方按钮，在该路径下即可找到文件。
            </p>
          </div>
        )}
        <input
          id="wechat-file-input"
          ref={wechatInputRef}
          type="file"
          // 关键：不设 accept，微信才会弹出含「聊天文件」入口的完整菜单
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {result?.warning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <p className="leading-relaxed">{result.warning}</p>
        </div>
      )}

      {/* 提取结果 */}
      {result && (
        <div className="card space-y-4 p-5">
          <div className="flex items-center gap-2 text-gold-700">
            <CheckCircle2 size={18} />
            <span className="font-medium">文本提取完成</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-paper-100 p-3">
              <p className="text-ink-400">文件名</p>
              <p className="mt-0.5 line-clamp-1 font-medium text-ink-800">
                {result.fileName}
              </p>
            </div>
            <div className="rounded-lg bg-paper-100 p-3">
              <p className="text-ink-400">提取字数</p>
              <p className="mt-0.5 font-mono font-medium text-ink-800">
                {result.charCount.toLocaleString()} 字
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-600">
              书名确认
            </label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入书名"
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-ink-600">内容预览</p>
            <div className="max-h-32 overflow-y-auto rounded-lg bg-paper-100 p-3 text-xs leading-relaxed text-ink-500">
              {result.preview || '（无可预览内容）'}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary w-full"
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" /> 提交中…
              </>
            ) : (
              <>
                <FileText size={16} /> 生成精读报告
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
