/** 书名检索页 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, ArrowLeft, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { searchBooks, startGenerate } from '@/api/client';
import { useModelStore } from '@/store/modelStore';
import BookCard from '@/components/BookCard';
import type { SearchResponse, BookResult } from '@/lib/types';

export default function SearchPage() {
  const navigate = useNavigate();
  // 直接订阅 config 字段，确保配置变化时组件重新渲染
  const config = useModelStore((s) => s.config);
  const toApiConfig = useModelStore((s) => s.toApiConfig);
  const configured = Boolean(config.apiKey && config.baseUrl && config.modelName);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    setSelectedId(null);
    try {
      const res = await searchBooks(query);
      setData(res);
      if (res.results.length > 0) setSelectedId(res.results[0].id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!data) return;
    if (!configured) {
      setError('请先在「设置」页面配置模型 API Key');
      setTimeout(() => navigate('/settings'), 1200);
      return;
    }
    // 有选中书籍时基于书籍信息生成；无结果时基于书名生成
    const book = selectedId
      ? data.results.find((b) => b.id === selectedId)
      : { id: 'by-name', title: query.trim(), authors: [], description: '' };
    if (!book) return;
    setGenerating(true);
    setError('');
    try {
      const { jobId } = await startGenerate({
        mode: 'search',
        bookInfo: book,
        found: data.found,
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

      <h1 className="font-serif text-xl font-bold text-ink-900">检索一本书</h1>

      {/* 搜索框 */}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="输入书名，如「卓有成效的管理者」"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="btn-primary px-4"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <SearchIcon size={16} />
          )}
        </button>
      </div>

      {/* 检索中提示 */}
      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-gold-300 bg-gold-50 p-3 text-xs text-gold-800">
          <Loader2 size={14} className="animate-spin text-gold-600" />
          <span>图书检索中，可能花费时间较长，请耐心等待…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 资源说明 */}
      {data?.notice && (
        <div className="flex gap-2 rounded-lg border border-gold-300 bg-gold-50 p-3 text-xs text-gold-800">
          <AlertTriangle size={16} className="flex-shrink-0 text-gold-600" />
          <p className="leading-relaxed">{data.notice}</p>
        </div>
      )}

      {/* 数据来源 */}
      {data && data.results.length > 0 && (
        <p className="text-xs text-ink-400">
          数据来源：{data.source} · 共 {data.results.length} 条结果
        </p>
      )}

      {/* 结果列表 */}
      {data && data.results.length > 0 && (
        <div className="space-y-2">
          {data.results.map((book: BookResult) => (
            <BookCard
              key={book.id}
              book={book}
              selected={selectedId === book.id}
              onSelect={() => setSelectedId(book.id)}
            />
          ))}
        </div>
      )}

      {data && data.results.length === 0 && (
        <div className="card space-y-4 p-8 text-center">
          <p className="text-sm text-ink-500">
            未检索到相关书籍的公开资料
          </p>
          <p className="text-xs text-ink-400">
            你仍可直接基于书名「{query}」生成精读报告，<br />
            模型将基于自身知识生成，内容可能存在偏差
          </p>
        </div>
      )}

      {/* 生成按钮：有选中结果 或 无结果时都允许生成 */}
      {data && (selectedId || data.results.length === 0) && (
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
      )}
    </div>
  );
}
