"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { Lock, Square } from "lucide-react";
import { BotIcon } from "../ui/bot-icon";

export type ThemeMode = "dark" | "light";
export type ComposerMode = "Delegate" | "Ask" | "About PayGuardian";
export type EffortLevel = "Low" | "Medium" | "High" | "Max";
export type ProviderType = "gemini" | "kimi" | "openai" | "spark" | "openrouter";
export type ModelFilterTab = "fav" | "all";

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
  /** Theme applied on mount and whenever the demo/control prop changes. */
  initialTheme?: ThemeMode;
  /** Disables input while the agent is drafting a response. */
  disabled?: boolean;
  /** Whether the agent is currently generating a response. */
  isStreaming?: boolean;
  /** Callback triggered when user clicks the stop button. */
  onStop?: () => void;
  /** Show the optional upgrade banner below the composer. */
  showUpgradeBanner?: boolean;
  /** Show the interactive walkthrough button. */
  showWalkthroughControl?: boolean;
  /** Receives the prompt and selected browser File objects; connect this to your AI backend. */
  onSubmit?: (submission: AIComposerSubmission) => void;
  className?: string;
  /** Whether the chat is running in incognito mode (unauthenticated visitor). */
  isIncognito?: boolean;
  /** Whether the user is authenticated. */
  isAuthenticated?: boolean;
  /** Initial mode override. */
  initialMode?: ComposerMode;
}

export interface ModelOption {
  id: string;
  name: string;
  effort: EffortLevel;
  provider: ProviderType;
  isFav: boolean;
  efforts: EffortLevel[];
}

interface ContextTagOption {
  tag: string;
  category: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const ALL_EFFORTS: EffortLevel[] = ["Low", "Medium", "High", "Max"];

const ALL_MODES: ComposerMode[] = ["About PayGuardian", "Ask", "Delegate"];

const CONTEXT_OPTIONS: ContextTagOption[] = [
  { tag: "@environment", category: "Workspace" },
  { tag: "@mandates", category: "Authority" },
  { tag: "@memory", category: "Memory vault" },
];

const FALLBACK_MODELS: ModelOption[] = [
  {
    id: "gemini-4-hydrogen",
    name: "Gemini 4 Hydrogen",
    effort: "High",
    provider: "gemini",
    isFav: true,
    efforts: ALL_EFFORTS,
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    effort: "Medium",
    provider: "gemini",
    isFav: true,
    efforts: ALL_EFFORTS,
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    effort: "Medium",
    provider: "gemini",
    isFav: false,
    efforts: ALL_EFFORTS,
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    effort: "High",
    provider: "gemini",
    isFav: false,
    efforts: ALL_EFFORTS,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra 550B (Free)",
    effort: "High",
    provider: "openrouter",
    isFav: true,
    efforts: ALL_EFFORTS,
  },
  {
    id: "baidu/ernie-5.5-flash-preview:free",
    name: "ERNIE 5.5 Flash (Free)",
    effort: "Medium",
    provider: "openrouter",
    isFav: false,
    efforts: ALL_EFFORTS,
  },
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "Nemotron 3.5 Super VL (Free)",
    effort: "High",
    provider: "openrouter",
    isFav: false,
    efforts: ALL_EFFORTS,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    effort: "Medium",
    provider: "gemini",
    isFav: false,
    efforts: ALL_EFFORTS,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    effort: "High",
    provider: "gemini",
    isFav: false,
    efforts: ALL_EFFORTS,
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    effort: "Low",
    provider: "gemini",
    isFav: false,
    efforts: ALL_EFFORTS,
  },
];

const FAVS_STORAGE_KEY = "pg_composer_fav_models";
const LAST_ACTIVE_MODEL_STORAGE_KEY = "pg_composer_active_model_id";

// Persistent global cache across component remounts / chat switches
let globalCachedModels: ModelOption[] | null = null;
let globalCachedActiveModelId: string | null = null;

function providerKeyFor(providerLabel?: string): ProviderType {
  const p = (providerLabel ?? "").toLowerCase();
  if (
    p.includes("openrouter") ||
    p.includes("nemotron") ||
    p.includes("nvidia") ||
    p.includes("baidu") ||
    p.includes("ernie")
  ) {
    return "openrouter";
  }
  if (p.includes("kimi")) return "kimi";
  if (p.includes("muse") || p.includes("spark")) return "spark";
  if (p.includes("gemini")) return "gemini";
  if (p.includes("gpt") || p.includes("openai")) return "openai";
  return "spark";
}

export function ProviderBadgeIcon({ provider }: { provider: ProviderType }) {
  if (provider === "openrouter") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2L3 7v10l9 5 9-5V7l-9-5z"
          stroke="#A855F7"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" fill="#A855F7" fillOpacity="0.8" />
        <path
          d="M12 2v7m0 6v7M3 7l7.5 4.5M13.5 12.5L21 17M21 7l-7.5 4.5M10.5 12.5L3 17"
          stroke="#A855F7"
          strokeWidth="1.2"
          strokeOpacity="0.6"
        />
      </svg>
    );
  }

  if (provider === "kimi") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path
          d="M4.2 3.2V12.8M4.2 8.2L10.4 3.2M6.8 6.2L11.2 12.8"
          stroke="#F4F4F6"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12.2" cy="4.2" r="1.15" fill="#F4F4F6" />
      </svg>
    );
  }

  if (provider === "openai") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path
          d="M21.2 10.1c.2-1.5-.2-3.1-1.2-4.3-1.3-1.6-3.4-2.3-5.4-1.8-.9-1.1-2.3-1.8-3.8-1.8-2.1 0-3.9 1.3-4.6 3.2-1.5.3-2.8 1.2-3.6 2.5-1 1.8-.9 4 .2 5.7-.2 1.5.2 3.1 1.2 4.3 1.3 1.6 3.4 2.3 5.4 1.8.9 1.1 2.3 1.8 3.8 1.8 2.1 0 3.9-1.3 4.6-3.2 1.5-.3 2.8-1.2 3.6-2.5 1.1-1.8 1-4-.2-5.7z"
          stroke="#F4F4F6"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.7" stroke="#F4F4F6" strokeWidth="1.5" />
      </svg>
    );
  }

  if (provider === "gemini") {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1.5C8.6 4.6 10.2 6.4 13.8 8C10.2 9.6 8.6 11.4 8 14.5C7.4 11.4 5.8 9.6 2.2 8C5.8 6.4 7.4 4.6 8 1.5Z"
          stroke="#60A5FA"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // spark (Anthropic / Fable radial starburst)
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
      <g stroke="#E87B58" strokeWidth="1.35" strokeLinecap="round">
        <line x1="9" y1="2.2" x2="9" y2="15.8" />
        <line x1="2.2" y1="9" x2="15.8" y2="9" />
        <line x1="4.1" y1="4.1" x2="13.9" y2="13.9" />
        <line x1="13.9" y1="4.1" x2="4.1" y2="13.9" />
        <line x1="6.4" y1="2.7" x2="11.6" y2="15.3" />
        <line x1="2.7" y1="6.4" x2="15.3" y2="11.6" />
      </g>
      <circle cx="9" cy="9" r="1.4" fill="#18181c" />
    </svg>
  );
}

function CheckmarkIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      className="flex-shrink-0"
      style={{ color: "var(--text-primary)" }}
    >
      <path
        d="M3.2 8.5L6.5 11.8L13 4.5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------- Speech Recognition typing ---------------- */
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
  initialTheme,
  disabled = false,
  isStreaming = false,
  onStop,
  showUpgradeBanner = false,
  showWalkthroughControl = false,
  onSubmit,
  className = "",
  isIncognito = false,
  isAuthenticated = true,
  initialMode,
}: AIComposerProps = {}) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme ?? "dark");
  const [promptText, setPromptText] = useState<string>("");

  const isUnauthenticated = isIncognito || !isAuthenticated;
  const [mode, setMode] = useState<ComposerMode>(() => {
    if (initialMode) return initialMode;
    if (isUnauthenticated) return "About PayGuardian";
    return "Delegate";
  });
  const [modeMenuOpen, setModeMenuOpen] = useState<boolean>(false);
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false);

  const [autoMode, setAutoMode] = useState<boolean>(false);
  const [modelMenuOpen, setModelMenuOpen] = useState<boolean>(false);
  const [searchRevealed, setSearchRevealed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [modelFilterTab, setModelFilterTab] = useState<ModelFilterTab>("fav");
  const [models, setModels] = useState<ModelOption[]>(() => globalCachedModels ?? FALLBACK_MODELS);
  const [activeModelId, setActiveModelId] = useState<string>(() => {
    if (globalCachedActiveModelId) return globalCachedActiveModelId;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(LAST_ACTIVE_MODEL_STORAGE_KEY);
      if (stored && !stored.startsWith("free/") && stored !== "gemini-3.8-flash") return stored;
    }
    return "gemini-4-hydrogen";
  });

  const selectModelId = useCallback((id: string) => {
    setActiveModelId(id);
    globalCachedActiveModelId = id;
    try {
      localStorage.setItem(LAST_ACTIVE_MODEL_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null);
  const [modelMenuPointerReady, setModelMenuPointerReady] = useState<boolean>(false);

  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [proModalOpen, setProModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isHoveringModelRowRef = useRef<boolean>(false);
  const isHoveringEffortMenuRef = useRef<boolean>(false);
  const hideEffortTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Load preferences & remote models
  useEffect(() => {
    let cancelled = false;

    const loadFavs = (list: ModelOption[]): ModelOption[] => {
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

    try {
      const savedTheme = localStorage.getItem("ai_composer_theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        setThemeState(savedTheme);
      }
    } catch {
      // ignore
    }

    if (globalCachedModels && globalCachedModels.length > 0) {
      setModels(globalCachedModels);
      return;
    }

    fetch(`${API_BASE}/v1/models`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(
        (data: {
          models?: { id: string; label: string; provider?: string; default?: boolean }[];
        }) => {
          if (cancelled) return;
          const remote = Array.isArray(data.models) && data.models.length > 0 ? data.models : null;
          const list: ModelOption[] = (remote ?? FALLBACK_MODELS).map((m) => ({
            id: m.id,
            name: "label" in m ? (m as { label: string }).label : m.id,
            effort: "Medium",
            provider: providerKeyFor("provider" in m ? (m as { provider?: string }).provider : undefined),
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
        }
      )
      .catch(() => {
        if (!cancelled) {
          const fallbackWithFavs = loadFavs(FALLBACK_MODELS);
          globalCachedModels = fallbackWithFavs;
          setModels(fallbackWithFavs);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectModelId]);

  useEffect(() => {
    if (initialTheme) setThemeState(initialTheme);
  }, [initialTheme]);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem("ai_composer_theme", nextTheme);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Voice recording interval
  useEffect(() => {
    if (!isRecording) return;
    const intervalId = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  // Global click-outside handler to close popovers
  useEffect(() => {
    const handleGlobalClick = () => {
      setModeMenuOpen(false);
      setModelMenuOpen(false);
      setHoveredModelId(null);
      setContextMenuOpen(false);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const clearHideEffortTimeout = useCallback(() => {
    if (hideEffortTimerRef.current !== null) {
      window.clearTimeout(hideEffortTimerRef.current);
      hideEffortTimerRef.current = null;
    }
  }, []);

  const scheduleHideEffortSubmenu = useCallback(() => {
    clearHideEffortTimeout();
    hideEffortTimerRef.current = window.setTimeout(() => {
      if (!isHoveringEffortMenuRef.current && !isHoveringModelRowRef.current) {
        setHoveredModelId(null);
      }
    }, 60);
  }, [clearHideEffortTimeout]);

  // Ordered modes: active mode anchored at the bottom with checkmark
  const orderedModes = useMemo(() => {
    const inactive = ALL_MODES.filter((m) => m !== mode);
    return [...inactive, mode];
  }, [mode]);

  const activeModel = useMemo(
    () => models.find((m) => m.id === activeModelId) || models[0],
    [models, activeModelId]
  );

  const favCount = useMemo(() => models.filter((m) => m.isFav).length, [models]);

  const visibleModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return models.filter((m) => {
      const matchesTab = modelFilterTab === "fav" ? m.isFav : true;
      const matchesSearch =
        m.name.toLowerCase().includes(q) || m.effort.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [models, modelFilterTab, searchQuery]);

  const hoveredModel = useMemo(
    () => (hoveredModelId ? models.find((m) => m.id === hoveredModelId) || null : null),
    [models, hoveredModelId]
  );

  // Vertical bottom offset so the Effort submenu tracks the hovered model row
  const effortBottomOffsetPx = useMemo(() => {
    if (!hoveredModelId) return 0;
    const idx = visibleModels.findIndex((m) => m.id === hoveredModelId);
    if (idx < 0) return 0;
    const rowsFromBottom = visibleModels.length - 1 - idx;
    return rowsFromBottom <= 1 ? 0 : Math.min(96, (rowsFromBottom - 1) * 28);
  }, [visibleModels, hoveredModelId]);

  const isEffortMenuVisible =
    modelMenuOpen && searchQuery.trim().length === 0 && hoveredModel !== null;

  const handleToggleFavStar = (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    setModels((prev) => {
      const updated = prev.map((m) => {
        if (m.id !== targetId) return m;
        return { ...m, isFav: !m.isFav };
      });
      const targetAfter = updated.find((m) => m.id === targetId);
      if (targetAfter?.isFav) {
        selectModelId(targetId);
        setAutoMode(false);
      }
      try {
        const favIds = updated.filter((m) => m.isFav).map((m) => m.id);
        localStorage.setItem(FAVS_STORAGE_KEY, JSON.stringify(favIds));
      } catch {
        // Ignore storage errors
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
    setModels((prev) =>
      prev.map((m) => (m.id === hoveredModelId ? { ...m, effort } : m))
    );
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
      window.setTimeout(() => {
        setSearchRevealed(true);
      }, 160);
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

  const handleRecordClick = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const w = window as SpeechRecognitionWindow;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (SR) {
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
      try {
        recognition.start();
      } catch {
        // ignore
      }
    } else {
      setRecordingSeconds(0);
      setIsRecording(true);
    }
  };

  const handleSubmitPrompt = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }

    const trimmed = promptText.trim();
    if (!trimmed && attachedFiles.length === 0) {
      return;
    }

    const submission: AIComposerSubmission = {
      prompt: trimmed,
      mode,
      modelId: activeModel.id,
      modelName: activeModel.name,
      effort: activeModel.effort,
      autoMode,
      attachedFiles: [...attachedFiles],
      files: [...selectedFiles],
    };

    try {
      onSubmit?.(submission);
    } catch {
      setToastMessage("The request handler failed. Please try again.");
      return;
    }

    setPromptText("");
    setAttachedFiles([]);
    setSelectedFiles([]);
    setContextMenuOpen(false);
    if (promptInputRef.current) {
      promptInputRef.current.style.height = "auto";
    }
  };

  const formattedRecordingTime = useMemo(() => {
    const mins = Math.floor(recordingSeconds / 60);
    const secs = String(recordingSeconds % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  }, [recordingSeconds]);

  const isSubmitReady = promptText.trim().length > 0 || attachedFiles.length > 0;

  const renderModelMenuContent = () => (
    <>
      {/* Collapsible Search Models Input at Top */}
      <div
        onMouseEnter={() => {
          isHoveringModelRowRef.current = false;
          setHoveredModelId(null);
        }}
        className={`aic-search-row-wrap ${
          searchRevealed || searchQuery.length > 0 ? "revealed" : ""
        }`}
      >
        <div className="flex items-center gap-2 px-2.5 h-8 rounded-lg">
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            className="flex-shrink-0"
            style={{ color: "var(--text-secondary)" }}
          >
            <circle
              cx="7.2"
              cy="7.2"
              r="4.8"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M10.8 10.8L13.8 13.8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search models"
            autoComplete="off"
            className="w-full bg-transparent border-none outline-none text-[14.5px] font-normal tracking-[-0.011em]"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
      </div>

      {/* Auto Toggle Row */}
      <div
        onMouseEnter={() => {
          isHoveringModelRowRef.current = false;
          setHoveredModelId(null);
        }}
        className="flex items-center justify-between px-2.5 h-9"
      >
        <span
          className="text-[15px] font-medium tracking-[-0.011em]"
          style={{ color: "var(--text-primary)" }}
        >
          Auto
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={autoMode}
          onClick={handleToggleAutoInMenu}
          className={`aic-ios-switch ${autoMode ? "on" : ""}`}
        >
          <span className="aic-ios-switch-thumb" />
        </button>
      </div>

      {/* Segmented Filter Bar Below Auto */}
      <div
        role="tablist"
        aria-label="Filter models"
        onMouseEnter={() => {
          isHoveringModelRowRef.current = false;
          setHoveredModelId(null);
        }}
        className="aic-model-filter-bar"
      >
        <button
          type="button"
          role="tab"
          aria-selected={modelFilterTab === "fav"}
          onClick={(e) => {
            e.stopPropagation();
            setModelFilterTab("fav");
            setHoveredModelId(null);
          }}
          className={`aic-model-filter-pill ${
            modelFilterTab === "fav" ? "active" : ""
          }`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill={modelFilterTab === "fav" ? "#FACC15" : "none"}
            stroke={modelFilterTab === "fav" ? "#FACC15" : "currentColor"}
            strokeWidth="1.4"
            strokeLinejoin="round"
            className="flex-shrink-0"
          >
            <path d="M8 1.6L9.95 5.55L14.3 6.18L11.15 9.25L11.89 13.58L8 11.53L4.11 13.58L4.85 9.25L1.7 6.18L6.05 5.55L8 1.6Z" />
          </svg>
          <span>fav</span>
          {favCount > 0 && (
            <span
              className="text-[11.5px] font-normal opacity-75"
              style={{ color: "var(--text-secondary)" }}
            >
              {favCount}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={modelFilterTab === "all"}
          onClick={(e) => {
            e.stopPropagation();
            setModelFilterTab("all");
            setHoveredModelId(null);
          }}
          className={`aic-model-filter-pill ${
            modelFilterTab === "all" ? "active" : ""
          }`}
        >
          <span>all</span>
          <span
            className="text-[11.5px] font-normal opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            {models.length}
          </span>
        </button>
      </div>

      {/* Models List */}
      <div className="flex flex-col gap-0.5 max-h-[220px] overflow-y-auto no-scrollbar">
        {visibleModels.length === 0 ? (
          <div
            className="px-3 py-3 text-center text-[13px] tracking-[-0.01em]"
            style={{ color: "var(--text-secondary)" }}
          >
            {modelFilterTab === "fav" ? (
              <>
                No favourite models yet. Switch to{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModelFilterTab("all");
                  }}
                  className="underline font-medium"
                  style={{ color: "var(--text-primary)" }}
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
            const isHovered =
              m.id === hoveredModelId && searchQuery.trim().length === 0;
            return (
              <div
                key={m.id}
                onClick={(e) => handleSelectModel(e, m.id)}
                onMouseEnter={() => {
                  clearHideEffortTimeout();
                  isHoveringModelRowRef.current = true;
                  if (modelMenuPointerReady) {
                    setHoveredModelId(m.id);
                  }
                }}
                onMouseMove={() => {
                  clearHideEffortTimeout();
                  isHoveringModelRowRef.current = true;
                  if (hoveredModelId !== m.id) {
                    setHoveredModelId(m.id);
                  }
                }}
                onMouseLeave={() => {
                  isHoveringModelRowRef.current = false;
                  scheduleHideEffortSubmenu();
                }}
                className={`aic-model-row ${isHovered ? "active-hover" : ""}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                  <span className="w-[26px] h-[26px] rounded-full bg-[#0c0c0f] flex items-center justify-center flex-shrink-0 border border-white/10">
                    <ProviderBadgeIcon provider={m.provider} />
                  </span>
                  <span className="text-[14.5px] truncate">
                    <span
                      className="font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {m.name}
                    </span>
                    <span
                      className="font-normal ml-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {m.effort}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleToggleFavStar(e, m.id)}
                    className={`aic-fav-star-btn ${m.isFav ? "starred" : ""}`}
                    title={
                      m.isFav
                        ? "Remove from favourites"
                        : "Add to favourites"
                    }
                    aria-label={`Toggle favourite for ${m.name}`}
                  >
                    {m.isFav ? (
                      <svg
                        width="13.5"
                        height="13.5"
                        viewBox="0 0 16 16"
                        fill="#FACC15"
                        stroke="#FACC15"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      >
                        <path d="M8 1.6L9.95 5.55L14.3 6.18L11.15 9.25L11.89 13.58L8 11.53L4.11 13.58L4.85 9.25L1.7 6.18L6.05 5.55L8 1.6Z" />
                      </svg>
                    ) : (
                      <svg
                        width="13.5"
                        height="13.5"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.35"
                        strokeLinejoin="round"
                      >
                        <path d="M8 1.6L9.95 5.55L14.3 6.18L11.15 9.25L11.89 13.58L8 11.53L4.11 13.58L4.85 9.25L1.7 6.18L6.05 5.55L8 1.6Z" />
                      </svg>
                    )}
                  </button>
                  {isSelected && <CheckmarkIcon />}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div
      data-theme={theme}
      aria-label="AI prompt composer"
      className={`aic-root relative flex flex-col items-center w-full select-none ${className}`}
      style={{
        color: "var(--text-primary)",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontFeatureSettings: "'cv02', 'cv03', 'cv04', 'cv11'",
      }}
    >
      <style>{`
        .aic-root[data-theme="dark"] {
          --bg-canvas: #3e3c44;
          --card-bg: #18181c;
          --card-border: rgba(255, 255, 255, 0.065);
          --card-focus-border: rgba(255, 255, 255, 0.12);
          --card-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.45), 0 1px 0 0 rgba(255, 255, 255, 0.05) inset;

          --pill-bg: #26262c;
          --pill-hover-bg: #2d2d34;
          --pill-border: rgba(255, 255, 255, 0.095);
          --pill-hover-border: rgba(255, 255, 255, 0.15);
          --pill-inset: 0 1px 0 0 rgba(255, 255, 255, 0.05) inset;

          --ghost-hover-bg: rgba(255, 255, 255, 0.045);
          --ghost-hover-border: rgba(255, 255, 255, 0.075);

          --popover-bg-start: #2b2b33;
          --popover-bg-end: #1f1f25;
          --popover-border: rgba(255, 255, 255, 0.12);
          --popover-shadow: 0 22px 48px -10px rgba(0, 0, 0, 0.65), 0 1px 0 0 rgba(255, 255, 255, 0.08) inset;
          --menu-item-hover: rgba(255, 255, 255, 0.065);
          --model-row-hover: rgba(14, 14, 18, 0.68);

          --filter-track-bg: rgba(12, 12, 16, 0.48);
          --filter-track-border: rgba(255, 255, 255, 0.06);
          --filter-active-bg: #2c2c35;
          --filter-active-border: rgba(255, 255, 255, 0.11);
          --filter-active-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);

          --text-primary: #f4f4f6;
          --text-secondary: #8e8d95;
          --text-muted: #6e6d76;
          --placeholder-color: #8c8b93;
          --icon-primary: #e4e4e8;
          --chevron-color: #9e9da6;
          --effort-header: #d4d4d8;

          --submit-bg: #222227;
          --submit-border: rgba(255, 255, 255, 0.08);
          --submit-color: #7c7b84;
          --submit-ready-bg: #2d2d35;
          --submit-ready-border: rgba(255, 255, 255, 0.16);
          --submit-ready-color: #f4f4f6;

          --switch-off-bg: #484852;
          --accent-blue: #1d74f5;
          --accent-coral: #e87b58;

          --pro-banner-bg:
            radial-gradient(ellipse 52% 130% at 81% 50%, rgba(58, 126, 86, 0.56) 0%, rgba(34, 78, 52, 0.32) 48%, rgba(24, 24, 28, 0.96) 85%),
            #18181c;
          --pro-banner-border: rgba(255, 255, 255, 0.065);
          --pro-banner-shadow: 0 14px 32px -12px rgba(0, 0, 0, 0.4), -1px 0 0 0 rgba(120, 200, 150, 0.22) inset;
          --pro-banner-mask: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.05) 55%, rgba(126, 204, 155, 0.32) 85%, rgba(126, 204, 155, 0.18) 100%);
          --pro-link-color: #8da8ff;
          --pro-link-underline: rgba(141, 168, 255, 0.45);
          --pro-link-hover: #a8beff;
          --upgrade-btn-bg: rgba(96, 148, 114, 0.48);
          --upgrade-btn-border: rgba(168, 222, 186, 0.36);
          --upgrade-btn-text: #f4f4f6;
          --upgrade-btn-hover-bg: rgba(112, 168, 132, 0.65);
          --upgrade-btn-hover-border: rgba(190, 240, 205, 0.55);
          --dismiss-color: #a5b8ac;

          --toast-bg: rgba(30, 30, 36, 0.95);
          --toast-border: rgba(255, 255, 255, 0.1);
          --chip-bg: #24242b;
          --chip-border: rgba(255, 255, 255, 0.1);
          --floating-bar-bg: rgba(24, 24, 28, 0.82);
          --floating-bar-border: rgba(255, 255, 255, 0.1);
          --modal-bg: #1b1b21;
          --modal-border: rgba(255, 255, 255, 0.15);
        }

        .aic-root[data-theme="light"] {
          --bg-canvas: #ececef;
          --card-bg: #ffffff;
          --card-border: rgba(24, 24, 28, 0.085);
          --card-focus-border: rgba(24, 24, 28, 0.16);
          --card-shadow: 0 20px 44px -16px rgba(15, 23, 42, 0.09), 0 2px 8px -2px rgba(15, 23, 42, 0.04), 0 1px 0 0 rgba(255, 255, 255, 0.9) inset;

          --pill-bg: #f3f3f6;
          --pill-hover-bg: #eaeaf0;
          --pill-border: rgba(24, 24, 28, 0.09);
          --pill-hover-border: rgba(24, 24, 28, 0.16);
          --pill-inset: 0 1px 0 0 rgba(255, 255, 255, 0.8) inset;

          --ghost-hover-bg: rgba(24, 24, 28, 0.045);
          --ghost-hover-border: rgba(24, 24, 28, 0.08);

          --popover-bg-start: #ffffff;
          --popover-bg-end: #f7f7fa;
          --popover-border: rgba(24, 24, 28, 0.11);
          --popover-shadow: 0 22px 48px -12px rgba(15, 23, 42, 0.16), 0 4px 14px -4px rgba(15, 23, 42, 0.07), 0 1px 0 0 rgba(255, 255, 255, 0.9) inset;
          --menu-item-hover: rgba(24, 24, 28, 0.055);
          --model-row-hover: rgba(24, 24, 28, 0.065);

          --filter-track-bg: rgba(24, 24, 28, 0.055);
          --filter-track-border: rgba(24, 24, 28, 0.06);
          --filter-active-bg: #ffffff;
          --filter-active-border: rgba(24, 24, 28, 0.09);
          --filter-active-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);

          --text-primary: #18181c;
          --text-secondary: #6c6b74;
          --text-muted: #94939d;
          --placeholder-color: #82818a;
          --icon-primary: #27272c;
          --chevron-color: #6c6b74;
          --effort-header: #52525b;

          --submit-bg: #f3f3f6;
          --submit-border: rgba(24, 24, 28, 0.085);
          --submit-color: #8e8d96;
          --submit-ready-bg: #18181c;
          --submit-ready-border: #18181c;
          --submit-ready-color: #ffffff;

          --switch-off-bg: #d0d0d8;
          --accent-blue: #1d74f5;
          --accent-coral: #e87b58;

          --pro-banner-bg:
            radial-gradient(ellipse 52% 130% at 81% 50%, rgba(52, 168, 108, 0.24) 0%, rgba(110, 205, 150, 0.12) 48%, rgba(255, 255, 255, 0.98) 85%),
            #ffffff;
          --pro-banner-border: rgba(24, 24, 28, 0.085);
          --pro-banner-shadow: 0 14px 32px -12px rgba(15, 23, 42, 0.08), -1px 0 0 0 rgba(45, 160, 100, 0.18) inset;
          --pro-banner-mask: linear-gradient(90deg, rgba(24,24,28,0.03) 0%, rgba(24,24,28,0.04) 55%, rgba(45, 160, 100, 0.32) 85%, rgba(45, 160, 100, 0.18) 100%);
          --pro-link-color: #3b63e6;
          --pro-link-underline: rgba(59, 99, 230, 0.4);
          --pro-link-hover: #1d4ed8;
          --upgrade-btn-bg: rgba(36, 138, 84, 0.15);
          --upgrade-btn-border: rgba(36, 138, 84, 0.35);
          --upgrade-btn-text: #145332;
          --upgrade-btn-hover-bg: rgba(36, 138, 84, 0.24);
          --upgrade-btn-hover-border: rgba(36, 138, 84, 0.5);
          --dismiss-color: #5b7667;

          --toast-bg: rgba(255, 255, 255, 0.95);
          --toast-border: rgba(24, 24, 28, 0.1);
          --chip-bg: #ffffff;
          --chip-border: rgba(24, 24, 28, 0.12);
          --floating-bar-bg: rgba(255, 255, 255, 0.88);
          --floating-bar-border: rgba(24, 24, 28, 0.1);
          --modal-bg: #ffffff;
          --modal-border: rgba(24, 24, 28, 0.12);
        }

        .aic-composer-card {
          position: relative;
          width: 100%;
          overflow: visible;
          background: var(--card-bg);
          border-radius: 20px;
          border: 1px solid var(--card-border);
          box-shadow: var(--card-shadow);
          padding: 11px 12px 10px 12px;
          transition: background-color 0.25s ease, border-color 0.2s ease, box-shadow 0.25s ease;
        }

        @media (min-width: 640px) {
          .aic-composer-card {
            border-radius: 24px;
            padding: 20px 18px 16px 18px;
          }
        }

        .aic-composer-card:focus-within {
          border-color: var(--card-focus-border);
        }

        .aic-prompt-input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          color: var(--text-primary);
          font-family: inherit;
          font-size: 15px;
          line-height: 1.45;
          font-weight: 400;
          letter-spacing: -0.011em;
          min-height: 26px;
          max-height: 160px;
          padding: 0 2px;
          margin-bottom: 8px;
          user-select: text;
          transition: color 0.2s ease;
        }

        @media (min-width: 640px) {
          .aic-prompt-input {
            font-size: 16px;
            line-height: 1.5;
            min-height: 28px;
            max-height: 180px;
            margin-bottom: 18px;
          }
        }

        .aic-prompt-input::placeholder {
          color: var(--placeholder-color);
          opacity: 1;
        }

        .aic-pill-control {
          height: 34px;
          border-radius: 9999px;
          background: var(--pill-bg);
          border: 1px solid var(--pill-border);
          box-shadow: var(--pill-inset);
          color: var(--text-primary);
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition:
            width 0.28s cubic-bezier(0.22, 1, 0.36, 1),
            background-color 0.18s ease,
            border-color 0.18s ease,
            color 0.18s ease,
            transform 0.12s ease;
        }

        @media (min-width: 640px) {
          .aic-pill-control {
            height: 38px;
          }
        }

        .aic-pill-control:hover:not(:disabled) {
          background: var(--pill-hover-bg);
          border-color: var(--pill-hover-border);
        }

        .aic-pill-control:active:not(:disabled) {
          transform: scale(0.98);
        }

        .aic-pill-control:disabled,
        .aic-pill-control[disabled] {
          opacity: 0.38;
          cursor: not-allowed;
        }

        .aic-add-files-btn {
          width: 38px;
          padding: 0 10px;
          justify-content: flex-start;
          flex-shrink: 0;
        }

        .aic-add-files-btn:hover:not(:disabled) {
          width: 116px;
          padding: 0 13px 0 11px;
        }

        .aic-add-files-btn:disabled:hover,
        .aic-add-files-btn[disabled]:hover {
          width: 38px;
          padding: 0 10px;
          background: var(--pill-bg);
          border-color: var(--pill-border);
        }

        .aic-add-files-btn:disabled .aic-add-files-label,
        .aic-add-files-btn[disabled] .aic-add-files-label {
          display: none;
        }

        .aic-add-files-label {
          opacity: 0;
          transform: translateX(-6px);
          white-space: nowrap;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.011em;
          margin-left: 7px;
          transition:
            opacity 0.2s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
        }

        .aic-add-files-btn:hover .aic-add-files-label {
          opacity: 1;
          transform: translateX(0);
        }

        .aic-mode-btn {
          padding: 0 11px 0 13px;
          gap: 6px;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.011em;
          flex-shrink: 0;
        }

        @media (min-width: 640px) {
          .aic-mode-btn {
            padding: 0 13px 0 15px;
            gap: 7px;
            font-size: 15px;
          }
        }

        .aic-mode-btn.menu-open .mode-btn-text {
          color: var(--text-muted);
        }

        .aic-model-trigger-mobile {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 7px 2px 5px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: -0.01em;
          cursor: pointer;
          max-width: 100%;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .aic-model-trigger-mobile:hover,
        .aic-model-trigger-mobile.menu-open {
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.14);
        }

        .aic-model-trigger-btn {
          height: 38px;
          border-radius: 9999px;
          padding: 0 11px 0 7px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-primary);
          font-family: inherit;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.011em;
          cursor: pointer;
          flex-shrink: 0;
          transition:
            background-color 0.2s ease,
            border-color 0.2s ease,
            color 0.2s ease,
            padding 0.24s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .aic-model-trigger-btn:hover {
          background: var(--ghost-hover-bg);
          border-color: var(--ghost-hover-border);
        }

        .aic-auto-trigger-btn {
          height: 38px;
          border-radius: 9999px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-primary);
          font-family: inherit;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.011em;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.24s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .aic-auto-trigger-btn:hover {
          background: var(--pill-bg);
          border-color: var(--pill-border);
          box-shadow: var(--pill-inset);
          padding: 0 11px 0 14px;
          gap: 12px;
        }

        .aic-auto-trigger-btn .aic-auto-chevron {
          display: inline-flex;
        }

        .aic-auto-trigger-btn .aic-auto-inline-switch {
          display: none;
          align-items: center;
        }

        .aic-auto-trigger-btn:hover .aic-auto-chevron {
          display: none;
        }

        .aic-auto-trigger-btn:hover .aic-auto-inline-switch {
          display: inline-flex;
        }

        .aic-record-btn {
          width: 34px;
          height: 34px;
          padding: 0 9px;
          justify-content: flex-start;
          flex-shrink: 0;
        }

        @media (min-width: 640px) {
          .aic-record-btn {
            width: 38px;
            height: 38px;
            padding: 0 10px;
          }
        }

        .aic-record-btn:hover,
        .aic-record-btn.recording {
          width: 95px;
          padding: 0 12px 0 9px;
        }

        @media (min-width: 640px) {
          .aic-record-btn:hover,
          .aic-record-btn.recording {
            width: 105px;
            padding: 0 14px 0 11px;
          }
        }

        .aic-record-btn.recording {
          background: rgba(239, 68, 68, 0.16);
          border-color: rgba(239, 68, 68, 0.45);
          color: #ef4444;
        }

        .aic-record-label {
          opacity: 0;
          transform: translateX(6px);
          white-space: nowrap;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.011em;
          margin-left: 6px;
          transition:
            opacity 0.2s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
        }

        @media (min-width: 640px) {
          .aic-record-label {
            font-size: 15px;
            margin-left: 7px;
          }
        }

        .aic-record-btn:hover .aic-record-label,
        .aic-record-btn.recording .aic-record-label {
          opacity: 1;
          transform: translateX(0);
        }

        .aic-submit-btn {
          width: 34px;
          height: 34px;
          border-radius: 9999px;
          background: var(--submit-bg);
          border: 1px solid var(--submit-border);
          color: var(--submit-color);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.18s ease;
        }

        @media (min-width: 640px) {
          .aic-submit-btn {
            width: 38px;
            height: 38px;
          }
        }

        .aic-submit-btn:hover,
        .aic-submit-btn.ready {
          background: var(--submit-ready-bg);
          border-color: var(--submit-ready-border);
          color: var(--submit-ready-color);
        }

        .aic-submit-btn:active {
          transform: scale(0.95);
        }

        .aic-glass-popover {
          background: linear-gradient(160deg, var(--popover-bg-start) 0%, var(--popover-bg-end) 100%);
          border: 1px solid var(--popover-border);
          box-shadow: var(--popover-shadow);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          transform-origin: bottom left;
          transition:
            opacity 0.18s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
            bottom 0.18s cubic-bezier(0.22, 1, 0.36, 1),
            background 0.22s ease,
            border-color 0.22s ease;
        }

        .aic-popover-hidden {
          opacity: 0;
          transform: translateY(6px) scale(0.97);
          pointer-events: none;
        }

        .aic-popover-visible {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        .aic-effort-submenu-bridge::before {
          content: "";
          position: absolute;
          top: -8px;
          bottom: -8px;
          left: -16px;
          width: 16px;
        }

        .aic-mode-menu-item {
          height: 36px;
          padding: 0 14px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: inherit;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.011em;
          color: var(--text-primary);
          cursor: pointer;
          transition: background-color 0.14s ease, color 0.14s ease;
        }

        .aic-mode-menu-item:hover {
          background: var(--menu-item-hover);
        }

        .aic-model-filter-bar {
          display: flex;
          align-items: center;
          padding: 2px;
          margin: 2px 6px 6px 6px;
          border-radius: 9999px;
          background: var(--filter-track-bg);
          border: 1px solid var(--filter-track-border);
        }

        .aic-model-filter-pill {
          flex: 1;
          height: 26px;
          padding: 0 10px;
          border-radius: 9999px;
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 500;
          letter-spacing: -0.012em;
          color: var(--text-secondary);
          background: transparent;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          transition:
            color 0.16s ease,
            background-color 0.18s cubic-bezier(0.22, 1, 0.36, 1),
            border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        .aic-model-filter-pill:hover {
          color: var(--text-primary);
        }

        .aic-model-filter-pill.active {
          color: var(--text-primary);
          background: var(--filter-active-bg);
          border-color: var(--filter-active-border);
          box-shadow: var(--filter-active-shadow);
        }

        .aic-fav-star-btn {
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          flex-shrink: 0;
          transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1), color 0.16s ease;
        }

        .aic-fav-star-btn:hover {
          color: #facc15;
          transform: scale(1.16);
        }

        .aic-fav-star-btn.starred {
          color: #facc15;
        }

        .aic-fav-star-btn:active {
          transform: scale(0.9);
        }

        .aic-model-row {
          height: 38px;
          padding: 0 11px 0 6px;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: inherit;
          letter-spacing: -0.011em;
          cursor: pointer;
          transition: background-color 0.14s ease;
        }

        .aic-model-row:hover,
        .aic-model-row.active-hover {
          background: var(--model-row-hover);
        }

        .aic-ios-switch {
          width: 40px;
          height: 23px;
          border-radius: 9999px;
          background: var(--switch-off-bg);
          padding: 2.5px;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          transition: background-color 0.2s ease;
          position: relative;
          flex-shrink: 0;
        }

        .aic-ios-switch.on {
          background: var(--accent-blue);
        }

        .aic-ios-switch-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
          transform: translateX(0);
          transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .aic-ios-switch.on .aic-ios-switch-thumb {
          transform: translateX(17px);
        }

        .aic-search-row-wrap {
          overflow: hidden;
          max-height: 0;
          opacity: 0;
          transition:
            max-height 0.24s cubic-bezier(0.22, 1, 0.36, 1),
            opacity 0.2s ease,
            margin-bottom 0.2s ease;
          margin-bottom: 0;
        }

        .aic-search-row-wrap.revealed {
          max-height: 42px;
          opacity: 1;
          margin-bottom: 4px;
        }

        @keyframes aicPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.85); }
        }

        .aic-recording-dot {
          animation: aicPulseDot 1.2s infinite ease-in-out;
        }
      `}</style>

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

      {/* Main Container */}
      <div className="w-full flex flex-col items-center relative overflow-visible">
        {/* Activity Toast */}
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="w-full mb-3 px-4 py-3 rounded-[18px] shadow-xl flex items-center justify-between text-sm transition-all"
            style={{
              background: "var(--toast-bg)",
              border: "1px solid var(--toast-border)",
              color: "var(--text-primary)",
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="truncate">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="ml-3 text-xs px-2.5 py-1 rounded-full transition"
              style={{
                background: "var(--pill-bg)",
                color: "var(--text-secondary)",
              }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Attached Context File Chips */}
        {attachedFiles.length > 0 && (
          <div className="w-full mb-2.5 flex flex-wrap gap-2">
            {attachedFiles.map((fileName, idx) => (
              <div
                key={`${fileName}-${idx}`}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs shadow-sm"
                style={{
                  background: "var(--chip-bg)",
                  border: "1px solid var(--chip-border)",
                  color: "var(--text-primary)",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <path
                    d="M9.5 2H4.5C3.67 2 3 2.67 3 3.5V12.5C3 13.33 3.67 14 4.5 14H11.5C12.33 14 13 13.33 13 12.5V5.5L9.5 2Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
                <span className="max-w-[160px] truncate">{fileName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
                    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  className="opacity-70 hover:opacity-100 ml-0.5"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Primary Composer Card */}
        <section className="aic-composer-card">
          {/* Mobile Top Row: Model Selection at Top Left (Model Name Only) */}
          <div className="flex sm:hidden items-center justify-between mb-1.5 relative overflow-visible">
            <div className="relative inline-flex items-center overflow-visible">
              <button
                type="button"
                onClick={handleOpenModelMenu}
                className={`aic-model-trigger-mobile ${modelMenuOpen ? "menu-open" : ""}`}
                aria-haspopup="true"
                aria-expanded={modelMenuOpen}
              >
                <span className="truncate max-w-[200px]" style={{ color: "var(--text-primary)" }}>
                  {autoMode ? "Auto" : activeModel.name}
                </span>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: "var(--chevron-color)" }}
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeWidth="1.65"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* Mobile Model Selector Popover */}
              <div
                onClick={(e) => e.stopPropagation()}
                className={`aic-glass-popover ${
                  modelMenuOpen ? "aic-popover-visible" : "aic-popover-hidden"
                } sm:hidden absolute left-0 bottom-[calc(100%+8px)] w-[min(280px,calc(100vw-32px))] rounded-[20px] p-2 z-50 shadow-2xl`}
              >
                {renderModelMenuContent()}
              </div>
            </div>
          </div>

          {/* @ Context Mention Popover */}
          <div
            className={`aic-glass-popover ${
              contextMenuOpen ? "aic-popover-visible" : "aic-popover-hidden"
            } absolute left-4 bottom-[calc(100%+10px)] w-56 rounded-[16px] p-1.5 z-50`}
          >
            <div
              className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              Add Context
            </div>
            {CONTEXT_OPTIONS.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={(e) => handleInsertContextTag(e, item.tag)}
                className="aic-mode-menu-item w-full text-left px-2.5 py-1.5 rounded-lg text-sm flex items-center justify-between"
              >
                <span>{item.tag}</span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {item.category}
                </span>
              </button>
            ))}
          </div>

          {/* Prompt Textarea */}
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
            className="aic-prompt-input"
            placeholder={
              mode === "About PayGuardian"
                ? "Ask anything about PayGuardian's technology, architecture & invariants..."
                : "Delegate, Ask, Automate / @ for context"
            }
            aria-label="Prompt input"
          />

          {/* Bottom Controls Bar — completely visible without scroll clipping */}
          <div className="flex items-center justify-between gap-2 relative overflow-visible">
            {/* Left Controls Group */}
            <div className="flex items-center gap-2 sm:gap-2.5 overflow-visible">
              {/* 1. "+ Add files" Button (Disabled) */}
              <button
                type="button"
                disabled
                title="File upload is disabled"
                className="aic-pill-control aic-add-files-btn hidden sm:inline-flex cursor-not-allowed opacity-40"
                aria-label="Add files (disabled)"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="flex-shrink-0"
                  style={{ color: "var(--icon-primary)" }}
                >
                  <path
                    d="M8 2.5V13.5M2.5 8H13.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="aic-add-files-label">Add files</span>
              </button>

              {/* 2. Mode Selector */}
              <div className="relative overflow-visible">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModelMenuOpen(false);
                    setHoveredModelId(null);
                    setModeMenuOpen((prev) => !prev);
                  }}
                  className={`aic-pill-control aic-mode-btn ${
                    modeMenuOpen ? "menu-open" : ""
                  }`}
                  aria-haspopup="true"
                  aria-expanded={modeMenuOpen}
                >
                  <span className="mode-btn-text transition-colors">
                    <span className="inline sm:hidden">
                      {mode === "About PayGuardian" ? "About" : mode}
                    </span>
                    <span className="hidden sm:inline">{mode}</span>
                  </span>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="mt-0.5"
                    style={{ color: "var(--chevron-color)" }}
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="currentColor"
                      strokeWidth="1.65"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {/* Mode Popover Menu */}
                <div
                  className={`aic-glass-popover ${
                    modeMenuOpen ? "aic-popover-visible" : "aic-popover-hidden"
                  } absolute left-0 bottom-[calc(100%+10px)] w-[190px] rounded-[18px] p-1.5 z-50 shadow-2xl`}
                  role="menu"
                >
                  <div className="flex flex-col gap-0.5">
                    {orderedModes.map((modeOption) => {
                      const isSelected = modeOption === mode;
                      const requiresAuth =
                        isUnauthenticated && modeOption !== "About PayGuardian";
                      return (
                        <div
                          key={modeOption}
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (requiresAuth) {
                              setModeMenuOpen(false);
                              setShowAuthDialog(true);
                              return;
                            }
                            setMode(modeOption);
                            setModeMenuOpen(false);
                          }}
                          className="aic-mode-menu-item"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="inline sm:hidden">
                              {modeOption === "About PayGuardian" ? "About" : modeOption}
                            </span>
                            <span className="hidden sm:inline">{modeOption}</span>
                            {requiresAuth && (
                              <Lock className="h-3 w-3 text-zinc-500 shrink-0" />
                            )}
                          </span>
                          {isSelected && <CheckmarkIcon />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Model & Effort Selector */}
              <div className="relative hidden sm:inline-flex items-center overflow-visible">
                {!autoMode ? (
                  <button
                    type="button"
                    onClick={handleOpenModelMenu}
                    className="aic-model-trigger-btn"
                    aria-haspopup="true"
                    aria-expanded={modelMenuOpen}
                  >
                    <span className="w-[26px] h-[26px] rounded-full bg-[#0d0d10] flex items-center justify-center flex-shrink-0 border border-white/10">
                      <ProviderBadgeIcon provider={activeModel.provider} />
                    </span>
                    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                      <span
                        className="font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {activeModel.name}
                      </span>
                      <span
                        className="font-normal"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {activeModel.effort}
                      </span>
                    </span>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="mt-0.5"
                      style={{ color: "var(--chevron-color)" }}
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="currentColor"
                        strokeWidth="1.65"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={handleOpenModelMenu}
                    className="aic-auto-trigger-btn"
                    aria-label="Auto model routing"
                  >
                    <span
                      className="font-medium select-none"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Auto
                    </span>
                    <span
                      className="aic-auto-chevron mt-0.5"
                      style={{ color: "var(--chevron-color)" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M4 6L8 10L12 6"
                          stroke="currentColor"
                          strokeWidth="1.65"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="aic-auto-inline-switch">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setAutoMode(false);
                        }}
                        className="aic-ios-switch on"
                        title="Turn off Auto routing"
                      >
                        <span className="aic-ios-switch-thumb" />
                      </span>
                    </span>
                  </div>
                )}

                {/* Model Selector Popover Menu */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`aic-glass-popover ${
                    modelMenuOpen ? "aic-popover-visible" : "aic-popover-hidden"
                  } absolute left-0 bottom-[calc(100%+10px)] w-[270px] rounded-[20px] p-2 z-50 shadow-2xl`}
                >
                  {renderModelMenuContent()}
                </div>

                {/* Floating Effort Submenu */}
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
                  style={{
                    bottom: `calc(100% + 10px + ${effortBottomOffsetPx}px)`,
                  }}
                  className={`aic-glass-popover aic-effort-submenu-bridge ${
                    isEffortMenuVisible ? "aic-popover-visible" : "aic-popover-hidden"
                  } hidden sm:block absolute left-[280px] w-[148px] rounded-[18px] p-2 z-50 shadow-2xl`}
                >
                  <div
                    className="px-2.5 py-1.5 text-[14.5px] font-medium tracking-[-0.011em]"
                    style={{ color: "var(--effort-header)" }}
                  >
                    Effort
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {hoveredModel?.efforts.map((level) => {
                      const isCurrentEffort = hoveredModel.effort === level;
                      return (
                        <div
                          key={level}
                          onClick={(e) => handleSelectEffort(e, level)}
                          className="aic-mode-menu-item h-[34px] px-2.5 text-[14.5px]"
                        >
                          <span>{level}</span>
                          {isCurrentEffort && <CheckmarkIcon />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Controls Group */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 ml-auto">
              {/* 4. Microphone / "Record" Expanding Button */}
              <button
                type="button"
                onClick={handleRecordClick}
                className={`aic-pill-control aic-record-btn ${
                  isRecording ? "recording" : ""
                }`}
                aria-label="Record voice input"
              >
                <span
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{ color: "var(--icon-primary)" }}
                >
                  {isRecording ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 aic-recording-dot" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect
                        x="5.5"
                        y="1.8"
                        width="5"
                        height="7.6"
                        rx="2.5"
                        stroke="currentColor"
                        strokeWidth="1.45"
                      />
                      <path
                        d="M3.2 7.2C3.2 9.85 5.35 12 8 12C10.65 12 12.8 9.85 12.8 7.2"
                        stroke="currentColor"
                        strokeWidth="1.45"
                        strokeLinecap="round"
                      />
                      <path
                        d="M8 12V14.2M5.8 14.2H10.2"
                        stroke="currentColor"
                        strokeWidth="1.45"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="aic-record-label">
                  {isRecording ? formattedRecordingTime : "Record"}
                </span>
              </button>

              {/* 5. Submit or Stop Button */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop response"
                  className="aic-submit-btn ready"
                  style={{ background: "#2d2d35", color: "#f4f4f6" }}
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitPrompt}
                  disabled={disabled || !isSubmitReady}
                  className={`aic-submit-btn ${isSubmitReady ? "ready" : ""}`}
                  aria-label="Submit prompt"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 12.8V3.2M8 3.2L3.8 7.4M8 3.2L12.2 7.4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Optional "Upgrade to Pro" Banner */}
        {showUpgradeBanner && !bannerDismissed && (
          <aside className="aic-pro-banner">
            <div className="flex items-center gap-1.5 text-[15px] tracking-[-0.011em] truncate pr-2">
              <span
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Upgrade to Pro.
              </span>
              <button
                type="button"
                onClick={() => setProModalOpen(true)}
                className="aic-pro-link font-normal"
              >
                See Pro benefits
              </button>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setProModalOpen(true)}
                className="aic-upgrade-pill-btn"
              >
                Upgrade
              </button>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="transition-opacity hover:opacity-100 opacity-75 p-1"
                style={{ color: "var(--dismiss-color)" }}
                aria-label="Dismiss Upgrade banner"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Floating Theme Switcher & Demo Tour Controls (when showWalkthroughControl is true) */}
      {showWalkthroughControl && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 z-20 flex-wrap justify-end">
          <div
            className="aic-floating-control-pill p-1 rounded-full shadow-lg flex items-center gap-0.5"
            role="group"
            aria-label="Theme selector"
          >
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`aic-theme-segment-btn ${theme === "light" ? "active" : ""}`}
              aria-pressed={theme === "light"}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.45 4.45M11.55 11.55L12.6 12.6M12.6 3.4L11.55 4.45M4.45 11.55L3.4 12.6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              <span>Light</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`aic-theme-segment-btn ${theme === "dark" ? "active" : ""}`}
              aria-pressed={theme === "dark"}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z"
                  stroke="currentColor"
                  strokeWidth="1.45"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Dark</span>
            </button>
          </div>
        </div>
      )}

      {/* Pro Benefits Modal */}
      {proModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setProModalOpen(false);
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            className="w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden transition-colors"
            style={{
              background: "var(--modal-bg)",
              border: "1px solid var(--modal-border)",
              color: "var(--text-primary)",
            }}
          >
            <div
              className="p-6"
              style={{
                background:
                  "radial-gradient(circle at 85% 15%, rgba(58, 126, 86, 0.28), transparent 65%)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                  Pro Plan
                </span>
                <button
                  type="button"
                  onClick={() => setProModalOpen(false)}
                  className="opacity-70 hover:opacity-100 p-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <h2
                className="text-lg font-semibold mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                Unlock Full Frontier Reasoning
              </h2>
              <p
                className="text-sm mb-5"
                style={{ color: "var(--text-secondary)" }}
              >
                Access Max effort compute across models with unlimited context attachments.
              </p>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setProModalOpen(false)}
                  className="px-4 py-2 rounded-full text-sm transition"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Required Dialog Modal */}
      {showAuthDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => {
            setShowAuthDialog(false);
            setMode("About PayGuardian");
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => {
                setShowAuthDialog(false);
                setMode("About PayGuardian");
              }}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BotIcon size={22} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Authentication Required</h3>
                <p className="text-xs text-zinc-400">Agent execution and spending authority</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-zinc-300 leading-relaxed">
              To delegate spending authority, invoke specialist subagents, or execute transactions, please sign in.
              In incognito mode, you can query the main agent about PayGuardian&apos;s architecture and security via <strong>About PayGuardian</strong>.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAuthDialog(false);
                  setMode("About PayGuardian");
                }}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
              >
                Stay in Incognito
              </button>
              <Link
                href="/login"
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIComposer;
