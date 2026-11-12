"use client";

import { useEffect, useRef, useState } from "react";

export type StreamSpeedMode = "char" | "word" | "line" | "instant";

export interface AdaptiveStreamOptions {
  /** Interval in ms for character-by-character animation (default: 25) */
  charInterval?: number;
  /** Interval in ms for word-by-word animation (default: 15) */
  wordInterval?: number;
  /** Interval in ms for line-by-line animation (default: 8) */
  lineInterval?: number;
  /** Backlog threshold in characters for character mode (default: 15) */
  charThreshold?: number;
  /** Backlog threshold in characters for word mode (default: 80) */
  wordThreshold?: number;
  /** Backlog threshold above which instant flush occurs (default: 250) */
  instantFlushThreshold?: number;
}

const DEFAULT_OPTIONS: Required<AdaptiveStreamOptions> = {
  charInterval: 25,
  wordInterval: 15,
  lineInterval: 8,
  charThreshold: 15,
  wordThreshold: 80,
  instantFlushThreshold: 250,
};

/**
 * Returns the next character / grapheme cluster from the unrendered text.
 */
function getNextCharChunk(unrendered: string): string {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      const iterator = segmenter.segment(unrendered)[Symbol.iterator]();
      const first = iterator.next();
      if (!first.done && first.value) {
        return first.value.segment;
      }
    } catch {
      // Fall through if Segmenter fails
    }
  }
  const chars = Array.from(unrendered);
  return chars[0] || unrendered.charAt(0) || "";
}

/**
 * Returns the next word chunk from unrendered text (including leading/trailing whitespace).
 */
function getNextWordChunk(unrendered: string): string {
  const match = unrendered.match(/^(\s*\S+\s*)/);
  if (match && match[0]) {
    return match[0];
  }
  return getNextCharChunk(unrendered);
}

/**
 * Returns the next line chunk (or slice up to ~80 chars if no newline) from unrendered text.
 */
function getNextLineChunk(unrendered: string): string {
  const newlineIdx = unrendered.indexOf("\n");
  if (newlineIdx !== -1) {
    return unrendered.slice(0, newlineIdx + 1);
  }
  if (unrendered.length <= 80) {
    return unrendered;
  }
  const slice = unrendered.slice(0, 80);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 40) {
    return unrendered.slice(0, lastSpace + 1);
  }
  return slice;
}

/**
 * Utility class for adaptive streaming calculations and standalone rendering.
 */
export class AdaptiveStreamRenderer {
  private targetText = "";
  private displayedText = "";
  private isStreaming = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onUpdate?: (displayed: string) => void;
  private lastChunkTime = 0;
  private lastChunkSize = 0;
  private options: Required<AdaptiveStreamOptions>;

  constructor(options?: AdaptiveStreamOptions, onUpdate?: (displayed: string) => void) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.onUpdate = onUpdate;
  }

  public setUpdateListener(onUpdate: (displayed: string) => void) {
    this.onUpdate = onUpdate;
  }

  public update(targetText: string, isStreaming: boolean): string {
    const prevTargetLength = this.targetText.length;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();

    if (targetText.length > prevTargetLength) {
      this.lastChunkSize = targetText.length - prevTargetLength;
      this.lastChunkTime = now;
    }

    this.targetText = targetText;
    this.isStreaming = isStreaming;

    // If streaming ended or target is empty, immediately flush
    if (!isStreaming) {
      this.flush();
      return this.displayedText;
    }

    // If target was completely reset (new turn or cleared)
    if (!targetText.startsWith(this.displayedText)) {
      this.displayedText = "";
      if (this.onUpdate) this.onUpdate(this.displayedText);
    }

    this.scheduleNextStep();
    return this.displayedText;
  }

  public flush() {
    this.clearTimer();
    this.displayedText = this.targetText;
    if (this.onUpdate) {
      this.onUpdate(this.displayedText);
    }
  }

  public getDisplayedText(): string {
    return this.displayedText;
  }

  public destroy() {
    this.clearTimer();
    this.onUpdate = undefined;
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNextStep() {
    if (this.timer !== null) return;

    const backlog = this.targetText.length - this.displayedText.length;
    if (backlog <= 0) return;

    const unrendered = this.targetText.slice(this.displayedText.length);
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const isBurst =
      this.lastChunkSize > this.options.wordThreshold ||
      (now - this.lastChunkTime < 40 && this.lastChunkSize > 35);

    let advanceChunk = "";
    let delay = this.options.charInterval;

    if (backlog >= this.options.instantFlushThreshold) {
      advanceChunk = unrendered;
      delay = 0;
    } else if (backlog > this.options.wordThreshold || isBurst) {
      advanceChunk = getNextLineChunk(unrendered);
      delay = this.options.lineInterval;
    } else if (backlog >= this.options.charThreshold) {
      advanceChunk = getNextWordChunk(unrendered);
      delay = this.options.wordInterval;
    } else {
      advanceChunk = getNextCharChunk(unrendered);
      delay = this.options.charInterval;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.displayedText += advanceChunk;
      if (this.onUpdate) {
        this.onUpdate(this.displayedText);
      }
      if (this.displayedText.length < this.targetText.length) {
        this.scheduleNextStep();
      }
    }, delay);
  }
}

/**
 * React hook for progressive, adaptive text streaming:
 * - Backlog < 15 chars: animate character-by-character (~25ms)
 * - Backlog 15-80 chars: chunk word-by-word (~15ms)
 * - Backlog > 80 chars or fast bursts: render line-by-line / instant flush (~8ms / 0ms)
 * - When streaming stops: instantly flushes to complete text.
 */
export function useAdaptiveStream(
  targetText: string,
  isStreaming: boolean,
  options?: AdaptiveStreamOptions,
): string {
  const [displayedText, setDisplayedText] = useState<string>(() => (isStreaming ? "" : targetText));

  const targetRef = useRef(targetText);
  const isStreamingRef = useRef(isStreaming);
  const displayedRef = useRef(displayedText);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChunkTimeRef = useRef<number>(0);
  const lastChunkSizeRef = useRef<number>(0);

  targetRef.current = targetText;
  isStreamingRef.current = isStreaming;
  displayedRef.current = displayedText;

  const resolvedOptions: Required<AdaptiveStreamOptions> = {
    charInterval: options?.charInterval ?? DEFAULT_OPTIONS.charInterval,
    wordInterval: options?.wordInterval ?? DEFAULT_OPTIONS.wordInterval,
    lineInterval: options?.lineInterval ?? DEFAULT_OPTIONS.lineInterval,
    charThreshold: options?.charThreshold ?? DEFAULT_OPTIONS.charThreshold,
    wordThreshold: options?.wordThreshold ?? DEFAULT_OPTIONS.wordThreshold,
    instantFlushThreshold: options?.instantFlushThreshold ?? DEFAULT_OPTIONS.instantFlushThreshold,
  };

  useEffect(() => {
    // If not streaming, flush immediately to targetText
    if (!isStreaming) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (displayedRef.current !== targetText) {
        setDisplayedText(targetText);
      }
      return;
    }

    // Target text reset or replaced completely
    if (!targetText.startsWith(displayedRef.current)) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDisplayedText("");
      displayedRef.current = "";
    }

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const prevLen = displayedRef.current.length;
    if (targetText.length > prevLen) {
      lastChunkSizeRef.current = targetText.length - prevLen;
      lastChunkTimeRef.current = now;
    }

    const schedule = () => {
      if (timerRef.current !== null) return;

      const currentDisplayed = displayedRef.current;
      const currentTarget = targetRef.current;
      const backlog = currentTarget.length - currentDisplayed.length;

      if (backlog <= 0) return;

      const unrendered = currentTarget.slice(currentDisplayed.length);
      const currentTime = typeof performance !== "undefined" ? performance.now() : Date.now();
      const isBurst =
        lastChunkSizeRef.current > resolvedOptions.wordThreshold ||
        (currentTime - lastChunkTimeRef.current < 40 && lastChunkSizeRef.current > 35);

      let chunk = "";
      let delay = resolvedOptions.charInterval;

      if (backlog >= resolvedOptions.instantFlushThreshold) {
        chunk = unrendered;
        delay = 0;
      } else if (backlog > resolvedOptions.wordThreshold || isBurst) {
        chunk = getNextLineChunk(unrendered);
        delay = resolvedOptions.lineInterval;
      } else if (backlog >= resolvedOptions.charThreshold) {
        chunk = getNextWordChunk(unrendered);
        delay = resolvedOptions.wordInterval;
      } else {
        chunk = getNextCharChunk(unrendered);
        delay = resolvedOptions.charInterval;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const nextDisplayed = currentDisplayed + chunk;
        setDisplayedText(nextDisplayed);
        displayedRef.current = nextDisplayed;

        if (nextDisplayed.length < targetRef.current.length && isStreamingRef.current) {
          schedule();
        }
      }, delay);
    };

    schedule();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [targetText, isStreaming, resolvedOptions]);

  return displayedText;
}
