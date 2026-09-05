-- Migration: Create activity_logs and quotation_versions tables

-- 1. Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_name TEXT NOT NULL DEFAULT 'Admin',
    client_name TEXT DEFAULT '',
    action TEXT NOT NULL,
    district_state TEXT DEFAULT '',
    event_start_date TEXT DEFAULT '',
    event_code TEXT DEFAULT '',
    details TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_code ON public.activity_logs(event_code);

-- Enable RLS & Policies
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'Allow public read activity_logs'
    ) THEN
        CREATE POLICY "Allow public read activity_logs" ON public.activity_logs FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'Allow authenticated and anon insert activity_logs'
    ) THEN
        CREATE POLICY "Allow authenticated and anon insert activity_logs" ON public.activity_logs FOR INSERT WITH CHECK (true);
    END IF;
END $$;


-- 2. Quotation Versions Table
CREATE TABLE IF NOT EXISTS public.quotation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    actor_name TEXT NOT NULL DEFAULT 'Admin',
    reason TEXT NOT NULL DEFAULT '',
    changes_summary TEXT DEFAULT '',
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotation_versions_event_id ON public.quotation_versions(event_id, version_number DESC);

-- Enable RLS & Policies
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'quotation_versions' AND policyname = 'Allow public read quotation_versions'
    ) THEN
        CREATE POLICY "Allow public read quotation_versions" ON public.quotation_versions FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'quotation_versions' AND policyname = 'Allow authenticated and anon insert quotation_versions'
    ) THEN
        CREATE POLICY "Allow authenticated and anon insert quotation_versions" ON public.quotation_versions FOR INSERT WITH CHECK (true);
    END IF;
END $$;
