-- Migration: Nobar (Watch Party) Room & Realtime Chat
-- Created for Nuenime App Nobar Feature

CREATE TABLE IF NOT EXISTS public.nobar_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT NOT NULL DEFAULT ('#' || floor(10000 + random() * 90000)::text),
    title TEXT NOT NULL,
    anime_id INTEGER NOT NULL,
    anime_title TEXT NOT NULL,
    anime_poster TEXT,
    episode INTEGER NOT NULL DEFAULT 1,
    host_id TEXT NOT NULL,
    host_name TEXT NOT NULL,
    host_avatar TEXT,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    password TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'closed'
    playback_time DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_playing BOOLEAN NOT NULL DEFAULT FALSE,
    max_members INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure room_code exists if table was already created
ALTER TABLE public.nobar_rooms ADD COLUMN IF NOT EXISTS room_code TEXT DEFAULT ('#' || floor(10000 + random() * 90000)::text);

CREATE TABLE IF NOT EXISTS public.nobar_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.nobar_rooms(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_avatar TEXT,
    sender_role TEXT DEFAULT 'Member',
    message TEXT NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for fast query lookups
CREATE INDEX IF NOT EXISTS idx_nobar_rooms_status ON public.nobar_rooms(status);
CREATE INDEX IF NOT EXISTS idx_nobar_rooms_room_code ON public.nobar_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_nobar_rooms_created_at ON public.nobar_rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nobar_messages_room_id ON public.nobar_messages(room_id, created_at ASC);

-- Enable RLS
ALTER TABLE public.nobar_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nobar_messages ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (for idempotent migration)
DROP POLICY IF EXISTS "Public can view active nobar rooms" ON public.nobar_rooms;
DROP POLICY IF EXISTS "Anyone authenticated or guest can create rooms" ON public.nobar_rooms;
DROP POLICY IF EXISTS "Host or members can update room state" ON public.nobar_rooms;
DROP POLICY IF EXISTS "Host can delete room" ON public.nobar_rooms;
DROP POLICY IF EXISTS "Anyone can view messages in room" ON public.nobar_messages;
DROP POLICY IF EXISTS "Anyone can send messages in room" ON public.nobar_messages;

-- Policies for nobar_rooms
CREATE POLICY "Public can view active nobar rooms"
    ON public.nobar_rooms FOR SELECT
    USING (status = 'active');

CREATE POLICY "Anyone authenticated or guest can create rooms"
    ON public.nobar_rooms FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Host or members can update room state"
    ON public.nobar_rooms FOR UPDATE
    USING (true);

CREATE POLICY "Host can delete room"
    ON public.nobar_rooms FOR DELETE
    USING (true);

-- Policies for nobar_messages
CREATE POLICY "Anyone can view messages in room"
    ON public.nobar_messages FOR SELECT
    USING (true);

CREATE POLICY "Anyone can send messages in room"
    ON public.nobar_messages FOR INSERT
    WITH CHECK (true);

-- Enable Realtime for nobar tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'nobar_rooms'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.nobar_rooms;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'nobar_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.nobar_messages;
    END IF;
END $$;
