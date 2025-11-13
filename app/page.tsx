"use client";

import {
  Bell,
  Copyright,
  Download,
  HelpCircle,
  Link2,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    __bellDayTracker?: {
      day: string;
      times: Set<string>;
    };
    webkitAudioContext?: typeof AudioContext;
  }
}

type BellRow = {
  id: string;
  time: string;
};

type StoredPayload = {
  label: string;
  rows: { time: string }[];
};

const STORAGE_KEY = "school-bell-settings@v1";
const DEFAULT_LABEL = "標準設定";
const DEFAULT_TIMES = [
  "08:15",
];

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createRows = (times: string[]) => times.map((time) => ({ id: newId(), time }));

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const formatTime = (date: Date, withSeconds = true) =>
  date.toLocaleTimeString("ja-JP", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    timeZone: "Asia/Tokyo",
  });

const URL_PARAM_TIMES = "time";
const URL_PARAM_LABEL = "label";

const getBasePath = () =>
  process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/^\/|\/$/g, "") ?? "";

const buildAudioSourcePath = () => {
  const segments = [getBasePath(), "audio", "chime.wav"].filter(
    Boolean,
  );
  return `/${segments.join("/")}`;
};

const audioSourcePath = buildAudioSourcePath();

const TIME_HHMM = /^\d{2}:\d{2}$/;
const TIME_PARAM = /^\d{4}$/;

const toParamTime = (time: string) => time.replace(":", "");

const fromParamTime = (value: string) => {
  if (!TIME_PARAM.test(value)) return null;
  const hh = value.slice(0, 2);
  const mm = value.slice(2);
  if (Number(hh) > 23 || Number(mm) > 59) return null;
  return `${hh}:${mm}`;
};

const parseTimesParam = (value: string) =>
  value
    .split("-")
    .map((segment) => fromParamTime(segment.trim()))
    .filter((time): time is string => Boolean(time))
    .sort((a, b) => a.localeCompare(b));

const buildTimesParam = (rows: BellRow[]) =>
  rows
    .map((row) => row.time)
    .filter((time) => TIME_HHMM.test(time))
    .map(toParamTime)
    .join("-");

export default function Home() {
  const [panel, setPanel] = useState<"settings" | "guide" | "copyright" | null>(null);
  const [label, setLabel] = useState(DEFAULT_LABEL);
  const [rows, setRows] = useState<BellRow[]>(() => createRows(DEFAULT_TIMES));
  const [now, setNow] = useState<Date>(() => new Date());
  const [statusMessage, setStatusMessage] = useState("");
  const [importError, setImportError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const statusTimer = useRef<number | null>(null);
  const hasLoadedFromQuery = useRef(false);
  const lastSyncedTimes = useRef<string | null>(null);
  const lastSyncedLabel = useRef<string | null>(null);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.time.localeCompare(b.time)),
    [rows],
  );

  const nextBell = useMemo(() => {
    if (!sortedRows.length) return null;
    const minutesNow =
      now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    return (
      sortedRows.find((row) => toMinutes(row.time) >= minutesNow - 1 / 60) ??
      sortedRows[0]
    );
  }, [now, sortedRows]);

  const handleStatus = useCallback((message: string) => {
    setStatusMessage(message);
    if (statusTimer.current) {
      window.clearTimeout(statusTimer.current);
    }
    statusTimer.current = window.setTimeout(() => setStatusMessage(""), 4000);
  }, []);

  const handleTestChime = useCallback(async () => {
    setImportError("");
    await playChime(audioRef.current);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const timesValue = params.get(URL_PARAM_TIMES);
    if (!timesValue) return;
    const parsedTimes = parseTimesParam(timesValue);
    const labelValue = params.get(URL_PARAM_LABEL)?.trim() || DEFAULT_LABEL;
    if (parsedTimes.length) {
      setRows(createRows(parsedTimes));
    }
    setLabel(labelValue);
    hasLoadedFromQuery.current = true;
    lastSyncedTimes.current = timesValue;
    lastSyncedLabel.current = labelValue;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          label: labelValue,
          rows: parsedTimes.map((time) => ({ time })),
        }),
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    if (!fromStorage || hasLoadedFromQuery.current) return;
    try {
      const parsed: StoredPayload = JSON.parse(fromStorage);
      const nextLabel = parsed.label?.trim() || DEFAULT_LABEL;
      const nextRows = Array.isArray(parsed.rows)
        ? parsed.rows
            .map((row) => row.time)
            .filter((time): time is string => /^\d{2}:\d{2}$/.test(time))
        : [];
      if (nextRows.length) {
        setRows(createRows(nextRows));
      }
      setLabel(nextLabel);
    } catch {
      // ignore broken payloads
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          label,
          rows: rows.map((row) => ({ time: row.time })),
        }),
      );
    } catch {
      // ignore quota errors
    }
  }, [label, rows]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timesParam = buildTimesParam(rows);
    const labelParam = label?.trim() || DEFAULT_LABEL;
    if (timesParam === lastSyncedTimes.current && labelParam === lastSyncedLabel.current) {
      return;
    }
    lastSyncedTimes.current = timesParam;
    lastSyncedLabel.current = labelParam;
    const url = new URL(window.location.href);
    if (timesParam) {
      url.searchParams.set(URL_PARAM_TIMES, timesParam);
    } else {
      url.searchParams.delete(URL_PARAM_TIMES);
    }
    if (labelParam && labelParam !== DEFAULT_LABEL) {
      url.searchParams.set(URL_PARAM_LABEL, labelParam);
    } else {
      url.searchParams.delete(URL_PARAM_LABEL);
    }
    window.history.replaceState(null, "", url.toString());
  }, [label, rows]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const daySignature = now.toLocaleDateString("ja-JP");
    if (!window.__bellDayTracker) {
      window.__bellDayTracker = {
        day: daySignature,
        times: new Set<string>(),
      };
    }
    const tracker = window.__bellDayTracker!;
    if (tracker.day !== daySignature) {
      tracker.day = daySignature;
      tracker.times = new Set();
    }
    const hhmm = formatTime(now, false);
    const shouldRing = sortedRows.some((row) => row.time === hhmm);
    if (shouldRing && !tracker.times.has(hhmm)) {
      tracker.times.add(hhmm);
      playChime(audioRef.current);
      handleStatus(`チャイムを再生しました（${hhmm}）`);
    }
  }, [handleStatus, now, sortedRows]);

  const handleTimeChange = (id: string, value: string) => {
    if (!/^\d{2}:\d{2}$/.test(value)) return;
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, time: value } : row)),
    );
  };

  const handleAddRowAfter = (afterId?: string) => {
    const nextRow: BellRow = { id: newId(), time: "00:00" };
    setRows((prev) => {
      if (!afterId) {
        return [...prev, nextRow];
      }
      const index = prev.findIndex((row) => row.id === afterId);
      if (index === -1) {
        return [...prev, nextRow];
      }
      const copy = [...prev];
      copy.splice(index + 1, 0, nextRow);
      return copy;
    });
    return nextRow.id;
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleReset = () => {
    setRows(createRows(DEFAULT_TIMES));
    setLabel(DEFAULT_LABEL);
    handleStatus("初期の時間割に戻しました");
  };

  const handleExport = () => {
    if (!rows.length) {
      handleStatus("書き出す時間がありません");
      return;
    }
    const payload: StoredPayload = {
      label,
      rows: sortedRows.map((row) => ({ time: row.time })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const userLabel = label.trim() || "設定";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `時間割 - ${userLabel}.json`;
    link.click();
    URL.revokeObjectURL(url);
    handleStatus("JSONを書き出しました");
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: StoredPayload = JSON.parse(text);
      if (!Array.isArray(parsed.rows)) {
        throw new Error("rows が見つかりません");
      }
      const sanitizedTimes = parsed.rows
        .map((row) => row.time)
        .filter((time): time is string => /^\d{2}:\d{2}$/.test(time));
      if (!sanitizedTimes.length) {
        throw new Error("有効なチャイム時刻がありません");
      }
      const nextLabel = parsed.label?.trim() || DEFAULT_LABEL;
      setRows(createRows(sanitizedTimes));
      setLabel(nextLabel);
      handleStatus(`${file.name} を読み込みました`);
      setImportError("");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "読み込みに失敗しました",
      );
    }
  };

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      handleStatus("共有リンクをコピーしました");
    } catch {
      handleStatus("リンクをコピーできませんでした");
    }
  }, [handleStatus]);

  return (
    <main className="app-shell">
      <audio ref={audioRef} src={audioSourcePath} preload="auto" />
      <div className="floating-buttons">
        <button aria-label="設定を開く" onClick={() => setPanel("settings")}>
          <Settings aria-hidden size={18} />
        </button>
        <button aria-label="ガイドを開く" onClick={() => setPanel("guide")}>
          <HelpCircle aria-hidden size={18} />
        </button>
        <button aria-label="著作権情報を開く" onClick={() => setPanel("copyright")}>
          <Copyright aria-hidden size={18} />
        </button>
      </div>

      <section className="display-stage" aria-live="polite">
        <p className="display-now">
          {(() => {
            const time = formatTime(now);
            const parts = time.split(":");
            return (
              <>
                {parts[0]}
                <span className="-mx-[0.3em]">：</span>
                {parts[1]}
                <span className="-mx-[0.3em]">：</span>
                {parts[2]}
              </>
            );
          })()}
        </p>
        <div className="next-time">
          <Bell aria-hidden size={48} className="bell-icon" />
          <span>
            {nextBell ? (
              <>
                {nextBell.time.split(":")[0]}
                <span className="-mx-[0.3em]">：</span>
                {nextBell.time.split(":")[1]}
              </>
            ) : (
              <>--<span className="-mx-[0.3em]">：</span>--</>
            )}
          </span>
        </div>
      </section>

      {panel && (
        <div
          className="panel-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setPanel(null)}
        >
          <aside
            className="panel-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <div className="panel-title">
                {panel === "settings" ? (
                  <>
                    <Settings aria-hidden size={20} />
                    <h2>設定</h2>
                  </>
                ) : panel === "guide" ? (
                  <>
                    <HelpCircle aria-hidden size={20} />
                    <h2>かんたんガイド</h2>
                  </>
                ) : (
                  <>
                    <Copyright aria-hidden size={20} />
                    <h2>著作権情報</h2>
                  </>
                )}
              </div>
              <button
                className="icon-button"
                aria-label="閉じる"
                onClick={() => setPanel(null)}
              >
                <X aria-hidden size={20} />
              </button>
            </div>
            <div className="panel-body">
              {panel === "settings" ? (
                <SettingsContent
                  label={label}
                  rows={rows}
                  importError={importError}
                  onLabelChange={setLabel}
                  onAddRowAfter={handleAddRowAfter}
                  onRemoveRow={handleRemoveRow}
                  onTimeChange={handleTimeChange}
                  onExport={handleExport}
                  onImport={handleImport}
                  onReset={handleReset}
                  onTestChime={handleTestChime}
                  onCopyLink={handleCopyLink}
                />
              ) : panel === "guide" ? (
                <GuideContent />
              ) : (
                <CopyrightContent />
              )}
            </div>
          </aside>
        </div>
      )}

      {statusMessage && <div className="toast">{statusMessage}</div>}
    </main>
  );
}

type SettingsContentProps = {
  label: string;
  rows: BellRow[];
  importError: string;
  onLabelChange: (value: string) => void;
  onAddRowAfter: (afterId?: string) => string;
  onRemoveRow: (id: string) => void;
  onTimeChange: (id: string, value: string) => void;
  onExport: () => void;
  onImport: (file: File | null) => Promise<void>;
  onReset: () => void;
  onTestChime: () => void;
  onCopyLink: () => void;
};

function SettingsContent({
  label,
  rows,
  importError,
  onLabelChange,
  onAddRowAfter,
  onRemoveRow,
  onTimeChange,
  onExport,
  onImport,
  onReset,
  onTestChime,
  onCopyLink,
}: SettingsContentProps) {
  const inputRefs = useRef(new Map<string, HTMLInputElement>());

  const focusInput = (id: string) => inputRefs.current.get(id)?.focus();

  const handleTimeKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    rowId: string,
  ) => {
    const prevRow = rows[index - 1];
    const nextRow = rows[index + 1];

    if (
      (event.key === "ArrowUp" || event.key === "ArrowLeft") &&
      prevRow
    ) {
      event.preventDefault();
      focusInput(prevRow.id);
      return;
    }

    if (
      (event.key === "ArrowDown" || event.key === "ArrowRight") &&
      nextRow
    ) {
      event.preventDefault();
      focusInput(nextRow.id);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const newRowId = onAddRowAfter(rowId);
      queueMicrotask(() => focusInput(newRowId));
    }
  };

  return (
    <div className="settings-stack">
      <section className="settings-block">
        <p className="block-title">時間割名</p>
        <input
          type="text"
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder="例：２年３組"
        />
      </section>

      <section className="settings-block">
        <p className="block-title">ダウンロードと読み込み</p>
        <div className="action-row">
          <button className="ghost-button" onClick={onCopyLink}>
            <Link2 aria-hidden size={18} />
            リンクをコピー
          </button>
          <button onClick={onExport}>
            <Download aria-hidden size={18} />
            時間割データをダウンロード
          </button>
          <label className="file-label">
            <Upload aria-hidden size={18} />
            時間割データを読み込む
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void onImport(file);
                event.target.value = "";
              }}
            />
          </label>
          <button className="ghost-button" onClick={onReset}>
            <RotateCcw aria-hidden size={18} />
            初期データに戻す
          </button>
        </div>
        {importError && <p className="error-message">{importError}</p>}
      </section>

      <section className="settings-block">
        <p className="block-title">ベルの音を確認</p>
        <p className="block-note">
          ブラウザーが音を止めていると自動再生できません。最初に一度だけテストを押してください。
        </p>
        <button onClick={onTestChime}>
          <Play aria-hidden size={18} />
          チャイムをテスト再生
        </button>
      </section>

      <section className="settings-block">
        <div className="block-head">
          <p className="block-title">ベルの時間</p>
        </div>
        <ol className="time-list">
          {rows.map((row, index) => (
            <li key={row.id} className="time-item">
              <span className="time-index">{index + 1}</span>
              <input
                type="time"
                value={row.time}
                aria-label={`チャイム時刻 ${index + 1}`}
                ref={(element) => {
                  if (element) {
                    inputRefs.current.set(row.id, element);
                  } else {
                    inputRefs.current.delete(row.id);
                  }
                }}
                onChange={(event) => onTimeChange(row.id, event.target.value)}
                onKeyDown={(event) => handleTimeKeyDown(event, index, row.id)}
              />
              <button
                className="icon-button danger"
                aria-label={`${row.time} を削除`}
                onClick={() => onRemoveRow(row.id)}
              >
                <Trash2 aria-hidden size={16} />
              </button>
            </li>
          ))}
        </ol>
        <div className="block-footer">
          <button className="ghost-button" onClick={() => onAddRowAfter()}>
            <Plus aria-hidden size={16} />
            チャイムを追加
          </button>
        </div>
      </section>
    </div>
  );
}

function CopyrightContent() {
  return (
    <div className="guide-block">
      <article>
        <h3>音声素材について</h3>
        <p>
          このアプリケーションで使用されているチャイム音は、
          <a
            href="https://www.nhk.or.jp/archives/creative/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 hover:text-sky-200 underline ml-1"
          >
            NHKクリエイティブ・ライブラリー
          </a>
          から提供されています。
        </p>
      </article>
      <article>
        <h3>利用規約</h3>
        <p>
          音声素材の利用については、
          <a
            href="https://www.nhk.or.jp/archives/creative/rule.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 hover:text-sky-200 underline ml-1"
          >
            NHKクリエイティブ・ライブラリー利用規約
          </a>
          をご確認ください。
        </p>
      </article>
    </div>
  );
}

function GuideContent() {
  const steps = [
    {
      title: "1. 時間を設定する",
      body: "歯車アイコン → 設定 → 「チャイムを追加」でベル時刻を入力します。",
    },
    {
      title: "2. 時間割を配布する",
      body: "「リンクをコピー」で共有 URL を送信するか、「時間割データをダウンロード」で JSON を配布します。",
    },
    {
      title: "3. 時間割を開く",
      body: "共有 URL を開くか、「時間割データを読み込む」で配布済みファイルを選ぶだけ。設定した並びがそのまま戻ります。",
    },
    {
      title: "4. 表示する",
      body: "ブラウザーを全画面にすると、大型モニターでも現在時刻と次ベルがくっきり見えます。",
    },
    {
      title: "5. 困ったら",
      body: "音が出ないときは「チャイムをテスト再生」を一度押します。時刻を消してしまっても Enter で新しい行を追加できます。",
    },
  ];
  return (
    <div className="guide-block">
      {steps.map((step) => (
        <article key={step.title}>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </article>
      ))}
      <p className="text-xs opacity-40 text-center mt-4">
        音声：
        <a
          href="https://www.nhk.or.jp/archives/creative/rule.html"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-100 transition-opacity underline"
        >
          NHKクリエイティブ・ライブラリー
        </a>
      </p>
    </div>
  );
}

async function playChime(audio: HTMLAudioElement | null) {
  if (!audio) return;
  try {
    audio.currentTime = 0;
    await audio.play();
    return;
  } catch {
    // fallback to Web Audio API when autoplay is blocked
  }
  const AudioContextRef =
    typeof window !== "undefined"
      ? window.AudioContext ?? window.webkitAudioContext
      : undefined;
  if (!AudioContextRef) return;
  const ctx = new AudioContextRef();
  const sequence = [
    { freq: 659.25, duration: 0.6 },
    { freq: 523.25, duration: 0.6 },
    { freq: 587.33, duration: 0.6 },
    { freq: 523.25, duration: 0.9 },
  ];
  let start = ctx.currentTime;
  for (const note of sequence) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = note.freq;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.4, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, start + note.duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + note.duration);
    start += note.duration;
  }
  const cleanupTime = start + 0.5;
  window.setTimeout(() => ctx.close(), (cleanupTime - ctx.currentTime) * 1000);
}
