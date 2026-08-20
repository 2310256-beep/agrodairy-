-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Farm Manager',
  email TEXT,
  role TEXT NOT NULL DEFAULT 'Farm Manager',
  photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- farm
CREATE TABLE public.farm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_name TEXT NOT NULL,
  location TEXT,
  owner_name TEXT,
  contact TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm TO authenticated;
GRANT ALL ON public.farm TO service_role;
ALTER TABLE public.farm ENABLE ROW LEVEL SECURITY;
CREATE POLICY "farm all" ON public.farm FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- cows
CREATE TABLE public.cows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cow_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  breed TEXT NOT NULL DEFAULT 'Local',
  date_of_birth DATE,
  gender TEXT NOT NULL DEFAULT 'Female',
  weight NUMERIC,
  date_acquired DATE,
  health_status TEXT NOT NULL DEFAULT 'Healthy',
  current_status TEXT NOT NULL DEFAULT 'Active',
  photo TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cows TO authenticated;
GRANT ALL ON public.cows TO service_role;
ALTER TABLE public.cows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cows all" ON public.cows FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- milk_records
CREATE TABLE public.milk_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cow_id UUID NOT NULL REFERENCES public.cows(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  session TEXT NOT NULL DEFAULT 'Morning',
  quantity NUMERIC NOT NULL DEFAULT 0,
  recorded_by TEXT DEFAULT 'Farm Manager',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milk_records TO authenticated;
GRANT ALL ON public.milk_records TO service_role;
ALTER TABLE public.milk_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milk all" ON public.milk_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX milk_records_date_idx ON public.milk_records(date);

-- feed_inventory
CREATE TABLE public.feed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_name TEXT NOT NULL,
  feed_type TEXT NOT NULL DEFAULT 'Other',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  daily_usage NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  purchase_date DATE,
  minimum_stock NUMERIC NOT NULL DEFAULT 0,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_inventory TO authenticated;
GRANT ALL ON public.feed_inventory TO service_role;
ALTER TABLE public.feed_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed all" ON public.feed_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- feed_usage
CREATE TABLE public.feed_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES public.feed_inventory(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_used NUMERIC NOT NULL DEFAULT 0,
  number_of_cows INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_usage TO authenticated;
GRANT ALL ON public.feed_usage TO service_role;
ALTER TABLE public.feed_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed usage all" ON public.feed_usage FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- income
CREATE TABLE public.income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT,
  category TEXT NOT NULL DEFAULT 'Milk Sales',
  customer TEXT,
  milk_quantity NUMERIC,
  price_per_litre NUMERIC,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'Paid',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income TO authenticated;
GRANT ALL ON public.income TO service_role;
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "income all" ON public.income FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'Other',
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  supplier TEXT,
  payment_status TEXT NOT NULL DEFAULT 'Paid',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses all" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'System Alerts',
  priority TEXT NOT NULL DEFAULT 'Medium',
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications all" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- auto-decrement feed stock on usage + low stock alert
CREATE OR REPLACE FUNCTION public.apply_feed_usage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f RECORD;
BEGIN
  UPDATE public.feed_inventory
    SET quantity = GREATEST(quantity - NEW.quantity_used, 0)
    WHERE id = NEW.feed_id
    RETURNING * INTO f;
  IF f.id IS NOT NULL AND f.quantity <= f.minimum_stock THEN
    INSERT INTO public.notifications (title, description, type, priority, related_id)
    VALUES (
      f.feed_name || ' stock is low',
      f.feed_name || ' is at ' || f.quantity || ' ' || f.unit || ', at or below the minimum level of ' || f.minimum_stock || ' ' || f.unit || '.',
      'Feed', 'High', f.id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER feed_usage_applied AFTER INSERT ON public.feed_usage
FOR EACH ROW EXECUTE FUNCTION public.apply_feed_usage();

-- ============ DEMO DATA ============
INSERT INTO public.farm (farm_name, location, owner_name, contact, email)
VALUES ('Green Meadow Dairy Farm', 'Savar, Dhaka, Bangladesh', 'Md. Rafiqul Islam', '+880 1711 223344', 'info@greenmeadowdairy.com');

INSERT INTO public.cows (cow_id, name, breed, date_of_birth, gender, weight, date_acquired, health_status, current_status)
SELECT
  'C-' || lpad(g::text, 3, '0'),
  (ARRAY['Lakshmi','Moti','Rani','Kajol','Shonali','Bijli','Chandni','Ganga','Radha','Puspa','Nandini','Tara','Jhumur','Sathi','Padma'])[1 + (g % 15)] || ' ' || g,
  (ARRAY['Holstein Friesian','Sahiwal','Jersey','Red Sindhi','Local','Crossbred'])[1 + (g % 6)],
  (CURRENT_DATE - ((700 + (g * 37) % 1900) || ' days')::interval)::date,
  CASE WHEN g % 12 = 0 THEN 'Male' ELSE 'Female' END,
  320 + (g * 13) % 220,
  (CURRENT_DATE - ((100 + (g * 11) % 900) || ' days')::interval)::date,
  CASE WHEN g % 15 = 0 THEN 'Under Treatment' WHEN g % 9 = 0 THEN 'Needs Attention' ELSE 'Healthy' END,
  CASE WHEN g % 15 = 0 THEN 'Sick' WHEN g % 11 = 0 THEN 'Pregnant' WHEN g = 44 THEN 'Inactive' WHEN g = 45 THEN 'Sold' ELSE 'Active' END
FROM generate_series(1, 45) g;

INSERT INTO public.milk_records (cow_id, date, session, quantity, recorded_by)
SELECT c.id, d::date, s.session,
  ROUND((4.5 + ((abs(hashtext(c.cow_id || d::text || s.session)) % 40) / 10.0))::numeric, 1)
    * CASE WHEN s.session = 'Morning' THEN 1.15 ELSE 0.9 END,
  'Farm Manager'
FROM public.cows c
CROSS JOIN generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day'::interval) d
CROSS JOIN (VALUES ('Morning'), ('Evening')) AS s(session)
WHERE c.gender = 'Female' AND c.current_status IN ('Active','Pregnant');

INSERT INTO public.feed_inventory (feed_name, feed_type, quantity, unit, daily_usage, cost, supplier, purchase_date, minimum_stock, expiry_date) VALUES
('Napier Grass','Grass',1250,'kg',180,9500,'Savar Agro Supply',CURRENT_DATE - 6,300,CURRENT_DATE + 20),
('Paddy Straw Hay','Hay',860,'kg',120,7200,'Local Farmers Co-op',CURRENT_DATE - 12,250,CURRENT_DATE + 90),
('Maize Silage','Silage',180,'kg',90,6800,'Dhaka Feed Mills',CURRENT_DATE - 20,200,CURRENT_DATE + 45),
('Dairy Concentrate','Concentrate',95,'kg',60,11500,'Nourish Feeds Ltd',CURRENT_DATE - 8,150,CURRENT_DATE + 120),
('Mineral Mixture','Other',0,'kg',5,2400,'AgriVet BD',CURRENT_DATE - 35,20,CURRENT_DATE + 200),
('Wheat Bran','Concentrate',540,'kg',45,5400,'Dhaka Feed Mills',CURRENT_DATE - 4,120,CURRENT_DATE + 60);

INSERT INTO public.feed_usage (feed_id, date, quantity_used, number_of_cows, notes)
SELECT f.id, CURRENT_DATE, f.daily_usage, 43, 'Daily ration' FROM public.feed_inventory f WHERE f.quantity > 0;

INSERT INTO public.income (date, source, category, customer, milk_quantity, price_per_litre, amount, payment_status)
SELECT d::date, 'Daily milk delivery', 'Milk Sales',
  (ARRAY['Savar Milk Vita','Dhaka Dairy Mart','Local Retail Buyers','Rahim Sweets'])[1 + (extract(day from d)::int % 4)],
  170 + (extract(day from d)::int * 3 % 40),
  70,
  (170 + (extract(day from d)::int * 3 % 40)) * 70,
  CASE WHEN extract(day from d)::int % 9 = 0 THEN 'Pending' ELSE 'Paid' END
FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day'::interval) d;

INSERT INTO public.income (date, source, category, customer, amount, payment_status, notes) VALUES
(CURRENT_DATE - 12, 'Sale of calf', 'Other Sales', 'Kamal Hossain', 42000, 'Paid', 'Male calf sold at local market'),
(CURRENT_DATE - 5, 'Cow dung / organic fertilizer', 'Other Income', 'Green Nursery', 6500, 'Paid', NULL),
(CURRENT_DATE - 2, 'Sale of cow C-045', 'Other Sales', 'Jamal Traders', 78000, 'Pending', 'Payment expected within a week');

INSERT INTO public.expenses (date, category, amount, description, supplier, payment_status) VALUES
(CURRENT_DATE - 28, 'Feed', 18500, 'Monthly concentrate and bran purchase', 'Dhaka Feed Mills', 'Paid'),
(CURRENT_DATE - 25, 'Salaries', 24000, 'Farm workers salary (3 workers)', NULL, 'Paid'),
(CURRENT_DATE - 22, 'Medicine', 4200, 'Deworming and vitamin supplements', 'AgriVet BD', 'Paid'),
(CURRENT_DATE - 19, 'Electricity', 3800, 'Monthly electricity bill for milking shed', 'DESCO', 'Paid'),
(CURRENT_DATE - 15, 'Veterinary', 5500, 'Vet visit and pregnancy check for 6 cows', 'Dr. Anisur Rahman', 'Paid'),
(CURRENT_DATE - 12, 'Transportation', 2600, 'Milk delivery van fuel', NULL, 'Paid'),
(CURRENT_DATE - 9, 'Equipment', 9500, 'Milking bucket and steel cans', 'Savar Agro Supply', 'Pending'),
(CURRENT_DATE - 6, 'Feed', 12800, 'Napier grass and hay restock', 'Savar Agro Supply', 'Paid'),
(CURRENT_DATE - 4, 'Maintenance', 3400, 'Shed roof and drainage repair', 'Local contractor', 'Paid'),
(CURRENT_DATE - 1, 'Other', 1700, 'Cleaning supplies and disinfectant', NULL, 'Paid');

INSERT INTO public.notifications (title, description, type, priority, is_read)
SELECT 'Cow ' || c.cow_id || ' is due for vaccination tomorrow.',
  'FMD booster vaccination scheduled for ' || c.name || '. Please keep the vet appointment ready.',
  'Vaccination', 'High', false
FROM public.cows c WHERE c.cow_id = 'C-001';

INSERT INTO public.notifications (title, description, type, priority, is_read) VALUES
('Dairy Concentrate is below the minimum stock level.', 'Only 95 kg left against a minimum of 150 kg. Reorder from Nourish Feeds Ltd.', 'Feed', 'High', false),
('Mineral Mixture is out of stock.', 'Mineral Mixture has reached 0 kg. Cows may miss their daily mineral ration.', 'Feed', 'High', false),
('Veterinary checkup scheduled for Cow C-005 today.', 'Routine health inspection with Dr. Anisur Rahman at 4:00 PM.', 'Veterinary', 'Medium', false),
('Milk production from Cow C-014 has decreased.', 'Average daily yield dropped by 18% compared to last week. Check feed intake and udder health.', 'Milk Production', 'Medium', true),
('Monthly medicine stock review is due.', 'Review remaining medicine stock and record any expired items.', 'Medicine', 'Low', true),
('Monthly backup of farm records completed.', 'All cow, milk, feed and finance records were saved successfully.', 'System Alerts', 'Low', true);