/*
  Supabase Schema Definition for Déjà Recovery Engine
  Features: Row Level Security, Automated Timestamps
*/

-- Create journal_slates table for raw memory ingestion
CREATE TABLE IF NOT EXISTS public.journal_slates (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    profile_id TEXT NOT NULL DEFAULT 'default_user',
    content TEXT NOT NULL,
    summary_snippet TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create user_metadata table for offline states (manifest / caching)
CREATE TABLE IF NOT EXISTS public.user_metadata (
    profile TEXT PRIMARY KEY DEFAULT 'default_user',
    manifest JSONB DEFAULT '{}'::jsonb,
    blindspots_cache JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to automatically update the 'updated_at' column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_metadata
DROP TRIGGER IF EXISTS update_user_metadata_modtime ON public.user_metadata;
CREATE TRIGGER update_user_metadata_modtime
    BEFORE UPDATE ON public.user_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.journal_slates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_metadata ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies for journal_slates ── --
-- Allow reading/writing if the row matches the authenticated user ID OR if the row is 'default_user' (for local testing/anonymous fallback)
CREATE POLICY "Users can select own rows" ON public.journal_slates 
  FOR SELECT USING (profile_id = auth.uid()::text OR profile_id = 'default_user');

CREATE POLICY "Users can insert own rows" ON public.journal_slates 
  FOR INSERT WITH CHECK (profile_id = auth.uid()::text OR profile_id = 'default_user');

CREATE POLICY "Users can update own rows" ON public.journal_slates 
  FOR UPDATE USING (profile_id = auth.uid()::text OR profile_id = 'default_user');

CREATE POLICY "Users can delete own rows" ON public.journal_slates 
  FOR DELETE USING (profile_id = auth.uid()::text OR profile_id = 'default_user');

-- ── RLS Policies for user_metadata ── --
CREATE POLICY "Users can select own metadata" ON public.user_metadata 
  FOR SELECT USING (profile = auth.uid()::text OR profile = 'default_user');

CREATE POLICY "Users can insert own metadata" ON public.user_metadata 
  FOR INSERT WITH CHECK (profile = auth.uid()::text OR profile = 'default_user');

CREATE POLICY "Users can update own metadata" ON public.user_metadata 
  FOR UPDATE USING (profile = auth.uid()::text OR profile = 'default_user');

-- ── Bookmarks Table ── --
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    date_key TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date_key)
);

-- Enable RLS
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Allow users to manage only their own bookmarks
CREATE POLICY "Users can manage own bookmarks" ON public.bookmarks
  FOR ALL USING (auth.uid() = user_id);
