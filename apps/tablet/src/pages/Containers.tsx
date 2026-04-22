import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../../../../amplify/data/resource';
import { getDataClient } from '../lib/amplify';
import { NumberField } from '../components/ui/NumberField';

type Container = Schema['Container']['type'];

type FormState = {
  name: string;
  tareWeightKg: number | null;
  note: string;
};

const EMPTY_FORM: FormState = { name: '', tareWeightKg: null, note: '' };

async function writeAuditLog(params: {
  entityId: string;
  action: string;
  before: Container | null;
  after: Container | null;
}) {
  try {
    const client = getDataClient();
    let actor = 'unknown';
    try {
      const user = await getCurrentUser();
      actor = user.username || user.userId || 'unknown';
    } catch {
      // ignore
    }
    await client.models.AuditLog.create({
      entity: 'Container',
      entityId: params.entityId,
      action: params.action,
      before: params.before ? JSON.stringify(params.before) : null,
      after: params.after ? JSON.stringify(params.after) : null,
      actor,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[audit] 書き込み失敗', e);
  }
}

export function Containers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  async function refresh() {
    try {
      setLoading(true);
      const client = getDataClient();
      const { data, errors } = await client.models.Container.list();
      if (errors?.length) {
        setError(errors.map((e) => e.message).join(', '));
        return;
      }
      setContainers(data ?? []);
      setError(null);
    } catch (e) {
      setError(`取得に失敗しました: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(
    () =>
      [...containers]
        .filter((c) => (showInactive ? true : c.isActive))
        .sort((a, b) => {
          if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return a.name.localeCompare(b.name, 'ja');
        }),
    [containers, showInactive],
  );

  function startEdit(c: Container) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      tareWeightKg: c.tareWeightKg,
      note: c.note ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = form.name.trim();
    const tare = form.tareWeightKg;
    if (!name) {
      setError('容器名を入力してください。');
      return;
    }
    if (tare == null || tare < 0) {
      setError('風袋重量は 0 以上の数値で入力してください。');
      return;
    }
    setSubmitting(true);
    try {
      const client = getDataClient();
      const note = form.note.trim() || null;
      if (editingId) {
        const before = containers.find((c) => c.id === editingId) ?? null;
        const { data, errors } = await client.models.Container.update({
          id: editingId,
          name,
          tareWeightKg: tare,
          note,
        });
        if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
        if (data) await writeAuditLog({ entityId: data.id, action: 'update', before, after: data });
      } else {
        const { data, errors } = await client.models.Container.create({
          name,
          tareWeightKg: tare,
          isDefault: containers.length === 0,
          isActive: true,
          note,
        });
        if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
        if (data) await writeAuditLog({ entityId: data.id, action: 'create', before: null, after: data });
      }
      cancelEdit();
      await refresh();
    } catch (e) {
      setError(`保存に失敗しました: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetDefault(target: Container) {
    if (target.isDefault) return;
    setError(null);
    setSubmitting(true);
    try {
      const client = getDataClient();
      const prevDefaults = containers.filter((c) => c.isDefault && c.id !== target.id);
      for (const prev of prevDefaults) {
        const { data, errors } = await client.models.Container.update({
          id: prev.id,
          isDefault: false,
        });
        if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
        if (data) await writeAuditLog({ entityId: data.id, action: 'unset-default', before: prev, after: data });
      }
      const { data, errors } = await client.models.Container.update({
        id: target.id,
        isDefault: true,
      });
      if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
      if (data) await writeAuditLog({ entityId: data.id, action: 'set-default', before: target, after: data });
      await refresh();
    } catch (e) {
      setError(`既定変更に失敗しました: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(target: Container) {
    setError(null);
    setSubmitting(true);
    try {
      const client = getDataClient();
      const nextActive = !target.isActive;
      if (!nextActive && target.isDefault) {
        setError('既定の容器は無効化できません。先に別の容器を既定にしてください。');
        return;
      }
      const { data, errors } = await client.models.Container.update({
        id: target.id,
        isActive: nextActive,
      });
      if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
      if (data)
        await writeAuditLog({
          entityId: data.id,
          action: nextActive ? 'activate' : 'deactivate',
          before: target,
          after: data,
        });
      await refresh();
    } catch (e) {
      setError(`状態変更に失敗しました: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">容器登録</h1>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          無効な容器も表示
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">
          {editingId ? '容器を編集' : '新しい容器を追加'}
        </h2>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-slate-700">容器名</span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例: 青バケツ 大"
              required
            />
          </label>
          <NumberField
            label="風袋重量"
            unit="kg"
            value={form.tareWeightKg}
            onValueChange={(v) => setForm({ ...form, tareWeightKg: v })}
            min={0}
            step={0.01}
            smallStep={0.001}
            maxFractionDigits={3}
            required
          />
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">メモ(任意)</span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="用途など"
            />
          </label>
          <div className="sm:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-base font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              {editingId ? '更新' : '追加'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={submitting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                キャンセル
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold">登録済みの容器</h2>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-slate-500">読み込み中…</div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500">容器がまだ登録されていません。</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {visible.map((c) => (
              <li
                key={c.id}
                className={`flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between ${
                  c.isActive ? '' : 'bg-slate-50 opacity-70'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold">{c.name}</span>
                    {c.isDefault && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        ★ 既定
                      </span>
                    )}
                    {!c.isActive && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                        無効
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    風袋 {c.tareWeightKg.toFixed(3)} kg
                    {c.note ? ` / ${c.note}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    disabled={submitting}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    編集
                  </button>
                  {c.isActive && !c.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(c)}
                      disabled={submitting}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                    >
                      既定にする
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(c)}
                    disabled={submitting || (c.isActive && c.isDefault)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                      c.isActive
                        ? 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    {c.isActive ? '無効化' : '有効化'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
