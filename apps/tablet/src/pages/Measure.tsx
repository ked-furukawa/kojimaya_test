import { useEffect, useMemo, useRef, useState } from 'react';
import { CameraIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { uploadData } from 'aws-amplify/storage';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../../../../amplify/data/resource';
import { getDataClient, getStorageBucketName } from '../lib/amplify';
import { NumberField } from '../components/ui/NumberField';
import { Select } from '../components/ui/Select';

type Container = Schema['Container']['type'];
type OcrResult = Schema['OcrResult']['type'];

type Phase =
  | { kind: 'idle' }
  | { kind: 'previewed'; file: File; previewUrl: string }
  | { kind: 'uploading'; file: File; previewUrl: string }
  | { kind: 'ocr'; file: File; previewUrl: string; s3Key: string }
  | {
      kind: 'reviewing';
      file: File;
      previewUrl: string;
      s3Key: string;
      ocr: OcrResult;
    }
  | { kind: 'saving'; file: File; previewUrl: string; s3Key: string; ocr: OcrResult }
  | { kind: 'saved'; ocr: OcrResult };

function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)} kg`;
}

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
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${tone}`}>
      信頼度 {pct == null ? '—' : `${pct}%`}
    </span>
  );
}

function StableBadge({ stable }: { stable: boolean | null | undefined }) {
  if (stable === true) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
        安定マーク 点灯
      </span>
    );
  }
  if (stable === false) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
        安定マーク 未点灯
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">
      安定マーク 不明
    </span>
  );
}

export function Measure() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [tareCount, setTareCount] = useState<number>(1);
  const [hydrationRate, setHydrationRate] = useState<number | null>(null);
  const [manualValue, setManualValue] = useState<number | null>(null);
  const [targetValue, setTargetValue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preprocessedUrl, setPreprocessedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = getDataClient();
        const { data, errors } = await client.models.Container.list({
          filter: { isActive: { eq: true } },
        });
        if (cancelled) return;
        if (errors?.length) {
          setError(`容器マスタの取得に失敗しました: ${errors.map((e) => e.message).join(', ')}`);
          return;
        }
        const list = data ?? [];
        setContainers(list);
        const def = list.find((c) => c.isDefault) ?? list[0] ?? null;
        if (def) setSelectedContainerId(def.id);
      } catch (e) {
        if (!cancelled) setError(`容器マスタの取得に失敗しました: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedContainer = useMemo(
    () => containers.find((c) => c.id === selectedContainerId) ?? null,
    [containers, selectedContainerId],
  );

  const ocr = phase.kind === 'reviewing' || phase.kind === 'saving' ? phase.ocr : null;

  const effectiveGrossKg = manualValue ?? ocr?.value ?? null;

  const tareKg = selectedContainer?.tareWeightKg ?? null;
  const totalTareKg = tareKg != null ? Math.round(tareKg * tareCount * 1000) / 1000 : null;
  const netKg =
    effectiveGrossKg != null && totalTareKg != null
      ? Math.round((effectiveGrossKg - totalTareKg) * 1000) / 1000
      : null;

  const targetKg = targetValue;

  const judgment: 'OK' | 'OVER' | 'UNDER' | 'UNJUDGED' = useMemo(() => {
    if (netKg == null || targetKg == null) return 'UNJUDGED';
    const diff = netKg - targetKg;
    const tol = Math.max(0.005, targetKg * 0.01); // 暫定: 1% or 5g
    if (Math.abs(diff) <= tol) return 'OK';
    return diff > 0 ? 'OVER' : 'UNDER';
  }, [netKg, targetKg]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhase({ kind: 'previewed', file, previewUrl });
    setManualValue(null);
    setError(null);
  }

  function handleRetake() {
    if (phase.kind !== 'idle' && 'previewUrl' in phase) {
      URL.revokeObjectURL(phase.previewUrl);
    }
    if (preprocessedUrl) {
      URL.revokeObjectURL(preprocessedUrl);
      setPreprocessedUrl(null);
    }
    setPhase({ kind: 'idle' });
    setManualValue(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function preprocessImage(src: File, maxDim: number): Promise<Blob> {
    const bitmap = await createImageBitmap(src);
    const scale = Math.min(maxDim / bitmap.width, maxDim / bitmap.height, 1);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context の取得に失敗しました。');

    // Step 2-1: リサイズ
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    // Step 2-2: グレースケール + コントラスト強調(normalize)
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // グレースケール化
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    // ヒストグラムストレッチ（normalize）: 最暗→0, 最明→255 に引き伸ばし
    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    const range = max - min || 1;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.round(((data[i] - min) / range) * 255);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  }

  async function handleRunOcr() {
    if (phase.kind !== 'previewed') return;
    setError(null);
    const { file, previewUrl } = phase;
    try {
      setPhase({ kind: 'uploading', file, previewUrl });
      const resized = await preprocessImage(file, 1200);
      if (preprocessedUrl) URL.revokeObjectURL(preprocessedUrl);
      setPreprocessedUrl(URL.createObjectURL(resized));
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${stamp}.jpg`;
      const upload = await uploadData({
        path: ({ identityId }) => `photos/${identityId}/${filename}`,
        data: resized,
        options: { contentType: 'image/jpeg' },
      }).result;
      const s3Key = upload.path;

      setPhase({ kind: 'ocr', file, previewUrl, s3Key });
      const client = getDataClient();
      const bucket = getStorageBucketName();
      const { data, errors } = await client.mutations.invokeOcr({ s3Key, bucket });
      if (errors?.length) {
        throw new Error(errors.map((e) => e.message).join(', '));
      }
      if (!data) {
        throw new Error('OCR 結果が空でした。');
      }
      setPhase({ kind: 'reviewing', file, previewUrl, s3Key, ocr: data });
    } catch (e) {
      setError(`OCR 実行に失敗しました: ${(e as Error).message}`);
      setPhase({ kind: 'previewed', file, previewUrl });
    }
  }

  async function handleSave() {
    if (phase.kind !== 'reviewing') return;
    if (effectiveGrossKg == null) {
      setError('保存するには OCR 値か手動補正値が必要です。');
      return;
    }
    setError(null);
    const { file, previewUrl, s3Key, ocr: currentOcr } = phase;
    setPhase({ kind: 'saving', file, previewUrl, s3Key, ocr: currentOcr });
    try {
      const client = getDataClient();
      let operator = 'unknown';
      try {
        const user = await getCurrentUser();
        operator = user.username || user.userId || 'unknown';
      } catch {
        // ignore
      }
      const { errors } = await client.models.Measurement.create({
        imageS3Key: s3Key,
        ocrValueKg: currentOcr.value ?? null,
        ocrConfidence: currentOcr.confidence ?? null,
        ocrStable: currentOcr.stable ?? null,
        ocrRawText: currentOcr.rawText ?? null,
        manualValueKg: manualValue,
        containerId: selectedContainer?.id ?? null,
        containerTareSnapshot: selectedContainer?.tareWeightKg ?? null,
        tareContainerCount: tareCount,
        hydrationRatePercent: hydrationRate,
        netWeightKg: netKg,
        targetWeightKg: targetKg,
        judgment,
        operator,
        measuredAt: new Date().toISOString(),
      });
      if (errors?.length) {
        throw new Error(errors.map((e) => e.message).join(', '));
      }
      URL.revokeObjectURL(previewUrl);
      setPhase({ kind: 'saved', ocr: currentOcr });
      setManualValue(null);
      setTargetValue(null);
      setHydrationRate(null);
      setTareCount(1);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setError(`保存に失敗しました: ${(e as Error).message}`);
      setPhase({ kind: 'reviewing', file, previewUrl, s3Key, ocr: currentOcr });
    }
  }

  const busy = phase.kind === 'uploading' || phase.kind === 'ocr' || phase.kind === 'saving';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">計量する</h1>

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">1. 容器を選択</h2>
        {containers.length === 0 ? (
          <p className="text-sm text-slate-500">
            登録済みの容器がありません。「容器登録」から追加してください。
          </p>
        ) : (
          <div className="space-y-3">
            <Select<string>
              value={selectedContainerId}
              onValueChange={setSelectedContainerId}
              ariaLabel="使用する容器を選択"
              options={containers.map((c) => ({
                value: c.id,
                textLabel: c.name,
                label: (
                  <span className="flex items-center gap-2">
                    <span className="truncate">
                      {c.name}
                      <span className="text-slate-500">
                        (風袋 {c.tareWeightKg.toFixed(2)} kg)
                      </span>
                    </span>
                    {c.isDefault && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        ★ 既定
                      </span>
                    )}
                  </span>
                ),
              }))}
            />
            <div className="grid items-end gap-3 sm:grid-cols-[auto_1fr]">
              <NumberField
                label="使用個数"
                unit="個"
                value={tareCount}
                onValueChange={(v) => setTareCount(v ?? 0)}
                min={0}
                max={30}
                step={1}
                allowDecimal={false}
              />
              <div className="text-sm text-slate-600">
                {tareCount === 0 ? (
                  <span className="text-amber-700">
                    個数 0: 風袋を引かず、計量値をそのまま正味とします。
                  </span>
                ) : tareKg != null ? (
                  <>
                    風袋合計 ={' '}
                    <span className="font-semibold text-slate-900">
                      {tareKg.toFixed(2)} kg × {tareCount} = {totalTareKg?.toFixed(2)} kg
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">2. 計量機の表示部を撮影</h2>
        {phase.kind === 'idle' || phase.kind === 'saved' ? (
          <label className="flex h-48 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-emerald-400 hover:bg-emerald-50">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <span className="inline-flex items-center gap-2 text-base">
              <CameraIcon className="h-6 w-6" />
              タップして撮影 / 画像を選択
            </span>
          </label>
        ) : (
          'previewUrl' in phase && (
            <div className="space-y-3">
              <div className={`grid gap-2 ${preprocessedUrl ? 'grid-cols-2' : ''}`}>
                <div>
                  <div className="mb-1 text-center text-xs text-slate-500">元画像</div>
                  <img
                    src={phase.previewUrl}
                    alt="元画像"
                    className="max-h-80 w-full rounded-lg object-contain"
                  />
                </div>
                {preprocessedUrl && (
                  <div>
                    <div className="mb-1 text-center text-xs text-slate-500">前処理後（Bedrock に送信）</div>
                    <img
                      src={preprocessedUrl}
                      alt="前処理後"
                      className="max-h-80 w-full rounded-lg object-contain"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={handleRetake}
                  disabled={busy}
                >
                  撮り直し
                </button>
                {phase.kind === 'previewed' && (
                  <button
                    type="button"
                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-base font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                    onClick={handleRunOcr}
                  >
                    検出実行
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </section>

      {(phase.kind === 'uploading' || phase.kind === 'ocr') && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800">
          <div className="mb-2 text-base font-semibold">
            {phase.kind === 'uploading' ? '画像をアップロード中…' : '検出実行中…'}
          </div>
          <div className="mx-auto h-2 w-32 overflow-hidden rounded-full bg-emerald-200">
            <div className="h-full w-1/2 animate-pulse bg-emerald-500" />
          </div>
        </section>
      )}

      {ocr && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">3. 結果確認</h2>

          <div className="rounded-xl bg-slate-900 p-6 text-center text-white">
            <div className="text-sm opacity-70">OCR 読み取り値</div>
            <div className="my-2 font-mono text-6xl font-bold tracking-wider">
              {formatKg(ocr.value)}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <ConfidenceBadge value={ocr.confidence} />
              <StableBadge stable={ocr.stable} />
            </div>
            {ocr.warnings && ocr.warnings.length > 0 && (
              <div className="mt-3 text-xs text-amber-300">
                <ExclamationTriangleIcon className="inline h-4 w-4" /> {ocr.warnings.filter(Boolean).join(' / ')}
              </div>
            )}
            {ocr.rawText && (
              <div className="mt-2 text-xs opacity-60">raw: {ocr.rawText}</div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="手動補正値"
              unit="kg"
              value={manualValue}
              onValueChange={setManualValue}
              min={0}
              step={0.01}
              maxFractionDigits={2}
              allowClear
              placeholder="未入力ならOCR値"
            />
            <NumberField
              label="指示重量"
              unit="kg"
              value={targetValue}
              onValueChange={setTargetValue}
              min={0}
              step={0.01}
              maxFractionDigits={2}
              allowClear
              placeholder="未入力なら判定なし"
            />
            <NumberField
              className="sm:col-span-2"
              label="加水率"
              unit="%"
              value={hydrationRate}
              onValueChange={setHydrationRate}
              min={0}
              max={100}
              step={0.5}
              smallStep={0.1}
              maxFractionDigits={1}
              allowClear
              placeholder="任意"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-600">採用 総重量</dt>
              <dd className="text-right font-semibold">{formatKg(effectiveGrossKg)}</dd>
              <dt className="text-slate-600">
                風袋合計(
                {selectedContainer?.name ?? '未選択'} × {tareCount})
              </dt>
              <dd className="text-right font-semibold">{formatKg(totalTareKg)}</dd>
              <dt className="border-t border-slate-300 pt-2 text-slate-700">正味重量</dt>
              <dd className="border-t border-slate-300 pt-2 text-right text-lg font-bold text-emerald-700">
                {formatKg(netKg)}
              </dd>
              {hydrationRate != null && (
                <>
                  <dt className="text-slate-600">加水率</dt>
                  <dd className="text-right font-semibold">
                    {hydrationRate.toFixed(1)} %
                  </dd>
                </>
              )}
              {targetKg != null && (
                <>
                  <dt className="text-slate-600">指示重量</dt>
                  <dd className="text-right font-semibold">{formatKg(targetKg)}</dd>
                  <dt className="text-slate-700">判定</dt>
                  <dd className="text-right">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold ${
                        judgment === 'OK'
                          ? 'bg-emerald-100 text-emerald-800'
                          : judgment === 'OVER'
                            ? 'bg-rose-100 text-rose-800'
                            : judgment === 'UNDER'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {judgment}
                    </span>
                  </dd>
                </>
              )}
            </dl>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              onClick={handleRetake}
              disabled={busy}
            >
              撮り直し
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-sky-600 px-4 py-3 text-base font-bold text-white shadow hover:bg-sky-700 disabled:opacity-50"
              onClick={handleSave}
              disabled={busy || effectiveGrossKg == null}
            >
              {phase.kind === 'saving' ? '保存中…' : '保存'}
            </button>
          </div>
        </section>
      )}

      {phase.kind === 'saved' && (
        <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-800">
          <span className="inline-flex items-center gap-2">
            <CheckCircleIcon className="h-6 w-6" />
            保存しました。続けて計量する場合は上から撮影してください。
          </span>
        </section>
      )}
    </div>
  );
}
