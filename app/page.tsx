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
import { Switch } from "@/components/ui/switch";

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
  showSeconds?: boolean;
};

const STORAGE_KEY = "school-bell-settings@v1";
const DEFAULT_LABEL = "標準設定";
const DEFAULT_SHOW_SECONDS = true;
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

const primaryButtonClass =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-sky-500/20 px-5 py-2.5 text-sm font-semibold text-sky-50 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:bg-sky-500/35";
const ghostButtonClass =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-500/20 px-5 py-2.5 text-sm font-semibold text-slate-100 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:bg-slate-500/30";
const iconButtonClass =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-slate-900/70 text-slate-100 transition hover:bg-slate-800 hover:-translate-y-0.5";
const dangerIconButtonClass =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-rose-500/20 text-rose-100 transition hover:bg-rose-500/30 hover:-translate-y-0.5";
const floatingButtonClass =
  "inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-slate-900/70 p-0 text-slate-100 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800";
const fileLabelClass =
  "relative inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-sky-500/20 px-5 py-2.5 text-sm font-semibold text-sky-50 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:bg-sky-500/35";
const inputClass =
  "w-full appearance-none rounded-xl border border-slate-500/40 bg-slate-900/60 px-4 py-3 text-base text-slate-50 outline-none transition placeholder:text-slate-400 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/30";
const settingsBlockClass =
  "space-y-3 rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-xl";
const readStoredPayload = (): StoredPayload | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPayload;
  } catch {
    return null;
  }
};

export default function Home() {
  const [panel, setPanel] = useState<"settings" | "guide" | "copyright" | null>(null);
  const [label, setLabel] = useState(DEFAULT_LABEL);
  const [rows, setRows] = useState<BellRow[]>(() => createRows(DEFAULT_TIMES));
  const [now, setNow] = useState<Date | null>(null);
  const [showSeconds, setShowSeconds] = useState(DEFAULT_SHOW_SECONDS);
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
    if (!now) return sortedRows[0];
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
    const stored = readStoredPayload();
    const persistedSeconds =
      typeof stored?.showSeconds === "boolean"
        ? stored.showSeconds
        : DEFAULT_SHOW_SECONDS;
    setShowSeconds(persistedSeconds);
    hasLoadedFromQuery.current = true;
    lastSyncedTimes.current = timesValue;
    lastSyncedLabel.current = labelValue;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          label: labelValue,
          rows: parsedTimes.map((time) => ({ time })),
          showSeconds: persistedSeconds,
        }),
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const parsed = readStoredPayload();
    if (!parsed) return;
    if (typeof parsed.showSeconds === "boolean") {
      setShowSeconds(parsed.showSeconds);
    }
    if (hasLoadedFromQuery.current) return;
    try {
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
          showSeconds,
        }),
      );
    } catch {
      // ignore quota errors
    }
  }, [label, rows, showSeconds]);

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
    setNow(new Date());
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!now) return;
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
    setShowSeconds(DEFAULT_SHOW_SECONDS);
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
      showSeconds,
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
      const nextShowSeconds =
        typeof parsed.showSeconds === "boolean"
          ? parsed.showSeconds
          : DEFAULT_SHOW_SECONDS;
      setRows(createRows(sanitizedTimes));
      setLabel(nextLabel);
      setShowSeconds(nextShowSeconds);
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
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center gap-8 overflow-hidden px-4 py-10">
      <audio ref={audioRef} src={audioSourcePath} preload="auto" />
      <div className="absolute right-6 top-6 flex gap-3">
        <button
          className={floatingButtonClass}
          aria-label="設定を開く"
          onClick={() => setPanel("settings")}
        >
          <Settings aria-hidden size={18} />
        </button>
        <button
          className={floatingButtonClass}
          aria-label="ガイドを開く"
          onClick={() => setPanel("guide")}
        >
          <HelpCircle aria-hidden size={18} />
        </button>
        <button
          className={floatingButtonClass}
          aria-label="著作権情報を開く"
          onClick={() => setPanel("copyright")}
        >
          <Copyright aria-hidden size={18} />
        </button>
      </div>

      <section
        className="flex flex-col items-center gap-[clamp(1rem,5vw,4rem)] text-center"
        aria-live="polite"
      >
        <p className="whitespace-nowrap text-[clamp(5rem,20vw,18rem)] font-bold leading-none text-white [font-feature-settings:'tnum'] [font-variant-numeric:tabular-nums]">
          {now ? (
            (() => {
              const time = formatTime(now, showSeconds);
              const parts = time.split(":");
              return (
                <>
                  {parts[0]}
                  <span className="-mx-[0.3em]">：</span>
                  {parts[1]}
                  {showSeconds && parts[2] ? (
                    <>
                      <span className="-mx-[0.3em]">：</span>
                      {parts[2]}
                    </>
                  ) : null}
                </>
              );
            })()
          ) : (
            <>
              --<span className="-mx-[0.3em]">：</span>--
              {showSeconds ? (
                <>
                  <span className="-mx-[0.3em]">：</span>--
                </>
              ) : null}
            </>
          )}
        </p>
        <div className="inline-flex items-center gap-6 text-[clamp(2rem,7vw,5rem)] text-white/70 [font-feature-settings:'tnum'] [font-variant-numeric:tabular-nums]">
          <Bell aria-hidden size={48} className="text-white" />
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
          className="fixed inset-0 flex justify-end bg-slate-950/70 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          onClick={() => setPanel(null)}
        >
          <aside
            className="flex h-full w-full max-w-xl flex-col gap-6 border-l border-white/10 bg-slate-950/90 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
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
                className={iconButtonClass}
                aria-label="閉じる"
                onClick={() => setPanel(null)}
              >
                <X aria-hidden size={20} />
              </button>
            </div>
            <div className="overflow-y-auto pr-1">
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
                  showSeconds={showSeconds}
                  onShowSecondsChange={setShowSeconds}
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

      {statusMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-sky-600/90 px-6 py-3 text-sm font-semibold text-cyan-50 shadow-2xl">
          {statusMessage}
        </div>
      )}
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
  showSeconds: boolean;
  onShowSecondsChange: (value: boolean) => void;
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
  showSeconds,
  onShowSecondsChange,
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
    <div className="flex flex-col gap-6">
      <section className={settingsBlockClass}>
        <p className="text-base font-semibold">時間割名</p>
        <input
          className={inputClass}
          type="text"
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder="例：２年３組"
        />
      </section>

      <section className={settingsBlockClass}>
        <p className="text-base font-semibold">表示設定</p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label htmlFor="show-seconds" className="flex flex-col gap-1 font-semibold text-slate-100">
            秒を表示
            <span className="text-sm font-normal text-slate-400">
              現在時刻に秒を表示するかを切り替えます。
            </span>
          </label>
          <Switch
            id="show-seconds"
            checked={showSeconds}
            onCheckedChange={onShowSecondsChange}
          />
        </div>
      </section>

      <section className={settingsBlockClass}>
        <p className="text-base font-semibold">ダウンロードと読み込み</p>
        <div className="flex flex-wrap items-center gap-3">
          <button className={ghostButtonClass} onClick={onCopyLink}>
            <Link2 aria-hidden size={18} />
            リンクをコピー
          </button>
          <button className={primaryButtonClass} onClick={onExport}>
            <Download aria-hidden size={18} />
            時間割データをダウンロード
          </button>
          <label className={fileLabelClass}>
            <Upload aria-hidden size={18} />
            時間割データを読み込む
            <input
              className="absolute inset-0 cursor-pointer opacity-0"
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void onImport(file);
                event.target.value = "";
              }}
            />
          </label>
          <button className={ghostButtonClass} onClick={onReset}>
            <RotateCcw aria-hidden size={18} />
            初期データに戻す
          </button>
        </div>
        {importError && (
          <p className="text-sm font-semibold text-rose-200">{importError}</p>
        )}
      </section>

      <section className={settingsBlockClass}>
        <p className="text-base font-semibold">ベルの音を確認</p>
        <p className="text-sm text-slate-300">
          ブラウザーが音を止めていると自動再生できません。最初に一度だけテストを押してください。
        </p>
        <button className={primaryButtonClass} onClick={onTestChime}>
          <Play aria-hidden size={18} />
          チャイムをテスト再生
        </button>
      </section>

      <section className={settingsBlockClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-semibold">ベルの時間</p>
        </div>
        <ol className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-center gap-3 rounded-xl bg-slate-800/80 px-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 font-semibold text-sky-100">
                {index + 1}
              </span>
              <input
                className={inputClass}
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
                className={dangerIconButtonClass}
                aria-label={`${row.time} を削除`}
                onClick={() => onRemoveRow(row.id)}
              >
                <Trash2 aria-hidden size={16} />
              </button>
            </li>
          ))}
        </ol>
        <div className="flex justify-end">
          <button className={ghostButtonClass} onClick={() => onAddRowAfter()}>
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
    <div className="space-y-4">
      <article className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-lg">
        <h3 className="text-lg font-semibold">音声素材について</h3>
        <p className="leading-relaxed text-slate-300">
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
      <article className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-lg">
        <h3 className="text-lg font-semibold">利用規約</h3>
        <p className="leading-relaxed text-slate-300">
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
    <div className="space-y-4">
      {steps.map((step) => (
        <article
          key={step.title}
          className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/70 p-5 shadow-lg"
        >
          <h3 className="text-lg font-semibold">{step.title}</h3>
          <p className="leading-relaxed text-slate-300">{step.body}</p>
        </article>
      ))}
      <p className="mt-4 text-center text-xs text-slate-400">
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
