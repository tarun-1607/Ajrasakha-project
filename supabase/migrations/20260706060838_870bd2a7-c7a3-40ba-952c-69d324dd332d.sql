CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  message_id text NOT NULL,
  question text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  rating text NOT NULL CHECK (rating IN ('helpful','not_helpful')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own feedback" ON public.feedback FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.answer_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id text NOT NULL,
  message_id text NOT NULL,
  question text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  reason text NOT NULL CHECK (reason IN ('incorrect','incomplete','unsafe','other')),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_review',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answer_reports TO authenticated;
GRANT ALL ON public.answer_reports TO service_role;
ALTER TABLE public.answer_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own reports" ON public.answer_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own reports" ON public.answer_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_answer_reports_updated_at BEFORE UPDATE ON public.answer_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();