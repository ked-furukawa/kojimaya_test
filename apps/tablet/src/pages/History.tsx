import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUrl } from 'aws-amplify/storage';
import type { Schema } from '../../../../amplify/data/resource';
import { getDataClient } from '../lib/amplify';

type Measurement = Schema['Measurement']['type'];

const PAGE_SIZE = 20;

/* ---------- helpers ---------- */

function formatKg(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)} kg`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultDateFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return toDateInputValue(d);
}

function defaultDateTo(): string {
  return toDateInputValue(new Date());
}

/* ---------- badges (reuse patterns from Measure.tsx) ---------- */

function ConfidenceBadge({ value }: { value: number | null | undefined }) {
  const pct = value == null ? null : Math.round(value * 100);
  const tone =
    pct == null
      ? 'bg-slate-200 text-slate-600'
      : pct >= 90
        ? 'bg-emerald-100 text-emerald-800'
        : pct >= 70
          ? 'bg-amber-100 text-amber-800'
          : 'bg-rose-100 text-rose-800';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      信頼度 {pct == null ? '—' : `${pct}%`}
    </span>
  );
}

function JudgmentBadge({ value }: { value: string | null | undefined }) {
  const tone =
    value === 'OK'
      ? 'bg-emerald-100 text-emerald-800'
      : value === 'OVER'
        ? 'bg-rose-100 text-rose-800'
        : value === 'UNDER'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>
      {value ?? 'UNJUDGED'}
    </span>
  );
}

/* ---------- thumbnail with lazy signed URL ---------- */

function Thumbnail({ s3Key, onClick }: { s3Key: string; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getUrl({ path: s3Key });
        if (!cancelled) setUrl(result.url.toString());
      } catch {
        // ignore – show placeholder
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [s3Key]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100"
    >
      {url ? (
        <img src={url} alt="計量画像" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
          読込中
        </div>
      )}
    </button>
  );
}

/* ---------- detail modal ---------- */

function DetailModal({
  measurement,
  containerName,
  onClose,
}: {
  measurement: Measurement;
  containerName: string;
  onClose: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageExpanded, setImageExpanded] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getUrl({ path: measurement.imageS3Key });
        if (!cancelled) setImageUrl(result.url.toString());
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [measurement.imageS3Key]);

  // close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (imageExpanded) setImageExpanded(false);
        else onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, imageExpanded]);

  const m = measurement;

  return (
    <>
      {/* backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 z-40 bg-black/50"
        onClick={(e) => {
          if (e.target === backdropRef.current) onClose();
        }}
      >
        {/* modal body */}
        <div className="absolute inset-x-4 top-8 bottom-8 z-50 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:inset-x-auto">
          {/* header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-bold">計量詳細</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              閉じる
            </button>
          </div>

          {/* scrollable content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* image */}
            {imageUrl ? (
              <button
                type="button"
                onClick={() => setImageExpanded(true)}
                className="w-full"
              >
                <img
                  src={imageUrl}
                  alt="計量画像"
                  className="max-h-64 w-full rounded-lg object-contain bg-slate-100"
                />
                <div className="mt-1 text-center text-xs text-slate-400">タップで拡大</div>
              </button>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-400">
                画像を読み込み中…
              </div>
            )}

            {/* data grid */}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-slate-500">計量日時</dt>
              <dd className="font-semibold">{formatDateTime(m.measuredAt)}</dd>

              <dt className="text-slate-500">操作者</dt>
              <dd>{m.operator ?? '—'}</dd>

              <dt className="text-slate-500">OCR 読み取り値</dt>
              <dd className="flex items-center gap-2">
                <span className="font-semibold">{formatKg(m.ocrValueKg)}</span>
                <ConfidenceBadge value={m.ocrConfidence} />
              </dd>

              <dt className="text-slate-500">安定マーク</dt>
              <dd>
                {m.ocrStable === true
                  ? '点灯'
                  : m.ocrStable === false
                    ? '未点灯'
                    : '—'}
              </dd>

              {m.manualValueKg != null && (
                <>
                  <dt className="text-slate-500">手動補正値</dt>
                  <dd className="font-semibold text-sky-700">{formatKg(m.manualValueKg)}</dd>
                </>
              )}

              <dt className="text-slate-500">容器</dt>
              <dd>{containerName || '—'}</dd>

              <dt className="text-slate-500">風袋(1個あたり・当時)</dt>
              <dd>{formatKg(m.containerTareSnapshot)}</dd>

              <dt className="text-slate-500">使用個数</dt>
              <dd>
                {m.tareContainerCount ?? 1} 個
                {m.tareContainerCount === 0 ? '(風袋引きなし)' : ''}
              </dd>

              {m.containerTareSnapshot != null && (
                <>
                  <dt className="text-slate-500">風袋合計</dt>
                  <dd>
                    {formatKg(
                      m.containerTareSnapshot * (m.tareContainerCount ?? 1),
                    )}
                  </dd>
                </>
              )}

              <dt className="text-slate-500">加水率</dt>
              <dd>
                {m.hydrationRatePercent != null
                  ? `${m.hydrationRatePercent.toFixed(1)} %`
                  : '—'}
              </dd>

              <dt className="border-t border-slate-200 pt-3 text-slate-700 font-semibold">
                正味重量
              </dt>
              <dd className="border-t border-slate-200 pt-3 text-lg font-bold text-emerald-700">
                {formatKg(m.netWeightKg)}
              </dd>

              {m.targetWeightKg != null && (
                <>
                  <dt className="text-slate-500">指示重量</dt>
                  <dd>{formatKg(m.targetWeightKg)}</dd>
                </>
              )}

              <dt className="text-slate-500">判定</dt>
              <dd>
                <JudgmentBadge value={m.judgment} />
              </dd>

              {m.note && (
                <>
                  <dt className="text-slate-500">メモ</dt>
                  <dd>{m.note}</dd>
                </>
              )}

              {m.ocrRawText && (
                <>
                  <dt className="text-slate-500">OCR 生テキスト</dt>
                  <dd className="break-all text-xs text-slate-500">{m.ocrRawText}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* fullscreen image overlay */}
      {imageExpanded && imageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          onClick={() => setImageExpanded(false)}
        >
          <img
            src={imageUrl}
            alt="拡大画像"
            className="max-h-full max-w-full object-contain"
            style={{ touchAction: 'pinch-zoom' }}
          />
        </div>
      )}
    </>
  );
}

/* ---------- CSV export ---------- */

function exportCsv(measurements: Measurement[], containerMap: Map<string, string>) {
  const headers = [
    '計量日時',
    '操作者',
    'OCR値(kg)',
    '信頼度',
    '安定',
    '手動補正値(kg)',
    '容器名',
    '風袋1個あたり(kg)',
    '使用個数',
    '風袋合計(kg)',
    '加水率(%)',
    '正味重量(kg)',
    '指示重量(kg)',
    '判定',
    'メモ',
  ];
  const rows = measurements.map((m) => {
    const count = m.tareContainerCount ?? 1;
    const totalTare =
      m.containerTareSnapshot != null ? m.containerTareSnapshot * count : null;
    return [
      m.measuredAt,
      m.operator ?? '',
      m.ocrValueKg?.toString() ?? '',
      m.ocrConfidence != null ? (m.ocrConfidence * 100).toFixed(0) + '%' : '',
      m.ocrStable == null ? '' : m.ocrStable ? '安定' : '不安定',
      m.manualValueKg?.toString() ?? '',
      containerMap.get(m.containerId ?? '') ?? '',
      m.containerTareSnapshot?.toString() ?? '',
      count.toString(),
      totalTare != null ? totalTare.toString() : '',
      m.hydrationRatePercent != null ? m.hydrationRatePercent.toFixed(1) : '',
      m.netWeightKg?.toString() ?? '',
      m.targetWeightKg?.toString() ?? '',
      m.judgment ?? '',
      m.note ?? '',
    ];
  });
  const bom = '\uFEFF';
  const csv =
    bom +
    [headers, ...rows]
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `計量履歴_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- main component ---------- */

export function History() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [containerMap, setContainerMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // filters
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [operatorFilter, setOperatorFilter] = useState('');
  const [judgmentFilter, setJudgmentFilter] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // detail modal
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // build filter object
  const buildFilter = useCallback(() => {
    const filter: Record<string, unknown> = {};

    if (dateFrom || dateTo) {
      const from = dateFrom ? `${dateFrom}T00:00:00.000Z` : '1970-01-01T00:00:00.000Z';
      const to = dateTo ? `${dateTo}T23:59:59.999Z` : '2099-12-31T23:59:59.999Z';
      filter.measuredAt = { between: [from, to] };
    }

    if (operatorFilter.trim()) {
      filter.operator = { contains: operatorFilter.trim() };
    }

    if (judgmentFilter) {
      filter.judgment = { eq: judgmentFilter };
    }

    return Object.keys(filter).length > 0 ? filter : undefined;
  }, [dateFrom, dateTo, operatorFilter, judgmentFilter]);

  // fetch containers for name resolution
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = getDataClient();
        const { data } = await client.models.Container.list();
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const c of data ?? []) {
          map.set(c.id, c.name);
        }
        setContainerMap(map);
      } catch {
        // non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // fetch measurements
  const fetchMeasurements = useCallback(
    async (append = false, token?: string | null) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const client = getDataClient();
        const params: Record<string, unknown> = {
          limit: PAGE_SIZE,
          filter: buildFilter(),
        };
        if (token) params.nextToken = token;

        const { data, nextToken: nt, errors } = await client.models.Measurement.list(params);
        if (errors?.length) {
          setError(errors.map((e) => e.message).join(', '));
          return;
        }

        const sorted = [...(data ?? [])].sort(
          (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
        );

        if (append) {
          setMeasurements((prev) => [...prev, ...sorted]);
        } else {
          setMeasurements(sorted);
        }
        setNextToken(nt ?? null);
        setError(null);
      } catch (e) {
        setError(`取得に失敗しました: ${(e as Error).message}`);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildFilter],
  );

  // initial fetch + re-fetch on filter change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchMeasurements(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchMeasurements]);

  function handleClearFilters() {
    setDateFrom(defaultDateFrom());
    setDateTo(defaultDateTo());
    setOperatorFilter('');
    setJudgmentFilter('');
  }

  const selectedMeasurement = useMemo(
    () => measurements.find((m) => m.id === selectedId) ?? null,
    [measurements, selectedId],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">履歴</h1>
        <button
          type="button"
          onClick={() => exportCsv(measurements, containerMap)}
          disabled={measurements.length === 0}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          CSV エクスポート
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* filter bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">日付(から)</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">日付(まで)</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">操作者</span>
            <input
              type="text"
              placeholder="操作者名で検索"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">判定</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={judgmentFilter}
              onChange={(e) => setJudgmentFilter(e.target.value)}
            >
              <option value="">全て</option>
              <option value="OK">OK</option>
              <option value="OVER">OVER</option>
              <option value="UNDER">UNDER</option>
              <option value="UNJUDGED">UNJUDGED</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {loading ? '読み込み中…' : `${measurements.length} 件の記録`}
          </span>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-sm font-semibold text-sky-600 hover:text-sky-800"
          >
            フィルタをクリア
          </button>
        </div>
      </section>

      {/* measurement list */}
      {loading ? (
        <div className="py-12 text-center text-slate-500">読み込み中…</div>
      ) : measurements.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          該当する計量記録がありません。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {measurements.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md"
            >
              <Thumbnail s3Key={m.imageS3Key} onClick={() => setSelectedId(m.id)} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-800">
                  {formatDateTime(m.measuredAt)}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {m.operator ?? '—'}
                  {containerMap.get(m.containerId ?? '') &&
                    ` / ${containerMap.get(m.containerId ?? '')}`}
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-emerald-700">
                    {formatKg(m.netWeightKg)}
                  </span>
                  <JudgmentBadge value={m.judgment} />
                </div>
                {m.manualValueKg != null && (
                  <div className="mt-0.5 text-xs text-sky-600">手動補正あり</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* load more */}
      {nextToken && !loading && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => void fetchMeasurements(true, nextToken)}
            disabled={loadingMore}
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingMore ? '読み込み中…' : 'もっと読み込む'}
          </button>
        </div>
      )}

      {/* detail modal */}
      {selectedMeasurement && (
        <DetailModal
          measurement={selectedMeasurement}
          containerName={containerMap.get(selectedMeasurement.containerId ?? '') ?? ''}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
