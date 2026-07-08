-- Reviewer workflow schema

-- 1. Add 'reviewer' to the app_role enum (safe: not used in same tx thanks to text-cast policies below)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reviewer';

-- 2. Security-definer helper that treats admins and reviewers uniformly.
--    We compare role::text = 'reviewer' so this migration doesn't reference
--    the freshly-added enum value directly (Postgres forbids using a new
--    enum value in the same transaction).
CREATE OR REPLACE FUNCTION public.is_reviewer_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role::text = 'admin' OR role::text = 'reviewer')
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_reviewer_or_admin(uuid) TO authenticated, service_role;

-- 3. Resize embedding columns for google/gemini-embedding-001 (3072-dim).
--    Existing rows have no embeddings; dropping is safe.
DROP INDEX IF EXISTS public.golden_answers_embedding_idx;
DROP INDEX IF EXISTS public.pop_answers_embedding_idx;
ALTER TABLE public.golden_answers DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.golden_answers ADD COLUMN embedding extensions.vector(3072);
ALTER TABLE public.pop_answers DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.pop_answers ADD COLUMN embedding extensions.vector(3072);
-- Note: pgvector's ivfflat/hnsw indexes cap at 2000 dims. With ~thousands of
-- rows, sequential cosine scan is acceptable. Swap to halfvec if the dataset grows.

-- 4. "Verified Expert Answer" flag on golden entries
ALTER TABLE public.golden_answers ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- 5. pending_reviews table: every AI-generated answer lands here
CREATE TABLE public.pending_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text,
  thread_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  question text NOT NULL,
  answer text NOT NULL,
  language text,
  crop text,
  status text NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reviewer_notes text,
  edited_answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pending_reviews_status_check CHECK (status IN ('pending','approved','rejected'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_reviews TO authenticated;
GRANT ALL ON public.pending_reviews TO service_role;

ALTER TABLE public.pending_reviews ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can enqueue their own AI answer for review
CREATE POLICY "Users enqueue own AI answers" ON public.pending_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Reviewers and admins can read the queue
CREATE POLICY "Reviewers read queue" ON public.pending_reviews
  FOR SELECT TO authenticated
  USING (public.is_reviewer_or_admin(auth.uid()));

-- Reviewers and admins update review outcome
CREATE POLICY "Reviewers act on queue" ON public.pending_reviews
  FOR UPDATE TO authenticated
  USING (public.is_reviewer_or_admin(auth.uid()))
  WITH CHECK (public.is_reviewer_or_admin(auth.uid()));

-- Admins can prune the queue
CREATE POLICY "Admins delete reviews" ON public.pending_reviews
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_pending_reviews_updated_at BEFORE UPDATE ON public.pending_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX pending_reviews_status_created_idx ON public.pending_reviews(status, created_at DESC);
CREATE INDEX pending_reviews_message_idx ON public.pending_reviews(message_id);