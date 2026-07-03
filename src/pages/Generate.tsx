/** 报告生成页：SSE 流式输出 + 进度展示 */
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, StopCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { subscribeGenerate, abortGenerate } from '@/api/client';
import ProgressBar from '@/components/ProgressBar';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { JobEvent } from '@/lib/types';

export default function GeneratePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running');
  const [errorMsg, setErrorMsg] = useState('');
  const [reportId, setReportId] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jobId) return;
    const unsubscribe = subscribeGenerate(
      jobId,
      (evt: JobEvent) => {
        if (evt.type === 'step' && evt.step) {
          setStep(evt.step);
        } else if (evt.type === 'content' && evt.text) {
          setContent((prev) => prev + evt.text);
        } else if (evt.type === 'done' && evt.reportId) {
          setReportId(evt.reportId);
          setStatus('done');
        } else if (evt.type === 'error') {
          setErrorMsg(evt.message || '生成失败');
          setStatus('error');
        }
      },
      (err) => {
        setErrorMsg(err.message);
        setStatus('error');
      },
    );
    return unsubscribe;
  }, [jobId]);

  // 生成完成后自动跳转
  useEffect(() => {
    if (status === 'done' && reportId) {
      const timer = setTimeout(() => navigate(`/report/${reportId}`), 1200);
      return () => clearTimeout(timer);
    }
  }, [status, reportId, navigate]);

  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  const handleAbort = async () => {
    if (jobId) {
      await abortGenerate(jobId);
      setStatus('error');
      setErrorMsg('已中止生成');
    }
  };

  return (
    <div className="animate-fade-in-up space-y-4">
      {/* 状态头部 */}
      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          {status === 'running' && (
            <>
              <Loader2 size={18} className="animate-spin text-gold-500" />
              <span className="font-serif text-sm font-bold text-ink-900">
                正在生成精读报告…
              </span>
            </>
          )}
          {status === 'done' && (
            <>
              <CheckCircle2 size={18} className="text-gold-600" />
              <span className="font-serif text-sm font-bold text-ink-900">
                生成完成，正在跳转…
              </span>
            </>
          )}
          {status === 'error' && (
            <>
              <AlertCircle size={18} className="text-red-500" />
              <span className="font-serif text-sm font-bold text-ink-900">
                生成失败
              </span>
            </>
          )}
          {status === 'running' && (
            <button
              onClick={handleAbort}
              className="ml-auto flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
            >
              <StopCircle size={14} /> 中止
            </button>
          )}
        </div>
        <ProgressBar currentStep={step || 0} />
      </div>

      {/* 错误信息 */}
      {status === 'error' && errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      {/* 流式内容 */}
      {content && (
        <div
          ref={contentRef}
          className="card max-h-[60vh] overflow-y-auto p-5"
        >
          <MarkdownRenderer content={content} />
          {status === 'running' && <span className="cursor-blink" />}
        </div>
      )}

      {!content && status === 'running' && (
        <div className="card p-8 text-center text-sm text-ink-400">
          正在等待模型响应，请稍候…
        </div>
      )}
    </div>
  );
}
