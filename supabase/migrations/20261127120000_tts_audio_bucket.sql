-- Public bucket for synthesized pronunciation audio (Kokoro TTS). Contents are generic word/sentence
-- audio, not user data. Only the server (secret key) writes; no client write policies exist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts', 'tts', true, 1048576, array['audio/mpeg'])
on conflict (id) do nothing;
