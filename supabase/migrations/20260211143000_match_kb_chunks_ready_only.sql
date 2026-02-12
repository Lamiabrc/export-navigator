-- Restrict RAG retrieval to admin-validated KB documents only
create or replace function public.match_kb_chunks(
  query_embedding vector(1536),
  match_count int default 6,
  min_similarity float default 0.15
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    kc.id,
    kc.document_id,
    kc.chunk_index,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.kb_chunks kc
  join public.kb_documents kd on kd.id = kc.document_id
  where kd.enabled = true
    and kd.status = 'ready'
    and 1 - (kc.embedding <=> query_embedding) >= min_similarity
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;
