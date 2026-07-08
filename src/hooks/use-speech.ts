import { useCallback, useEffect, useRef, useState } from "react";

const POSITION_KEY = "ajrasakha:tts:positions";

function loadPositions(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(POSITION_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function savePositions(positions: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POSITION_KEY, JSON.stringify(positions));
  } catch {
    // ignore
  }
}

export function detectLanguage(text: string): "hi-IN" | "en-IN" {
  // Devanagari unicode block covers Hindi/Marathi/etc.
  return /[\u0900-\u097F]/.test(text) ? "hi-IN" : "en-IN";
}

export function splitSentences(text: string): string[] {
  // Strip common markdown noise for cleaner speech.
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_>#]+/g, "")
    .replace(/\r/g, "");
  const parts = cleaned
    .split(/(?<=[.!?।॥])\s+|\n{2,}/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [cleaned.trim()].filter(Boolean);
}

type Status = "idle" | "playing" | "paused";

type Controller = {
  status: Status;
  activeId: string | null;
  sentenceIndex: number;
  play: (id: string, text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};

let listeners = new Set<() => void>();
let state: {
  status: Status;
  activeId: string | null;
  sentenceIndex: number;
  sentences: string[];
  lang: string;
} = {
  status: "idle",
  activeId: null,
  sentenceIndex: 0,
  sentences: [],
  lang: "en-IN",
};

function emit() {
  for (const l of listeners) l();
}

function isSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (!isSupported()) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ||
    voices[0]
  );
}

function speakFrom(index: number) {
  if (!isSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const { sentences, activeId, lang } = state;
  if (!activeId || index >= sentences.length) {
    state = { ...state, status: "idle", sentenceIndex: 0 };
    if (activeId) {
      const positions = loadPositions();
      delete positions[activeId];
      savePositions(positions);
    }
    emit();
    return;
  }

  state = { ...state, status: "playing", sentenceIndex: index };
  emit();

  const speakNext = (i: number) => {
    if (i >= sentences.length) {
      state = { ...state, status: "idle", sentenceIndex: 0, activeId: null };
      if (activeId) {
        const positions = loadPositions();
        delete positions[activeId];
        savePositions(positions);
      }
      emit();
      return;
    }
    const utter = new SpeechSynthesisUtterance(sentences[i]);
    utter.lang = lang;
    const voice = pickVoice(lang);
    if (voice) utter.voice = voice;
    utter.rate = 1;
    utter.pitch = 1;
    utter.onstart = () => {
      state = { ...state, status: "playing", sentenceIndex: i };
      emit();
      if (state.activeId) {
        const positions = loadPositions();
        positions[state.activeId] = i;
        savePositions(positions);
      }
    };
    utter.onend = () => {
      // If paused/stopped, do not advance
      if (state.status !== "playing") return;
      speakNext(i + 1);
    };
    utter.onerror = () => {
      state = { ...state, status: "idle" };
      emit();
    };
    synth.speak(utter);
  };

  speakNext(index);
}

const controller: Controller = {
  get status() {
    return state.status;
  },
  get activeId() {
    return state.activeId;
  },
  get sentenceIndex() {
    return state.sentenceIndex;
  },
  play(id, text) {
    if (!isSupported()) return;
    const sentences = splitSentences(text);
    if (sentences.length === 0) return;
    const lang = detectLanguage(text);
    const positions = loadPositions();
    const start =
      state.activeId === id && state.status === "paused"
        ? state.sentenceIndex
        : positions[id] ?? 0;
    state = {
      status: "playing",
      activeId: id,
      sentenceIndex: Math.min(start, sentences.length - 1),
      sentences,
      lang,
    };
    speakFrom(state.sentenceIndex);
  },
  pause() {
    if (!isSupported()) return;
    // Some browsers (Chromium) don't reliably resume paused utterances.
    // We cancel and remember position so resume() re-speaks the current sentence.
    window.speechSynthesis.cancel();
    state = { ...state, status: "paused" };
    emit();
  },
  resume() {
    if (!isSupported() || !state.activeId) return;
    speakFrom(state.sentenceIndex);
  },
  stop() {
    if (!isSupported()) return;
    window.speechSynthesis.cancel();
    if (state.activeId) {
      const positions = loadPositions();
      delete positions[state.activeId];
      savePositions(positions);
    }
    state = {
      status: "idle",
      activeId: null,
      sentenceIndex: 0,
      sentences: [],
      lang: state.lang,
    };
    emit();
  },
};

export function useSpeech() {
  const [, force] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const l = () => {
      ref.current += 1;
      force(ref.current);
    };
    listeners.add(l);
    // Prime voices (browsers load asynchronously).
    if (isSupported()) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        // no-op; voices are queried at speak time.
      };
    }
    return () => {
      listeners.delete(l);
    };
  }, []);

  return {
    supported: isSupported(),
    status: state.status,
    activeId: state.activeId,
    sentenceIndex: state.sentenceIndex,
    play: useCallback(controller.play, []),
    pause: useCallback(controller.pause, []),
    resume: useCallback(controller.resume, []),
    stop: useCallback(controller.stop, []),
  };
}

// Stop speech when the tab is closed to avoid orphaned voices.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (isSupported()) window.speechSynthesis.cancel();
  });
}