
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

CREATE TABLE public.golden_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source TEXT,
  crop TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.golden_answers TO authenticated, anon;
GRANT ALL ON public.golden_answers TO service_role;
ALTER TABLE public.golden_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Golden answers readable by all" ON public.golden_answers FOR SELECT USING (true);

CREATE TABLE public.pop_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source TEXT,
  crop TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pop_answers TO authenticated, anon;
GRANT ALL ON public.pop_answers TO service_role;
ALTER TABLE public.pop_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PoP answers readable by all" ON public.pop_answers FOR SELECT USING (true);

CREATE INDEX golden_answers_embedding_idx ON public.golden_answers USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX pop_answers_embedding_idx ON public.pop_answers USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TRIGGER update_golden_answers_updated_at BEFORE UPDATE ON public.golden_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pop_answers_updated_at BEFORE UPDATE ON public.pop_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
