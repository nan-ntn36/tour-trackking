-- Phase 6: Group Tours — SQL Migration
-- Run this in Supabase SQL Editor

-- 1. Tours table
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  start_location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tour members table
CREATE TABLE IF NOT EXISTS tour_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tour_id, user_id)
);

-- 3. RLS
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_members ENABLE ROW LEVEL SECURITY;

-- Tours policies
CREATE POLICY "Anyone can view tours" ON tours
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can create tours" ON tours
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creator can update tour" ON tours
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Creator can delete tour" ON tours
  FOR DELETE USING (auth.uid() = creator_id);

-- Tour members policies
-- Dùng auth.uid() trực tiếp, tránh self-reference gây infinite recursion
CREATE POLICY "Authenticated can view tour members" ON tour_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can join tour" ON tour_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner or self can remove member" ON tour_members
  FOR DELETE USING (
    auth.uid() = user_id OR
    tour_id IN (SELECT id FROM tours WHERE creator_id = auth.uid())
  );

-- 4. Tour destinations (liên kết tour với điểm đến)
CREATE TABLE IF NOT EXISTS tour_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  destination_id UUID REFERENCES destinations(id) ON DELETE CASCADE,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tour_id, destination_id)
);

ALTER TABLE tour_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tour destinations" ON tour_destinations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Members can add destinations" ON tour_destinations
  FOR INSERT WITH CHECK (auth.uid() = added_by);

CREATE POLICY "Owner or adder can remove" ON tour_destinations
  FOR DELETE USING (
    auth.uid() = added_by OR
    tour_id IN (SELECT id FROM tours WHERE creator_id = auth.uid())
  );

-- 5. Live location tracking — thêm cột vị trí vào tour_members
ALTER TABLE tour_members
  ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ;

CREATE POLICY "Members can update own location" ON tour_members
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Cho phép thành viên tour xem điểm đến của tour (dù thuộc user khác)
CREATE POLICY "Tour members can view tour destinations" ON destinations
  FOR SELECT USING (
    id IN (
      SELECT destination_id FROM tour_destinations
      WHERE tour_id IN (
        SELECT tour_id FROM tour_members WHERE user_id = auth.uid()
      )
    )
  );
