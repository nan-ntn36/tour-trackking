-- Tour Tracking App — Initial Schema
-- Run this in your Supabase SQL Editor

-- 1. Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. User profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Check-in destinations
CREATE TABLE destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT,
  is_favorite BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tracked routes
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT,
  path GEOGRAPHY(LINESTRING, 4326) NOT NULL,
  distance_meters FLOAT,
  duration_seconds INT,
  is_visible BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Group tours
CREATE TABLE tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  start_location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Tour membership
CREATE TABLE tour_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tour_id, user_id)
);

-- 7. Realtime member positions (UPSERT pattern)
CREATE TABLE member_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tour_id, user_id)
);

-- 8. Photos (metadata — files on Cloudinary)
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE SET NULL,
  destination_id UUID REFERENCES destinations(id) ON DELETE SET NULL,
  cloudinary_public_id TEXT NOT NULL,
  cloudinary_url TEXT NOT NULL,
  caption TEXT,
  location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Push notification tokens
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, expo_push_token)
);

-- 10. User statistics (cached)
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_distance_km FLOAT DEFAULT 0,
  total_tours INT DEFAULT 0,
  total_checkins INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== RLS POLICIES ====================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Destinations: users see + manage only their own
CREATE POLICY "Users can manage own destinations" ON destinations FOR ALL USING (auth.uid() = user_id);

-- Routes: users see + manage only their own
CREATE POLICY "Users can manage own routes" ON routes FOR ALL USING (auth.uid() = user_id);

-- Tours: anyone can view active tours, creators manage their own
CREATE POLICY "Active tours are viewable" ON tours FOR SELECT USING (true);
CREATE POLICY "Users can create tours" ON tours FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update own tours" ON tours FOR UPDATE USING (auth.uid() = creator_id);

-- Tour members: members can view, anyone can join
CREATE POLICY "Tour members are viewable by tour members" ON tour_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tour_members tm WHERE tm.tour_id = tour_members.tour_id AND tm.user_id = auth.uid())
  );
CREATE POLICY "Users can join tours" ON tour_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave tours" ON tour_members FOR DELETE USING (auth.uid() = user_id);

-- Member locations: viewable by tour members
CREATE POLICY "Member locations viewable by tour members" ON member_locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tour_members tm WHERE tm.tour_id = member_locations.tour_id AND tm.user_id = auth.uid())
  );
CREATE POLICY "Users can update own location" ON member_locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can upsert own location" ON member_locations FOR UPDATE USING (auth.uid() = user_id);

-- Photos: viewable by tour members or photo owner
CREATE POLICY "Users can manage own photos" ON photos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tour members can view tour photos" ON photos
  FOR SELECT USING (
    tour_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM tour_members tm WHERE tm.tour_id = photos.tour_id AND tm.user_id = auth.uid()
    )
  );

-- Push tokens: users manage only their own
CREATE POLICY "Users can manage own push tokens" ON push_tokens FOR ALL USING (auth.uid() = user_id);

-- User stats: users see all, update only their own  
CREATE POLICY "Stats are viewable" ON user_stats FOR SELECT USING (true);
CREATE POLICY "Users can manage own stats" ON user_stats FOR ALL USING (auth.uid() = user_id);

-- ==================== AUTO-CREATE PROFILE ON SIGNUP ====================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  
  INSERT INTO user_stats (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==================== ENABLE REALTIME ====================
ALTER PUBLICATION supabase_realtime ADD TABLE member_locations;
