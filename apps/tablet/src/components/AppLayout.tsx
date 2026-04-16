import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { AuthUser } from 'aws-amplify/auth';

type Props = {
  user?: AuthUser;
  onSignOut?: () => void;
  children: ReactNode;
};

export function AppLayout({ user, onSignOut, children }: Props) {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between bg-slate-900 px-6 py-4 text-white">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xl font-bold">
            そば粉計量チェック
          </Link>
          {!isHome && (
            <Link
              to="/"
              className="inline-flex items-center gap-1 rounded-lg border border-white/40 bg-white/5 px-3 py-1.5 text-sm font-semibold hover:bg-white/10"
            >
              ← ホームに戻る
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="opacity-80">{user?.signInDetails?.loginId ?? ''}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded border border-white/40 px-3 py-1 hover:bg-white/10"
          >
            ログアウト
          </button>
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
