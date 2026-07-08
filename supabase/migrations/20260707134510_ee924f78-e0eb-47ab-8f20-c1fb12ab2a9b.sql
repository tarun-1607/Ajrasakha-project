
create table if not exists public.diagnosis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  crop text,
  disease text,
  confidence numeric,
  severity text check (severity in ('low','medium','high','unknown')),
  description text,
  treatment text,
  organic_treatment text,
  prevention text,
  weather_snapshot jsonb,
  region jsonb,
  provider text not null default 'gemini-vision',
  model text,
  reviewer_status text not null default 'not_needed'
    check (reviewer_status in ('not_needed','pending_review','approved','rejected')),
  reviewer_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diagnosis_history_user_id_idx on public.diagnosis_history(user_id, created_at desc);
create index if not exists diagnosis_history_reviewer_idx on public.diagnosis_history(reviewer_status, created_at desc);

grant select, insert, update, delete on public.diagnosis_history to authenticated;
grant all on public.diagnosis_history to service_role;

alter table public.diagnosis_history enable row level security;

create policy "Farmers view own diagnoses"
  on public.diagnosis_history for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'reviewer'));

create policy "Farmers insert own diagnoses"
  on public.diagnosis_history for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Farmers delete own diagnoses"
  on public.diagnosis_history for delete to authenticated
  using (auth.uid() = user_id);

create policy "Admins and reviewers update diagnoses"
  on public.diagnosis_history for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'reviewer'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'reviewer'));

create trigger diagnosis_history_updated_at
  before update on public.diagnosis_history
  for each row execute function public.update_updated_at_column();

create policy "Users upload own diagnosis images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'diagnosis-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read own diagnosis images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'diagnosis-images'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'reviewer')
    )
  );

create policy "Users delete own diagnosis images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'diagnosis-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
