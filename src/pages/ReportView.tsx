/** 报告查看页 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Download,
  Trash2,
  Loader2,
  Check,
} from 'lucide-react';
import { getReport, deleteReport } from '@/api/client';
import { useReportStore } from '@/store/reportStore';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { Report } from '@/lib/types';

const RELEVANCE_LABEL = { high: '高相关', medium: '中相关', low: '低相关' };

export default function ReportViewPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const removeReport = useReportStore((s) => s.removeReport);

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!reportId) return;
    setLoading(true);
    getReport(reportId)
      .then((data) => setReport(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [reportId]);

  const handleCopy = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `精读报告_${report.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!reportId || !confirm('确认删除此报告？')) return;
    await deleteReport(reportId);
    removeReport(reportId);
    navigate('/history');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-400">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <p className="text-center text-sm text-red-500">{error || '报告不存在'}</p>
        <button onClick={() => navigate('/history')} className="btn-secondary w-full">
          返回历史
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-xs text-ink-500 hover:text-gold-600"
        >
          <ArrowLeft size={14} className="mr-1" /> 返回
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs text-ink-600 hover:border-gold-400 hover:text-gold-600"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? '已复制' : '复制'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs text-ink-600 hover:border-gold-400 hover:text-gold-600"
          >
            <Download size={13} /> 导出
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50"
          >
            <Trash2 size={13} /> 删除
          </button>
        </div>
      </div>

      {/* 报告正文 */}
      <article className="card p-5 md:p-8">
        <MarkdownRenderer content={report.content} />
      </article>

      {/* 底部元信息 */}
      <div className="space-y-1 rounded-lg bg-paper-200/60 p-3 text-xs text-ink-500">
        <p>
          <span className="text-ink-400">生成日期：</span>
          {new Date(report.createdAt).toLocaleString('zh-CN')}
        </p>
        <p>
          <span className="text-ink-400">相关度：</span>
          {RELEVANCE_LABEL[report.relevance]}
          {report.readTime ? ` · 阅读建议约${report.readTime}` : ''}
        </p>
        <p>
          <span className="text-ink-400">资料来源：</span>
          {report.source}
        </p>
      </div>
    </div>
  );
}
