import { Button } from "@/components/ui/button";
import { getRelatedQuestions } from "@/lib/related-questions.functions";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function RelatedQuestions({
  question,
  answer,
  onPick,
}: {
  question: string;
  answer: string;
  onPick: (text: string) => void;
}) {
  const fetchFn = useServerFn(getRelatedQuestions);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (!question || !answer) return;
    ranRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchFn({ data: { question, answer } });
        if (!cancelled) setQuestions(res.questions);
      } catch {
        if (!cancelled) setQuestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [question, answer, fetchFn]);

  if (loading) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-8 w-40 animate-pulse rounded-full bg-muted"
          />
        ))}
      </div>
    );
  }

  if (!questions || questions.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="size-3.5" />
        Related questions
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <Button
            key={i}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPick(q)}
            className="h-auto rounded-full border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-normal text-foreground hover:bg-primary/10 hover:text-foreground"
          >
            {q}
          </Button>
        ))}
      </div>
    </div>
  );
}