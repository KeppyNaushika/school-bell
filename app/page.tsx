"use client";

import {
  Bell,
  Download,
  HelpCircle,
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

export default function Home() {
  const [panel, setPanel] = useState<"settings" | "guide" | null>(null);
  const [label, setLabel] = useState(DEFAULT_LABEL);
  const [rows, setRows] = useState<BellRow[]>(() => createRows(DEFAULT_TIMES));
  const [now, setNow] = useState<Date>(() => new Date());
  const [statusMessage, setStatusMessage] = useState("");
  const [importError, setImportError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const statusTimer = useRef<number | null>(null);

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
    const fromStorage = window.localStorage.getItem(STORAGE_KEY);
    if (!fromStorage) return;
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

  return (
    <main className="app-shell">
      <audio ref={audioRef} src="/audio/chime.wav" preload="auto" />
      <div className="floating-buttons">
        <button aria-label="設定を開く" onClick={() => setPanel("settings")}>
          <Settings aria-hidden size={18} />
        </button>
        <button aria-label="ガイドを開く" onClick={() => setPanel("guide")}>
          <HelpCircle aria-hidden size={18} />
        </button>
      </div>

      <section className="display-stage" aria-live="polite">
        <p className="display-now">{formatTime(now)}</p>
        <div className="display-next">
          <div className="next-time">
            <Bell aria-hidden size={36} className="bell-icon" />
            <span>{nextBell ? nextBell.time : "--:--"}</span>
          </div>
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
                ) : (
                  <>
                    <HelpCircle aria-hidden size={20} />
                    <h2>かんたんガイド</h2>
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
                />
              ) : (
                <GuideContent />
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
          <div>
            <p className="block-title">ベルの時間</p>
          </div>
        </div>
        <ol className="time-list">
          {rows.map((row, index) => (
            <li key={row.id} className="time-item">
              <span className="time-index">{index + 1}</span>
              <input
                type="time"
                value={row.time}
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

function GuideContent() {
  const steps = [
    {
      title: "1. 時間を入れる",
      body: "右上の歯車アイコン → 設定 → 「チャイムを追加」で必要な数だけ時刻を登録します。",
    },
    {
      title: "2. 朝の準備",
      body: "前日に書き出したJSONを「時間割データを読み込む」で選ぶと、並び順ごとそのまま戻ります。",
    },
    {
      title: "3. 表示する",
      body: "ブラウザーを全画面にすると、大きなテレビでも数字だけがはっきり見えます。",
    },
    {
      title: "4. 困ったら",
      body: "音が出ないときは一度だけ「チャイムをテスト再生」を押してください。時刻を消しすぎたら再度「チャイムを追加」で復旧できます。",
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
      <p className="block-tip">
        {'GitHub Pages 公開方法: Repository > Code and automation > Pages > Build and deployment > Source > Github Actions で origin/main ブランチに push するだけで GitHub Pages に公開されます。'}
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
