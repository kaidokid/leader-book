/** 首页：工作台 */
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, Search, BookOpen, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { useReportStore } from '@/store/reportStore';
import { useModelStore } from '@/store/modelStore';

const RELEVANCE_LABEL = { high: '高相关', medium: '中相关', low: '低相关' };
const RELEVANCE_STYLE = {
  high: 'bg-gold-100 text-gold-700',
  medium: 'bg-ink-100 text-ink-500',
  low: 'bg-ink-50 text-ink-400',
};

export default function Home() {
  const navigate = useNavigate();
  const { reports, fetchReports } = useReportStore();
  // 直接订阅 config，确保配置变化时组件重新渲染
  const config = useModelStore((s) => s.config);
  const configured = Boolean(config.apiKey && config.baseUrl && config.modelName);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const recentReports = reports.slice(0, 3);

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* 品牌区 */}
      <section className="rounded-2xl bg-ink-900 p-6 text-center text-paper-100 shadow-md">
        <h1 className="font-serif text-2xl font-bold text-gold-300">
          精读萃取
        </h1>
        <p className="mt-1 text-sm text-ink-300">
          30 分钟读完一本书，把知识变成决策力
        </p>
        <p className="mt-2 text-xs text-ink-400">
          基于 leader-book-skill 十步萃取流程
        </p>
      </section>

      {/* 模型未配置提示 */}
      {!configured && (
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded-lg border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-gold-700 transition-colors hover:bg-gold-100"
        >
          <AlertCircle size={16} />
          <span>尚未配置模型 API Key，点击去配置</span>
          <ArrowRight size={14} className="ml-auto" />
        </Link>
      )}

      {/* 快速入口 */}
      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/upload')}
          className="group flex flex-col items-center gap-2 rounded-2xl border border-paper-300 bg-paper-50 p-5 text-center transition-all hover:border-gold-400 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-gold-300 transition-transform group-hover:scale-110">
            <Upload size={22} />
          </div>
          <span className="font-serif text-sm font-bold text-ink-900">上传一本书</span>
          <span className="text-[11px] text-ink-400">PDF / TXT / EPUB</span>
        </button>
        <button
          onClick={() => navigate('/search')}
          className="group flex flex-col items-center gap-2 rounded-2xl border border-paper-300 bg-paper-50 p-5 text-center transition-all hover:border-gold-400 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-gold-300 transition-transform group-hover:scale-110">
            <Search size={22} />
          </div>
          <span className="font-serif text-sm font-bold text-ink-900">检索一本书</span>
          <span className="text-[11px] text-ink-400">书名搜索公开资源</span>
        </button>
      </section>

      {/* 使用引导 */}
      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-serif text-sm font-bold text-ink-900">
          <Sparkles size={15} className="text-gold-500" />
          三步生成精读报告
        </h2>
        <ol className="space-y-2 text-xs text-ink-600">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gold-100 font-bold text-gold-700">
              1
            </span>
            <span>上传书籍文件或检索书名</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gold-100 font-bold text-gold-700">
              2
            </span>
            <span>配置模型 API Key（设置页）</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gold-100 font-bold text-gold-700">
              3
            </span>
            <span>启动生成，流式输出 10 步精读报告</span>
          </li>
        </ol>
      </section>

      {/* 最近报告 */}
      {recentReports.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-sm font-bold text-ink-900">
              <BookOpen size={15} className="text-gold-500" />
              最近报告
            </h2>
            <Link
              to="/history"
              className="flex items-center text-xs text-gold-600 hover:text-gold-700"
            >
              全部 <ArrowRight size={12} className="ml-0.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentReports.map((r) => (
              <Link
                key={r.id}
                to={`/report/${r.id}`}
                className="card flex items-center gap-3 p-3 transition-all hover:border-gold-300"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-1 font-serif text-sm font-bold text-ink-900">
                    {r.title}
                  </h3>
                  {r.author && (
                    <p className="text-xs text-ink-400">{r.author}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-ink-300">
                    {new Date(r.createdAt).toLocaleDateString('zh-CN')}
                    {r.readTime ? ` · 约${r.readTime}` : ''}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded px-2 py-0.5 text-[10px] ${
                    RELEVANCE_STYLE[r.relevance]
                  }`}
                >
                  {RELEVANCE_LABEL[r.relevance]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
