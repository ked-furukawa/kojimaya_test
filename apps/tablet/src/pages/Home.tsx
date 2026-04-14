import { Link } from 'react-router-dom';

type MenuItem = {
  to: string;
  title: string;
  description: string;
  accent: string;
};

const menu: MenuItem[] = [
  {
    to: '/measure',
    title: '計量する',
    description: 'カメラで撮影して計量値を記録',
    accent: 'bg-emerald-600 hover:bg-emerald-700',
  },
  {
    to: '/history',
    title: '履歴',
    description: '過去の計量記録を閲覧',
    accent: 'bg-sky-600 hover:bg-sky-700',
  },
  {
    to: '/containers',
    title: '容器マスタ',
    description: '風袋容器の登録・更新',
    accent: 'bg-amber-600 hover:bg-amber-700',
  },
];

export function Home() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-8 text-2xl font-bold">メニュー</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {menu.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex h-48 flex-col justify-between rounded-2xl p-8 text-white shadow-lg transition ${item.accent}`}
          >
            <span className="text-3xl font-bold">{item.title}</span>
            <span className="text-sm opacity-90">{item.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
