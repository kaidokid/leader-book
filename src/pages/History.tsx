/** 报告历史页 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { History as HistoryIcon, Trash2, BookOpen, Loader2 } from 'lucide-react';
import { useReportStore } from '@/store/reportStore';
import { deleteReport } from '@/api/client';

const RELEVANCE_LABEL = { high: '高相关', medium: '中相关', low: '低相关' };
const RELEVANCE_STYLE = {
  high: 'bg-gold-100 text-gold-700',
  medium: 'bg-ink-100 text-ink-500',
  low: 'bg-ink-50 text-ink-400',
};

export default function HistoryPage() {
  const { reports, loading, fetchReports, removeReport } = useReportStore();

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此报告？')) return;
    await deleteReport(id);
    removeReport(id);
  };

  return (
    <div className="animate-fade-in-up space-y-5">
      <h1 className="flex items-center gap-2 font-serif text-xl font-bold text-ink-900">
        <HistoryIcon size={20} className="text-gold-500" />
        报告历史
      </h1>

      {loading && (
        <div className="flex items-center justify-center py-16 text-ink-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="card flex flex-col items-center gap-3 p-12 text-center">
          <BookOpen size={36} className="text-ink-200" />
          <p className="text-sm text-ink-400">还没有生成过报告</p>
          <Link to="/" className="btn-primary mt-2">
            去生成第一份
          </Link>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="card flex items-center gap-3 p-3">
              <Link to={`/report/${r.id}`} className="min-w-0 flex-1">
                <h3 className="line-clamp-1 font-serif text-sm font-bold text-ink-900">
                  {r.title}
                </h3>
                {r.author && (
                  <p className="text-xs text-ink-400">{r.author}</p>
                )}
                <p className="mt-0.5 text-[11px] text-ink-300">
                  {new Date(r.createdAt).toLocaleString('zh-CN')}
                  {r.readTime ? ` · 约${r.readTime}` : ''}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-300">
                  {r.source}
                </p>
              </Link>
              <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] ${
                    RELEVANCE_STYLE[r.relevance]
                  }`}
                >
                  {RELEVANCE_LABEL[r.relevance]}
                </span>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-ink-300 transition-colors hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
