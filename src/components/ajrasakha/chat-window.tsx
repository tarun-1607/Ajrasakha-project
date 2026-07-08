import { AjrasakhaLogo } from "@/components/ajrasakha/logo";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { splitSentences, useSpeech } from "@/hooks/use-speech";
import { MessageFeedback } from "@/components/ajrasakha/message-feedback";
import { RelatedQuestions } from "@/components/ajrasakha/related-questions";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import {
  Bug,
  Camera,
  CloudSun,
  Landmark,
  Leaf,
  Mic,
  MicOff,
  Paperclip,
  Pause,
  Play,
  Square,
  Volume2,
  Sprout,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const STARTER_PROMPTS: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  text: string;
}[] = [
  {
    icon: Sprout,
    label: "Sowing",
    text: "What is the best time to sow paddy in Karnataka this season?",
  },
  {
    icon: Bug,
    label: "Pest control",
    text: "How do I control fall armyworm in my maize crop safely?",
  },
  {
    icon: CloudSun,
    label: "Irrigation",
    text: "My tomato leaves are curling in the heat — how often should I irrigate?",
  },
  {
    icon: Landmark,
    label: "Schemes",
    text: "Which government schemes give subsidy for drip irrigation?",
  },
];

function getMessageText(m: UIMessage): string {
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
}

type ImagePart = { url: string; mediaType: string; filename?: string };

function getMessageImages(m: UIMessage): ImagePart[] {
  const out: ImagePart[] = [];
  for (const p of m.parts) {
    if (p.type !== "file") continue;
    const fp = p as { url?: string; mediaType?: string; filename?: string };
    if (!fp.url || !fp.mediaType?.startsWith("image/")) continue;
    out.push({ url: fp.url, mediaType: fp.mediaType, filename: fp.filename });
  }
  return out;
}

function AttachmentPreviews() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3">
      {attachments.files.map((f) => (
        <div
          key={f.id}
          className="group relative size-20 overflow-hidden rounded-lg border border-border bg-muted"
        >
          {f.mediaType?.startsWith("image/") && f.url ? (
            <img
              src={f.url}
              alt={f.filename ?? "attachment"}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">
              {f.filename ?? "file"}
            </div>
          )}
          <button
            type="button"
            onClick={() => attachments.remove(f.id)}
            aria-label="Remove attachment"
            className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm ring-1 ring-border transition-opacity hover:bg-background"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function AttachButton({
  capture,
  icon: Icon,
  label,
}: {
  capture?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const attachments = usePromptInputAttachments();
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={!capture}
        {...(capture ? { capture: "environment" as const } : {})}
        className="hidden"
        onChange={(e) => {
          if (e.currentTarget.files?.length) {
            attachments.add(e.currentTarget.files);
          }
          e.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 rounded-full"
        onClick={() => inputRef.current?.click()}
        aria-label={label}
      >
        <Icon className="size-4" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
    </>
  );
}

function AssistantBody({ id, text }: { id: string; text: string }) {
  const { activeId, sentenceIndex, status } = useSpeech();
  const isActive = activeId === id && status !== "idle";
  if (!isActive) return <MessageResponse>{text}</MessageResponse>;
  const sentences = splitSentences(text);
  return (
    <div className="text-sm leading-relaxed">
      {sentences.map((s, i) => (
        <span
          key={i}
          className={cn(
            "transition-colors",
            i === sentenceIndex
              ? "rounded bg-harvest/30 px-1 py-0.5 text-foreground"
              : "text-foreground/80",
          )}
        >
          {s}{" "}
        </span>
      ))}
    </div>
  );
}

function SpeakerControls({ id, text }: { id: string; text: string }) {
  const { supported, activeId, status, play, pause, resume, stop } = useSpeech();
  if (!supported) return null;
  const isActive = activeId === id;
  const isPlaying = isActive && status === "playing";
  const isPaused = isActive && status === "paused";

  return (
    <div className="mt-1 flex items-center gap-1">
      {!isPlaying && !isPaused && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => play(id, text)}
          className="h-7 gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Read aloud"
        >
          <Volume2 className="size-3.5" />
          Listen
        </Button>
      )}
      {isPlaying && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={pause}
          className="h-7 gap-1.5 rounded-full px-2 text-xs"
          aria-label="Pause"
        >
          <Pause className="size-3.5" />
          Pause
        </Button>
      )}
      {isPaused && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resume}
          className="h-7 gap-1.5 rounded-full px-2 text-xs"
          aria-label="Resume"
        >
          <Play className="size-3.5" />
          Resume
        </Button>
      )}
      {(isPlaying || isPaused) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={stop}
          className="h-7 gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Stop"
        >
          <Square className="size-3.5" />
          Stop
        </Button>
      )}
    </div>
  );
}

type RegionChips = {
  state?: string;
  district?: string;
  block?: string;
  crop?: string;
  season?: string;
  regional?: boolean;
  weather?: {
    temperatureC: number;
    feelsLikeC: number;
    humidity: number;
    rainProbability: number;
    windSpeedKmh: number;
    condition: string;
    uvIndex: number;
    cacheAgeMinutes: number;
    stale: boolean;
    source: "open-meteo";
  };
};

type AnswerMeta =
  | ({
      source: "golden";
      confidence: number;
      sourceName: string;
      updatedAt: string;
    } & RegionChips)
  | ({
      source: "pop";
      confidence: number;
      sourceName: string;
      updatedAt: string;
    } & RegionChips)
  | ({ source: "ai" } & RegionChips);

function AnswerSourceCard({ meta }: { meta: AnswerMeta | undefined }) {
  const tier = meta?.source ?? "ai";
  const badgeStyles = {
    golden:
      "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300",
    pop: "bg-sky-500/15 text-sky-700 border-sky-500/40 dark:text-sky-300",
    ai: "bg-amber-500/15 text-amber-800 border-amber-500/40 dark:text-amber-300",
  }[tier];
  const label = {
    golden: "Verified Expert Answer",
    pop: "Package of Practices",
    ai: "AI Generated",
  }[tier];
  const chip =
    "inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] text-foreground/80";
  const state = meta && "state" in meta ? meta.state : undefined;
  const district = meta && "district" in meta ? meta.district : undefined;
  const crop = meta && "crop" in meta ? meta.crop : undefined;
  const season = meta && "season" in meta ? meta.season : undefined;
  const regional = meta && "regional" in meta ? meta.regional : undefined;
  const weather = meta && "weather" in meta ? meta.weather : undefined;
  const regionLabel = [district, state].filter(Boolean).join(", ");
  return (
    <div className="mb-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {regionLabel && (
          <span className={chip}>📍 {regionLabel}</span>
        )}
        {crop && <span className={chip}>🌾 {crop}</span>}
        {season && <span className={chip}>☀️ {season}</span>}
        {weather && (
          <>
            <span className={chip}>🌡 {weather.temperatureC.toFixed(0)}°C</span>
            <span className={chip}>💧 {weather.humidity}%</span>
            <span className={chip}>🌧 {weather.rainProbability}%</span>
            <span className={chip}>💨 {weather.windSpeedKmh.toFixed(0)} km/h</span>
            <span className={chip}>☀️ {weather.condition}</span>
          </>
        )}
        {regional && tier !== "ai" && (
          <span className={cn(chip, "border-emerald-500/40 text-emerald-700 dark:text-emerald-300")}>
            Region match
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
            badgeStyles,
          )}
        >
          <Leaf className="size-3" />
          {label}
        </span>
        {tier === "golden" && meta && "confidence" in meta && (
          <span className="text-[11px] text-muted-foreground">
            {Math.round(meta.confidence * 100)}% match · {meta.sourceName} ·
            updated {new Date(meta.updatedAt).toLocaleDateString()}
          </span>
        )}
        {tier === "pop" && meta && "confidence" in meta && (
          <span className="text-[11px] text-muted-foreground">{meta.sourceName}</span>
        )}
        {tier === "ai" && (
          <span className="text-[11px] text-muted-foreground">
            Not yet reviewed by an expert
          </span>
        )}
        {weather && (
          <span className="text-[11px] text-muted-foreground">
            · Weather: Open-Meteo{" "}
            {weather.stale ? "(cached)" : ""}
            {" · updated "}
            {weather.cacheAgeMinutes < 1
              ? "just now"
              : `${weather.cacheAgeMinutes}m ago`}
          </span>
        )}
      </div>
    </div>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function ChatWindow({
  threadId,
  initialMessages,
  onMessagesChange,
  onFirstUserMessage,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  onMessagesChange: (messages: UIMessage[]) => void;
  onFirstUserMessage?: (text: string) => void;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const headers: Record<string, string> = { "x-thread-id": threadId };
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) headers.Authorization = `Bearer ${token}`;
          return headers;
        },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (err) => {
      console.error("Chat error", err);
      toast.error("Ajrasakha couldn't respond. Please try again.", {
        description: err.message,
      });
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Persist messages
  const savedRef = useRef<string>("");
  useEffect(() => {
    const serialized = JSON.stringify(messages);
    if (serialized !== savedRef.current) {
      savedRef.current = serialized;
      onMessagesChange(messages);
    }
  }, [messages, onMessagesChange]);

  // Focus textarea on thread switch and after send
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  // Voice input
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceSupported = useMemo(() => !!getSpeechRecognitionCtor(), []);

  const [inputValue, setInputValue] = useState("");

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = "en-IN";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e: unknown) => {
        const ev = e as {
          results: ArrayLike<ArrayLike<{ transcript: string }>>;
        };
        let text = "";
        for (let i = 0; i < ev.results.length; i++) {
          text += ev.results[i][0]?.transcript ?? "";
        }
        setInputValue(text);
      };
      rec.onerror = () => {
        setIsListening(false);
        toast.error("Couldn't hear you. Please try again.");
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = message.text?.trim();
      const files = (message.files ?? []).filter(
        (f) => f.url && f.mediaType?.startsWith("image/"),
      );
      if ((!text && files.length === 0) || isLoading) return;
      if (messages.length === 0 && text) onFirstUserMessage?.(text);
      const parts: Array<
        | { type: "text"; text: string }
        | { type: "file"; url: string; mediaType: string; filename?: string }
      > = [];
      for (const f of files) {
        parts.push({
          type: "file",
          url: f.url,
          mediaType: f.mediaType ?? "image/jpeg",
          filename: f.filename,
        });
      }
      if (text) parts.push({ type: "text", text });
      sendMessage({ role: "user", parts });
      setInputValue("");
      stopListening();
    },
    [isLoading, messages.length, onFirstUserMessage, sendMessage, stopListening],
  );

  const sendStarter = useCallback(
    (text: string) => {
      if (isLoading) return;
      if (messages.length === 0) onFirstUserMessage?.(text);
      sendMessage({ text });
    },
    [isLoading, messages.length, onFirstUserMessage, sendMessage],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-background">
      {hasMessages ? (
        <Conversation className="flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 md:py-10">
            {messages.map((m) => {
              const text = getMessageText(m);
              const idx = messages.indexOf(m);
              const prevUser = m.role === "assistant"
                ? [...messages.slice(0, idx)].reverse().find((x) => x.role === "user")
                : undefined;
              const question = prevUser ? getMessageText(prevUser) : "";
              const isLast = idx === messages.length - 1;
              const showFeedback =
                m.role === "assistant" && !!text && (!isLast || !isLoading);
              return (
                <Message from={m.role} key={m.id}>
                  {m.role === "assistant" && (
                    <>
                      <div className="mb-1 flex items-center gap-2">
                        <AjrasakhaLogo size={22} className="rounded-md" />
                        <span className="font-display text-sm font-semibold text-foreground">
                          Ajrasakha
                        </span>
                      </div>
                      {text && (
                        <AnswerSourceCard
                          meta={
                            (m as unknown as { metadata?: AnswerMeta }).metadata
                          }
                        />
                      )}
                    </>
                  )}
                  <MessageContent
                    className={cn(
                      m.role === "user" &&
                        "!bg-chat-user !text-chat-user-foreground shadow-sm",
                    )}
                  >
                    {getMessageImages(m).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {getMessageImages(m).map((img, i) => (
                          <a
                            key={i}
                            href={img.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-lg border border-border/60 bg-background/40"
                          >
                            <img
                              src={img.url}
                              alt={img.filename ?? "uploaded crop image"}
                              className="max-h-64 max-w-xs object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    {m.role === "assistant" ? (
                      text && <AssistantBody id={m.id} text={text} />
                    ) : (
                      text && (
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {text}
                        </p>
                      )
                    )}
                  </MessageContent>
                  {m.role === "assistant" && text && (
                    <SpeakerControls id={m.id} text={text} />
                  )}
                  {showFeedback && (
                    <MessageFeedback
                      threadId={threadId}
                      messageId={m.id}
                      question={question}
                      answer={text}
                    />
                  )}
                  {showFeedback && question && (
                    <RelatedQuestions
                      question={question}
                      answer={text}
                      onPick={sendStarter}
                    />
                  )}
                </Message>
              );
            })}
            {status === "submitted" && (
              <Message from="assistant">
                <div className="mb-1 flex items-center gap-2">
                  <AjrasakhaLogo size={22} className="rounded-md" />
                  <span className="font-display text-sm font-semibold text-foreground">
                    Ajrasakha
                  </span>
                </div>
                <MessageContent>
                  <Shimmer className="text-sm">Thinking through your question…</Shimmer>
                </MessageContent>
              </Message>
            )}
            {error && (
              <div className="mx-auto rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error.message}
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10">
          <div className="mx-auto w-full max-w-2xl text-center">
            <div className="mx-auto mb-6 inline-flex rounded-2xl bg-primary/10 p-4">
              <AjrasakhaLogo size={64} className="rounded-xl" />
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Namaste 🙏 How can I help on your farm today?
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground md:text-base">
              Ask about crops, pests, irrigation, fertilisers, weather or
              government schemes — in your own words or with your voice.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => sendStarter(p.text)}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <p.icon className="size-4" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {p.label}
                    </span>
                    <span className="text-sm text-foreground">{p.text}</span>
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-8 text-xs text-muted-foreground">
              Verified answers come first from the Golden Dataset & Package of
              Practices. AI answers are reviewed by experts continuously.
            </p>
          </div>
        </div>
      )}

      <div className="border-t border-border bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <PromptInput
            onSubmit={handleSubmit}
            accept="image/*"
            multiple
            maxFiles={5}
            maxFileSize={10 * 1024 * 1024}
            onError={(e) => toast.error(e.message)}
            className="rounded-2xl border-border bg-card shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20"
          >
            <AttachmentPreviews />
            <PromptInputTextarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                isListening
                  ? "Listening… speak your question"
                  : "Ask a farming question, drop an image, or use your voice"
              }
              className="min-h-[60px] text-base"
            />
            <PromptInputFooter className="items-center justify-between">
              <div className="flex flex-wrap items-center gap-1">
                <AttachButton icon={Paperclip} label="Attach" />
                <AttachButton icon={Camera} label="Camera" capture />
                {voiceSupported && (
                  <Button
                    type="button"
                    variant={isListening ? "default" : "ghost"}
                    size="sm"
                    onClick={() =>
                      isListening ? stopListening() : startListening()
                    }
                    className={cn(
                      "gap-1.5 rounded-full",
                      isListening &&
                        "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                    )}
                    aria-label={
                      isListening ? "Stop voice input" : "Start voice input"
                    }
                  >
                    {isListening ? (
                      <>
                        <MicOff className="size-4" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Mic className="size-4" />
                        Voice
                      </>
                    )}
                  </Button>
                )}
                <span className="hidden text-xs text-muted-foreground lg:inline">
                  Ajrasakha may make mistakes — check important advice locally.
                </span>
              </div>
              <PromptInputSubmit
                status={status}
                disabled={!isLoading && !inputValue.trim()}
                onStop={stop}
                className="rounded-full"
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}