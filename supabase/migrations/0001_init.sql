-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Elders (one-to-one with profiles)
CREATE TABLE IF NOT EXISTS elders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 150),
  favorite_topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions (metadata only, no transcripts)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'error', 'abandoned')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_elders_profile_id ON elders(profile_id);
CREATE INDEX IF NOT EXISTS idx_sessions_elder_id ON sessions(elder_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE elders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Profiles RLS: user can only see/edit their own profile
CREATE POLICY "Profiles - user can read own" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Profiles - user can update own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Profiles - user can insert own" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Elders RLS: user can only see/edit elder where profile_id = auth.uid()
CREATE POLICY "Elders - user can read own elder" ON elders
  FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Elders - user can update own elder" ON elders
  FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Elders - user can insert own elder" ON elders
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Elders - user can delete own elder" ON elders
  FOR DELETE
  USING (profile_id = auth.uid());

-- Sessions RLS: user can only see sessions of their own elder
CREATE POLICY "Sessions - user can read own sessions" ON sessions
  FOR SELECT
  USING (
    elder_id IN (
      SELECT id FROM elders WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Sessions - user can insert own sessions" ON sessions
  FOR INSERT
  WITH CHECK (
    elder_id IN (
      SELECT id FROM elders WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Sessions - user can update own sessions" ON sessions
  FOR UPDATE
  USING (
    elder_id IN (
      SELECT id FROM elders WHERE profile_id = auth.uid()
    )
  );

-- Trigger: on_auth_user_created
-- Inserts row in profiles when new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'first_name', ''), COALESCE(new.raw_user_meta_data->>'last_name', ''));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
