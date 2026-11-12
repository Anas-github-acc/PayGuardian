"use client";

import * as React from "react";
import { ArrowUp, Check, ChevronDown, Mic, Plus, Square, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type ComposerMode = "Delegate" | "Ask";
export type EffortLevel = "Low" | "Medium" | "High" | "Max";
type ProviderKey = "gemini" | "kimi" | "openai" | "spark";
type ModelFilterTab = "fav" | "all";

export interface AIComposerSubmission {
  prompt: string;
  mode: ComposerMode;
  modelId: string;
  modelName: string;
  effort: EffortLevel;
  autoMode: boolean;
  attachedFiles: string[];
  files: File[];
}

export interface AIComposerProps {
  /** Disables input while the agent is drafting a response. */
  disabled?: boolean;
  /** Whether the agent is currently generating a response. */
  isStreaming?: boolean;
  /** Callback triggered when user clicks the stop button. */
  onStop?: () => void;
  /** Receives the prompt, selection and attached files — wire to the chat send flow. */
  onSubmit: (submission: AIComposerSubmission) => void;
  className?: string;
}

interface ComposerModel {
  id: string;
  name: string;
  effort: EffortLevel;
  provider: ProviderKey;
  isFav: boolean;
  efforts: EffortLevel[];
}

interface ContextTagOption {
  tag: string;
  category: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const ALL_EFFORTS: EffortLevel[] = ["Low", "Medium", "High", "Max"];

const ALL_MODES: ComposerMode[] = ["Delegate", "Ask"];

const CONTEXT_OPTIONS: ContextTagOption[] = [
  { tag: "@environment", category: "Workspace" },
  { tag: "@mandates", category: "Authority" },
  { tag: "@memory", category: "Memory vault" },
];

const FALLBACK_MODELS: ComposerModel[] = [
  { id: "free/gpt-6-luna", name: "APInex GPT-6 Luna (Free)", effort: "Medium", provider: "openai", isFav: true, efforts: ALL_EFFORTS },
  { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", effort: "Medium", provider: "gemini", isFav: false, efforts: ALL_EFFORTS },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", effort: "Medium", provider: "gemini", isFav: false, efforts: ALL_EFFORTS },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", effort: "High", provider: "gemini", isFav: false, efforts: ALL_EFFORTS },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", effort: "Low", provider: "gemini", isFav: false, efforts: ALL_EFFORTS },
];

const FAVS_STORAGE_KEY = "pg_composer_fav_models";
const LAST_ACTIVE_MODEL_STORAGE_KEY = "pg_composer_active_model_id";

// Persistent global cache across component remounts / chat switches
let globalCachedModels: ComposerModel[] | null = null;
let globalCachedActiveModelId: string | null = null;

function providerKeyFor(providerLabel?: string): ProviderKey {
  const p = (providerLabel ?? "").toLowerCase();
  if (p.includes("kimi")) return "kimi";
  if (p.includes("gpt") || p.includes("openai")) return "openai";
  if (p.includes("gemini")) return "gemini";
  return "spark";
}

function ProviderBadgeIcon({ provider }: { provider: ProviderKey }) {
  if (provider === "kimi") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path
          d="M4.2 3.2V12.8M4.2 8.2L10.4 3.2M6.8 6.2L11.2 12.8"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12.2" cy="4.2" r="1.15" fill="currentColor" />
      </svg>
    );
  }
  if (provider === "openai") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path
          d="M21.2 10.1c.2-1.5-.2-3.1-1.2-4.3-1.3-1.6-3.4-2.3-5.4-1.8-.9-1.1-2.3-1.8-3.8-1.8-2.1 0-3.9 1.3-4.6 3.2-1.5.3-2.8 1.2-3.6 2.5-1 1.8-.9 4 .2 5.7-.2 1.5.2 3.1 1.2 4.3 1.3 1.6 3.4 2.3 5.4 1.8.9 1.1 2.3 1.8 3.8 1.8 2.1 0 3.9-1.3 4.6-3.2 1.5-.3 2.8-1.2 3.6-2.5 1.1-1.8 1-4-.2-5.7z"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.7" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  // gemini (default): four-point sparkle
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.5C8.6 4.6 10.2 6.4 13.8 8C10.2 9.6 8.6 11.4 8 14.5C7.4 11.4 5.8 9.6 2.2 8C5.8 6.4 7.4 4.6 8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Minimal Web Speech API typings (not part of TypeScript's lib.dom).  */
/* ------------------------------------------------------------------ */

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: SpeechRecognitionResultListLike }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

export function AIComposer({
  disabled = false,
  isStreaming = false,
  onStop,
  onSubmit,
  className = "",
}: AIComposerProps) {
  const [promptText, setPromptText] = React.useState("");
  const [mode, setMode] = React.useState<ComposerMode>("Delegate");
  const [modeMenuOpen, setModeMenuOpen] = React.useState(false);

  const [autoMode, setAutoMode] = React.useState(false);
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [searchRevealed, setSearchRevealed] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [modelFilterTab, setModelFilterTab] = React.useState<ModelFilterTab>("fav");
  const [models, setModels] = React.useState<ComposerModel[]>(() => globalCachedModels ?? FALLBACK_MODELS);
  const [modelsLoading, setModelsLoading] = React.useState<boolean>(globalCachedModels === null);
  const [activeModelId, setActiveModelId] = React.useState<string>(() => {
    if (globalCachedActiveModelId) return globalCachedActiveModelId;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LAST_ACTIVE_MODEL_STORAGE_KEY);
      if (stored) return stored;
    }
    return FALLBACK_MODELS[0].id;
  });

  const selectModelId = React.useCallback((id: string) => {
    setActiveModelId(id);
    globalCachedActiveModelId = id;
    try {
      localStorage.setItem(LAST_ACTIVE_MODEL_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const [hoveredModelId, setHoveredModelId] = React.useState<string | null>(null);
  const [modelMenuPointerReady, setModelMenuPointerReady] = React.useState(false);

  const [attachedFiles, setAttachedFiles] = React.useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);

  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const promptInputRef = React.useRef<HTMLTextAreaElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const isHoveringModelRowRef = React.useRef(false);
  const isHoveringEffortMenuRef = React.useRef(false);
  const hideEffortTimerRef = React.useRef<number | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);

  /* ---------------- Model catalogue (backend → composer shape) ---------------- */

  React.useEffect(() => {
    let cancelled = false;

    const loadFavs = (list: ComposerModel[]): ComposerModel[] => {
      try {
        const raw = localStorage.getItem(FAVS_STORAGE_KEY);
        if (!raw) return list;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return list;
        return list.map((m) => ({ ...m, isFav: parsed.includes(m.id) }));
      } catch {
        return list;
      }
    };

    if (globalCachedModels && globalCachedModels.length > 0) {
      setModels(globalCachedModels);
      setModelsLoading(false);
      return;
    }

    fetch(`${API_BASE}/v1/models`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { models?: { id: string; label: string; provider?: string; default?: boolean }[] }) => {
        if (cancelled) return;
        const remote = Array.isArray(data.models) && data.models.length > 0 ? data.models : null;
        const list: ComposerModel[] = (remote ?? FALLBACK_MODELS).map((m) => ({
          id: m.id,
          name: "label" in m ? m.label : m.id,
          effort: "Medium",
          provider: providerKeyFor("provider" in m ? m.provider : undefined),
          isFav: false,
          efforts: ALL_EFFORTS,
        }));
        const withFavs = loadFavs(list);
        globalCachedModels = withFavs;
        setModels(withFavs);
        if (!globalCachedActiveModelId) {
          const def = remote?.find((m) => m.default) ?? list[0];
          selectModelId(def.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const fallbackWithFavs = loadFavs(FALLBACK_MODELS);
          globalCachedModels = fallbackWithFavs;
          setModels(fallbackWithFavs);
        }
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectModelId]);

  React.useEffect(() => {
    const w = window as SpeechRecognitionWindow;
    if (!(w.SpeechRecognition ?? w.webkitSpeechRecognition)) return;
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  /* ---------------- Recording timer ---------------- */

  React.useEffect(() => {
    if (!isRecording) return;
    const id = window.setInterval(() => setRecordingSeconds((prev) => prev + 1), 1000);
    return () => window.clearInterval(id);
  }, [isRecording]);

  /* ---------------- Close popovers on global click ---------------- */

  React.useEffect(() => {
    const handleGlobalClick = () => {
      setModeMenuOpen(false);
      setModelMenuOpen(false);
      setHoveredModelId(null);
      setContextMenuOpen(false);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const clearHideEffortTimeout = React.useCallback(() => {
    if (hideEffortTimerRef.current !== null) {
      window.clearTimeout(hideEffortTimerRef.current);
      hideEffortTimerRef.current = null;
    }
  }, []);

  const scheduleHideEffortSubmenu = React.useCallback(() => {
    clearHideEffortTimeout();
    hideEffortTimerRef.current = window.setTimeout(() => {
      if (!isHoveringEffortMenuRef.current && !isHoveringModelRowRef.current) {
        setHoveredModelId(null);
      }
    }, 60);
  }, [clearHideEffortTimeout]);

  /* ---------------- Derived state ---------------- */

  // Active mode anchored at the bottom of the menu with the checkmark.
  const orderedModes = React.useMemo(() => {
    const inactive = ALL_MODES.filter((m) => m !== mode);
    return [...inactive, mode];
  }, [mode]);

  const activeModel = React.useMemo(
    () => models.find((m) => m.id === activeModelId) ?? models[0],
    [models, activeModelId]
  );

  const favCount = React.useMemo(() => models.filter((m) => m.isFav).length, [models]);

  const visibleModels = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return models.filter((m) => {
      const matchesTab = modelFilterTab === "fav" ? m.isFav : true;
      const matchesSearch = m.name.toLowerCase().includes(q) || m.effort.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [models, modelFilterTab, searchQuery]);

  const hoveredModel = React.useMemo(
    () => (hoveredModelId ? models.find((m) => m.id === hoveredModelId) ?? null : null),
    [models, hoveredModelId]
  );

  // Effort submenu tracks the hovered model row vertically.
  const effortBottomOffsetPx = React.useMemo(() => {
    if (!hoveredModelId) return 0;
    const idx = visibleModels.findIndex((m) => m.id === hoveredModelId);
    if (idx < 0) return 0;
    const rowsFromBottom = visibleModels.length - 1 - idx;
    return rowsFromBottom <= 1 ? 0 : Math.min(108, (rowsFromBottom - 1) * 36);
  }, [visibleModels, hoveredModelId]);

  const isEffortMenuVisible =
    modelMenuOpen && searchQuery.trim().length === 0 && hoveredModel !== null;

  /* ---------------- Handlers ---------------- */

  const handleToggleFavStar = (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    setModels((prev) => {
      const updated = prev.map((m) => (m.id === targetId ? { ...m, isFav: !m.isFav } : m));
      const targetAfter = updated.find((m) => m.id === targetId);
      if (targetAfter?.isFav) {
        selectModelId(targetId);
        setAutoMode(false);
      }
      try {
        localStorage.setItem(
          FAVS_STORAGE_KEY,
          JSON.stringify(updated.filter((m) => m.isFav).map((m) => m.id))
        );
      } catch {
        // Ignore storage access errors in sandboxed contexts
      }
      return updated;
    });
  };

  const handleSelectModel = (e: React.MouseEvent, modelId: string) => {
    e.stopPropagation();
    selectModelId(modelId);
    setAutoMode(false);
    setModelMenuOpen(false);
    setHoveredModelId(null);
  };

  const handleSelectEffort = (e: React.MouseEvent, effort: EffortLevel) => {
    e.stopPropagation();
    if (!hoveredModelId) return;
    setModels((prev) => prev.map((m) => (m.id === hoveredModelId ? { ...m, effort } : m)));
    selectModelId(hoveredModelId);
    setAutoMode(false);
  };

  const handleOpenModelMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setModeMenuOpen(false);
    setContextMenuOpen(false);

    const nextOpen = !modelMenuOpen;
    setModelMenuOpen(nextOpen);
    if (nextOpen) {
      setModelFilterTab("fav");
      setHoveredModelId(null);
      setModelMenuPointerReady(false);
      setSearchRevealed(false);
      setSearchQuery("");
      window.setTimeout(() => setSearchRevealed(true), 160);
    }
  };

  const handleToggleAutoInMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextAuto = !autoMode;
    setAutoMode(nextAuto);
    if (nextAuto) {
      window.setTimeout(() => {
        setModelMenuOpen(false);
        setHoveredModelId(null);
      }, 180);
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPromptText(val);
    setContextMenuOpen(val.endsWith("@"));
    // Auto-grow up to 180px
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const handleInsertContextTag = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    setPromptText((prev) => prev.replace(/@$/, `${tag} `));
    setContextMenuOpen(false);
    promptInputRef.current?.focus();
  };

  /* ---------------- Voice input ---------------- */

  const formattedRecordingTime = React.useMemo(() => {
    const mins = Math.floor(recordingSeconds / 60);
    const secs = String(recordingSeconds % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  }, [recordingSeconds]);

  const handleRecordClick = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const w = window as SpeechRecognitionWindow;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;

    const base = promptText.trim();
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setPromptText(`${base}${base ? " " : ""}${finalText}${interimText}`);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognitionRef.current = recognition;
    setRecordingSeconds(0);
    setIsRecording(true);
    recognition.start();
  };

  /* ---------------- Submit ---------------- */

  const isSubmitReady = promptText.trim().length > 0 || attachedFiles.length > 0;

  const handleSubmitPrompt = () => {
    if (isRecording) recognitionRef.current?.stop();

    const trimmed = promptText.trim();
    if (!trimmed && attachedFiles.length === 0) {
      return;
    }

    const routingLabel = autoMode
      ? "Auto Router"
      : `${activeModel.name} · ${activeModel.effort}`;
    onSubmit({
      prompt: trimmed,
      mode,
      modelId: activeModel.id,
      modelName: activeModel.name,
      effort: activeModel.effort,
      autoMode,
      attachedFiles: [...attachedFiles],
      files: [...selectedFiles],
    });

    setPromptText("");
    setAttachedFiles([]);
    setSelectedFiles([]);
    setContextMenuOpen(false);
    if (promptInputRef.current) promptInputRef.current.style.height = "auto";
  };

  const pillBase =
    "group h-9 rounded-lg border border-zinc-800 bg-zinc-900/90 text-zinc-300 shadow-sm transition-[width,background-color,border-color] duration-300 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 hover:bg-zinc-800 hover:text-white hover:border-zinc-700 disabled:pointer-events-none";

  const pillLabel =
    "whitespace-nowrap text-[13px] font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100";

  return (
    <div className={`relative ${className}`}>
      {/* Attached context file chips */}
      {attachedFiles.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {attachedFiles.map((fileName, idx) => (
            <div
              key={`${fileName}-${idx}`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground shadow-sm"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-muted-foreground">
                <path
                  d="M9.5 2H4.5C3.67 2 3 2.67 3 3.5V12.5C3 13.33 3.67 14 4.5 14H11.5C12.33 14 13 13.33 13 12.5V5.5L9.5 2Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
              <span className="max-w-[160px] truncate">{fileName}</span>
              <button
                type="button"
                aria-label={`Remove ${fileName}`}
                onClick={() => {
                  setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
                  setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
                }}
                className="text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input for "+ Add files" */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) {
            setAttachedFiles((prev) => [...prev, ...files.map((f) => f.name)]);
            setSelectedFiles((prev) => [...prev, ...files]);
          }
          e.target.value = "";
        }}
      />

      {/* Composer card */}
      <section className="relative rounded-xl border border-zinc-800 bg-zinc-950 p-4 pb-3 transition-colors focus-within:border-zinc-700 shadow-sm">
        {/* @ Context mention popover */}
        <div
          className={cn(
            "absolute bottom-[76px] left-4 z-40 w-56 origin-bottom-left rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-xl transition-all duration-200",
            contextMenuOpen
              ? "pointer-events-auto scale-100 translate-y-0 opacity-100"
              : "pointer-events-none translate-y-1.5 scale-[0.97] opacity-0"
          )}
        >
          <div className="px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
            Add context
          </div>
          {CONTEXT_OPTIONS.map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={(e) => handleInsertContextTag(e, item.tag)}
              className="flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-[13px] font-medium text-zinc-200 transition-colors hover:bg-zinc-900"
            >
              <span>{item.tag}</span>
              <span className="text-xs font-normal text-zinc-500">{item.category}</span>
            </button>
          ))}
        </div>

        {/* Prompt textarea */}
        <textarea
          ref={promptInputRef}
          rows={1}
          value={promptText}
          onChange={handlePromptChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmitPrompt();
            }
          }}
          disabled={disabled}
          placeholder="Delegate, Ask, Automate / @ for context"
          aria-label="Message the assistant"
          className="mb-4 min-h-8 w-full resize-none border-none bg-transparent px-0.5 text-base sm:text-lg leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-50"
        />

        {/* Bottom controls bar */}
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          {/* Left controls */}
          <div className="flex min-w-0 items-center gap-2">
            {/* + Add files (expands on hover) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add files"
              className={cn(
                pillBase,
                "flex w-9 items-center overflow-hidden px-2.5 hover:w-[112px]"
              )}
            >
              <Plus className="h-4 w-4 shrink-0 text-foreground" />
              <span className={cn(pillLabel, "ml-1.5")}>Add files</span>
            </button>

            {/* Mode selector */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModelMenuOpen(false);
                  setHoveredModelId(null);
                  setModeMenuOpen((prev) => !prev);
                }}
                aria-haspopup="menu"
                aria-expanded={modeMenuOpen}
                className={cn(
                  pillBase,
                  "flex items-center gap-1.5 px-3.5 text-[13px] font-medium hover:bg-secondary/80",
                  modeMenuOpen && "text-muted-foreground"
                )}
              >
                <span>{mode}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {/* Mode popover */}
              <div
                role="menu"
                className={cn(
                  "absolute bottom-[calc(100%+8px)] left-0 z-30 w-36 origin-bottom-left rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-xl transition-all duration-200",
                  modeMenuOpen
                    ? "pointer-events-auto scale-100 translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-1.5 scale-[0.97] opacity-0"
                )}
              >
                <div className="flex flex-col gap-0.5">
                  {orderedModes.map((modeOption) => {
                    const isSelected = modeOption === mode;
                    return (
                      <div
                        key={modeOption}
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMode(modeOption);
                          setModeMenuOpen(false);
                        }}
                        className="flex h-9 cursor-pointer items-center justify-between rounded-lg px-3.5 text-[13px] font-medium text-zinc-200 transition-colors hover:bg-zinc-900"
                      >
                        <span>{modeOption}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Model & effort selector */}
            <div className="relative inline-flex items-center">
              {!autoMode ? (
                <button
                  type="button"
                  onClick={handleOpenModelMenu}
                  disabled={modelsLoading}
                  aria-label="Select model"
                  aria-haspopup="menu"
                  aria-expanded={modelMenuOpen}
                  className={cn(
                    pillBase,
                    "flex items-center gap-2 px-2 hover:bg-secondary/80",
                    modelsLoading && "text-muted-foreground"
                  )}
                >
                  <span className="flex shrink-0 items-center justify-center text-foreground">
                    <ProviderBadgeIcon provider={activeModel?.provider ?? "gemini"} />
                  </span>
                  <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="text-[13px] font-medium">
                      {modelsLoading ? "Loading…" : activeModel?.name}
                    </span>
                    {!modelsLoading && (
                      <span className="text-[13px] font-normal text-muted-foreground">
                        {activeModel?.effort}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleOpenModelMenu}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenModelMenu(e as unknown as React.MouseEvent);
                    }
                  }}
                  className="group/auto flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border bg-secondary px-3 text-[13px] font-medium text-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05)] transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="Auto model routing"
                >
                  <span>Auto</span>
                  <span className="hidden group-hover/auto:inline-flex">
                    {/* Inline switch to return to pinned model */}
                    <span
                      role="switch"
                      aria-checked={autoMode}
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAutoMode(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setAutoMode(false);
                        }
                      }}
                      className="relative h-5 w-9 cursor-pointer rounded-full bg-primary"
                      title="Turn off Auto routing"
                    >
                      <span className="absolute left-[3px] top-[2px] h-4 w-4 rounded-full bg-white shadow-md transition-transform translate-x-4" />
                    </span>
                  </span>
                  <span className="group-hover/auto:hidden">
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </div>
              )}

              {/* Model popover */}
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute bottom-[calc(100%+8px)] left-0 z-30 w-64 origin-bottom-left rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-xl transition-all duration-200",
                  modelMenuOpen
                    ? "pointer-events-auto scale-100 translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-1.5 scale-[0.97] opacity-0"
                )}
              >
                {/* Collapsible search input */}
                <div
                  onMouseEnter={() => {
                    isHoveringModelRowRef.current = false;
                    setHoveredModelId(null);
                  }}
                  className={cn(
                    "overflow-hidden opacity-0 transition-all duration-200",
                    searchRevealed || searchQuery.length > 0
                      ? "mb-1 max-h-10 opacity-100"
                      : "mb-0 max-h-0"
                  )}
                >
                  <div className="flex h-8 items-center gap-2 rounded-lg px-2.5">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="shrink-0 text-muted-foreground"
                    >
                      <circle cx="7.2" cy="7.2" r="4.8" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M10.8 10.8L13.8 13.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search models"
                      autoComplete="off"
                      className="w-full border-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                </div>

                {/* Auto toggle row */}
                <div
                  onMouseEnter={() => {
                    isHoveringModelRowRef.current = false;
                    setHoveredModelId(null);
                  }}
                  className="flex h-9 items-center justify-between px-2.5"
                >
                  <span className="text-[13px] font-medium text-foreground">Auto</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoMode}
                    aria-label="Auto model routing"
                    onClick={handleToggleAutoInMenu}
                    className={cn(
                      "relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
                      autoMode ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-[3px] top-[2px] h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200",
                        autoMode && "translate-x-4"
                      )}
                    />
                  </button>
                </div>

                {/* fav / all segmented filter */}
                <div
                  role="tablist"
                  aria-label="Filter models"
                  onMouseEnter={() => {
                    isHoveringModelRowRef.current = false;
                    setHoveredModelId(null);
                  }}
                  className="mb-1.5 mt-0.5 flex items-center rounded-full border border-border bg-background/60 p-0.5"
                >
                  {(["fav", "all"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={modelFilterTab === tab}
                      onClick={(e) => {
                        e.stopPropagation();
                        setModelFilterTab(tab);
                        setHoveredModelId(null);
                      }}
                      className={cn(
                        "flex h-6 flex-1 items-center justify-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium capitalize transition-colors",
                        modelFilterTab === tab
                          ? "border-border bg-secondary text-foreground shadow-sm"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab === "fav" && (
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 16 16"
                          fill={modelFilterTab === "fav" ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinejoin="round"
                          className={cn("shrink-0", modelFilterTab === "fav" ? "text-warning" : "")}
                        >
                          <path d="M8 1.6L9.95 5.55L14.3 6.18L11.15 9.25L11.89 13.58L8 11.53L4.11 13.58L4.85 9.25L1.7 6.18L6.05 5.55L8 1.6Z" />
                        </svg>
                      )}
                      <span>{tab}</span>
                      {tab === "fav" && favCount > 0 && (
                        <span className="text-[11px] font-normal opacity-75">{favCount}</span>
                      )}
                      {tab === "all" && <span className="text-[11px] font-normal opacity-75">{models.length}</span>}
                    </button>
                  ))}
                </div>

                {/* Models list */}
                <div className="flex flex-col gap-0.5">
                  {visibleModels.length === 0 ? (
                    <div className="px-3 py-3 text-center text-[12px] leading-relaxed text-muted-foreground">
                      {modelFilterTab === "fav" ? (
                        <>
                          No favourite models yet. Switch to{" "}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModelFilterTab("all");
                            }}
                            className="font-medium text-link underline underline-offset-2"
                          >
                            all
                          </button>{" "}
                          and press ★ to add.
                        </>
                      ) : (
                        "No matching models"
                      )}
                    </div>
                  ) : (
                    visibleModels.map((m) => {
                      const isSelected = !autoMode && m.id === activeModelId;
                      const isHovered = m.id === hoveredModelId && searchQuery.trim().length === 0;
                      return (
                        <div
                          key={m.id}
                          role="menuitem"
                          onClick={(e) => handleSelectModel(e, m.id)}
                          onMouseEnter={() => {
                            clearHideEffortTimeout();
                            isHoveringModelRowRef.current = true;
                            if (modelMenuPointerReady) setHoveredModelId(m.id);
                          }}
                          onMouseMove={() => {
                            clearHideEffortTimeout();
                            isHoveringModelRowRef.current = true;
                            if (!modelMenuPointerReady) setModelMenuPointerReady(true);
                            if (hoveredModelId !== m.id) setHoveredModelId(m.id);
                          }}
                          onMouseLeave={() => {
                            isHoveringModelRowRef.current = false;
                            scheduleHideEffortSubmenu();
                          }}
                          className={cn(
                            "flex h-9 cursor-pointer items-center justify-between rounded-full pl-1.5 pr-2.5 transition-colors",
                            isHovered && "bg-secondary"
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2 pr-1">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground">
                              <ProviderBadgeIcon provider={m.provider} />
                            </span>
                            <span className="truncate text-[13px]">
                              <span className="font-medium text-foreground">{m.name}</span>
                              <span className="ml-1 font-normal text-muted-foreground">{m.effort}</span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleToggleFavStar(e, m.id)}
                              aria-label={`Toggle favourite for ${m.name}`}
                              title={m.isFav ? "Remove from favourites" : "Add to favourites"}
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-90",
                                m.isFav ? "text-warning" : "text-muted-foreground hover:text-warning"
                              )}
                            >
                              <svg
                                width="12.5"
                                height="12.5"
                                viewBox="0 0 16 16"
                                fill={m.isFav ? "currentColor" : "none"}
                                stroke="currentColor"
                                strokeWidth="1.35"
                                strokeLinejoin="round"
                              >
                                <path d="M8 1.6L9.95 5.55L14.3 6.18L11.15 9.25L11.89 13.58L8 11.53L4.11 13.58L4.85 9.25L1.7 6.18L6.05 5.55L8 1.6Z" />
                              </svg>
                            </button>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Floating effort submenu — tracks the hovered model row */}
              <div
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => {
                  clearHideEffortTimeout();
                  isHoveringEffortMenuRef.current = true;
                }}
                onMouseLeave={() => {
                  isHoveringEffortMenuRef.current = false;
                  scheduleHideEffortSubmenu();
                }}
                style={{ bottom: `${effortBottomOffsetPx}px` }}
                className={cn(
                  "absolute bottom-3 left-[calc(100%+8px)] z-30 w-36 origin-bottom-left rounded-2xl border border-border bg-popover p-2 shadow-xl transition-all duration-200 before:absolute before:-left-2 before:inset-y-0 before:w-2 before:content-['']",
                  isEffortMenuVisible
                    ? "pointer-events-auto scale-100 translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-1.5 scale-[0.97] opacity-0"
                )}
              >
                <div className="px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground">Effort</div>
                <div className="flex flex-col gap-0.5">
                  {hoveredModel?.efforts.map((level) => {
                    const isCurrentEffort = hoveredModel.effort === level;
                    return (
                      <div
                        key={level}
                        role="menuitem"
                        onClick={(e) => handleSelectEffort(e, level)}
                        className="flex h-8 cursor-pointer items-center justify-between rounded-lg px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        <span>{level}</span>
                        {isCurrentEffort && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Microphone / Record (only icon, no text) */}
            <button
              type="button"
              onClick={handleRecordClick}
              aria-label={isRecording ? "Stop voice input" : "Start voice input"}
              aria-pressed={isRecording}
              className={cn(
                pillBase,
                "flex h-9 w-9 shrink-0 items-center justify-center p-0",
                isRecording
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              {isRecording ? (
                <span className="aic-pulse-dot h-3 w-3 rounded-full bg-destructive" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            {/* Stop or Send button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop response"
                title="Stop response"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700 transition-colors active:scale-95"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitPrompt}
                disabled={disabled || !isSubmitReady}
                aria-label="Send message"
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-40",
                  isSubmitReady
                    ? "border-zinc-700 bg-white text-black hover:bg-zinc-200 active:scale-95"
                    : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-200"
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      <style>{`
        @keyframes aicPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.85); }
        }
        .aic-pulse-dot { animation: aicPulseDot 1.2s infinite ease-in-out; }
      `}</style>
    </div>
  );
}
