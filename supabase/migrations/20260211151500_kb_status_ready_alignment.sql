-- Align KB ingestion status with retrieval filter used by RAG
-- Existing ingested rows used status='indexed' while retrieval requires status='ready'.

update public.kb_documents
set status = 'ready'
where status = 'indexed';
