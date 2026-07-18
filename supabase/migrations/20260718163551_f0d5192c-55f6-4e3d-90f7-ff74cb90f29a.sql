
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  tradition TEXT NOT NULL DEFAULT 'both',
  default_sa TEXT NOT NULL DEFAULT 'C',
  voice_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- lessons (public catalog)
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  tradition TEXT NOT NULL,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  target_sa TEXT NOT NULL DEFAULT 'C',
  bpm INTEGER NOT NULL DEFAULT 60,
  tala TEXT,
  loop_count INTEGER NOT NULL DEFAULT 8,
  instructions TEXT NOT NULL,
  pattern TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lessons TO anon, authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons public read" ON public.lessons FOR SELECT USING (true);

-- practice_sessions
CREATE TABLE public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  lesson_id UUID REFERENCES public.lessons ON DELETE SET NULL,
  tools JSONB NOT NULL DEFAULT '{}'::jsonb,
  pitch_stats JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_sessions TO authenticated;
GRANT ALL ON public.practice_sessions TO service_role;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.practice_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_practice_sessions_user_started ON public.practice_sessions(user_id, started_at DESC);

-- lesson_progress
CREATE TABLE public.lesson_progress (
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  times_practiced INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress" ON public.lesson_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_settings
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  default_sa TEXT NOT NULL DEFAULT 'C',
  default_bpm INTEGER NOT NULL DEFAULT 60,
  default_tala TEXT NOT NULL DEFAULT 'teentaal',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- seed lessons
INSERT INTO public.lessons (slug, title, tradition, level, category, target_sa, bpm, tala, loop_count, instructions, pattern, order_index) VALUES
('warmup-sa-hold', 'Sa Hold', 'both', 'beginner', 'warmup', 'C', 60, NULL, 8, 'Sing a steady Sa in tune with the tanpura. Focus on breath and pitch stability.', 'Sa', 1),
('warmup-sa-re-sa', 'Sa Re Sa', 'both', 'beginner', 'warmup', 'C', 60, NULL, 8, 'Move gently between Sa and Re. Return to Sa each time.', 'Sa Re Sa - Sa Re Sa', 2),
('alankar-ascending', 'Ascending Alankar', 'hindustani', 'beginner', 'alankar', 'C', 70, 'teentaal', 8, 'Sa Re Ga Ma Pa Dha Ni Sa (upper) and back down.', 'S R G M P D N S''', 3),
('alankar-jumps', 'Alankar Jumps', 'hindustani', 'intermediate', 'alankar', 'C', 80, 'teentaal', 8, 'Sa Ga, Re Ma, Ga Pa, Ma Dha, Pa Ni, Dha Sa''', 'SG RM GP MD PN DS''', 4),
('sarali-varisai-1', 'Sarali Varisai 1', 'carnatic', 'beginner', 'varisai', 'C', 60, 'adi', 8, 'Basic ascending and descending pattern in Mayamalavagowla.', 'S R G M P D N S'' - S'' N D P M G R S', 5),
('janta-varisai', 'Janta Varisai', 'carnatic', 'beginner', 'varisai', 'C', 60, 'adi', 8, 'Paired notes: Sa Sa Re Re Ga Ga Ma Ma...', 'SS RR GG MM PP DD NN S''S''', 6),
('yaman-avaroh', 'Raag Yaman Aroh-Avaroh', 'hindustani', 'beginner', 'raag', 'C', 60, 'teentaal', 4, 'Nṟi Re Ga Ma# Pa Dha Ni Sa''. Descend the same way.', 'N R G M# P D N S''', 7),
('bhupali-intro', 'Raag Bhupali Aroh', 'hindustani', 'beginner', 'raag', 'C', 60, 'teentaal', 4, 'Pentatonic: Sa Re Ga Pa Dha Sa''. Sing softly and legato.', 'S R G P D S''', 8),
('bhairav-intro', 'Raag Bhairav Aroh', 'hindustani', 'intermediate', 'raag', 'C', 55, 'ektaal', 4, 'Sa Re(b) Ga Ma Pa Dha(b) Ni Sa''. Note the komal Re and Dha.', 'S r G M P d N S''', 9),
('sargam-geet', 'Simple Sargam Geet', 'hindustani', 'beginner', 'song', 'C', 70, 'teentaal', 4, 'Sing a short sargam composition in Yaman.', 'N R G M# G R S', 10);
