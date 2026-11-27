-- Token counts of every LLM call, by feature and model, to see where AI cost goes.
-- No prompt text and no user id: it measures cost, not people. Only the service role writes or
-- reads it (RLS on, no policies).
create table public.ai_token_usage (
  id bigint generated always as identity primary key,
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index ai_token_usage_created_at_idx on public.ai_token_usage (created_at);

alter table public.ai_token_usage enable row level security;
