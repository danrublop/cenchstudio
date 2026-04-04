-- Add run tracing columns to generation_logs for full agent execution audit trails
ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS run_id text;
ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS run_trace jsonb;
CREATE INDEX IF NOT EXISTS gen_log_run_id_idx ON generation_logs (run_id);
