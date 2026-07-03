/** 应用布局壳：顶部品牌栏 + 底部导航 + 内容区 */
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, History, Settings as SettingsIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();

  const navItems = [
    { to: '/', label: '首页', icon: BookOpen },
    { to: '/history', label: '历史', icon: History },
    { to: '/settings', label: '设置', icon: SettingsIcon },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-paper-100">
      {/* 顶部品牌栏 */}
      <header className="sticky top-0 z-30 border-b border-paper-300 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-reading items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-serif text-lg font-bold text-gold-300">
              精读萃取
            </span>
            <span className="hidden text-xs text-ink-300 sm:inline">
              · 管理者读书
            </span>
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-1 text-xs text-ink-300 transition-colors hover:text-gold-300"
          >
            <SettingsIcon size={14} />
            <span>模型配置</span>
          </Link>
        </div>
      </header>

      {/* 内容区 */}
      <main className="mx-auto w-full max-w-reading flex-1 px-4 py-6 pb-24">
        {children}
      </main>

      {/* 底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-paper-300 bg-paper-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-reading items-stretch justify-around">
          {navItems.map((item) => {
            const active =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
                  active ? 'text-gold-600' : 'text-ink-400'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.5} />
                <span className={active ? 'font-medium' : ''}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
