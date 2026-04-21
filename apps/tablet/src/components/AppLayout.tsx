import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { AuthUser } from 'aws-amplify/auth';
import {
  HomeIcon,
  ScaleIcon,
  ClockIcon,
  CubeIcon,
  Bars3Icon,
  ChevronLeftIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import logoUrl from '@/assets/logo.png';

/* ------------------------------------------------------------------ */
/*  ナビゲーション定義                                                 */
/* ------------------------------------------------------------------ */
type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const navItems: NavItem[] = [
  { to: '/', label: 'ホーム', icon: HomeIcon },
  { to: '/measure', label: '計量する', icon: ScaleIcon },
  { to: '/history', label: '履歴', icon: ClockIcon },
  { to: '/containers', label: '容器登録', icon: CubeIcon },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
type Props = {
  user?: AuthUser;
  onSignOut?: () => void;
  children: ReactNode;
};

/* ------------------------------------------------------------------ */
/*  AppLayout                                                          */
/* ------------------------------------------------------------------ */
export function AppLayout({ user, onSignOut, children }: Props) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ---------- サイドバー ---------- */}
      <aside
        className={`flex flex-col border-r border-slate-200 bg-white text-slate-700 transition-[width] duration-200 ${
          expanded ? 'w-56' : 'w-16'
        }`}
      >
        {/* ヘッダー（社名 + トグルボタン） */}
        <div className="flex h-14 items-center">
          {expanded && (
            <div className="flex flex-1 items-center px-2">
              <img
                src={logoUrl}
                alt="小嶋屋"
                className="h-10 w-auto max-w-full object-contain"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={`flex h-14 items-center justify-center hover:bg-slate-100 ${
              expanded ? 'w-14' : 'w-full'
            }`}
            aria-label={expanded ? 'メニューを閉じる' : 'メニューを開く'}
          >
            {expanded ? (
              <ChevronLeftIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* ナビゲーションリンク */}
        <nav className="mt-2 flex flex-1 flex-col gap-1 px-2">
          {navItems.map((item) => {
            const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className={`flex items-center gap-3 rounded-lg px-2 py-3 transition-colors ${
                  active
                    ? 'bg-slate-900 font-semibold text-white'
                    : 'hover:bg-slate-100'
                }`}
              >
                <Icon className="h-6 w-6 flex-shrink-0" />
                {expanded && (
                  <span className="truncate text-sm">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ログアウト (サイドバー下部) */}
        <div className="border-t border-slate-200 px-2 py-3">
          {expanded && (
            <p className="mb-2 truncate px-2 text-xs text-slate-500">
              {user?.signInDetails?.loginId ?? ''}
            </p>
          )}
          <button
            type="button"
            onClick={onSignOut}
            title="ログアウト"
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-100"
          >
            <ArrowRightStartOnRectangleIcon className="h-6 w-6 flex-shrink-0" />
            {expanded && <span className="text-sm">ログアウト</span>}
          </button>
        </div>
      </aside>

      {/* ---------- メインエリア ---------- */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ヘッダー */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h1 className="text-lg font-bold text-slate-800">そば粉計量チェック</h1>
          <span className="text-sm text-slate-500">
            {user?.signInDetails?.loginId ?? ''}
          </span>
        </header>

        {/* コンテンツ */}
        <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
