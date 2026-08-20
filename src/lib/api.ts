import { supabase } from "@/integrations/supabase/client";

export type Cow = {
  id: string;
  cow_id: string;
  name: string;
  breed: string;
  date_of_birth: string | null;
  gender: string;
  weight: number | null;
  date_acquired: string | null;
  health_status: string;
  current_status: string;
  photo: string | null;
  notes: string | null;
  created_at: string;
};

export type MilkRecord = {
  id: string;
  cow_id: string;
  date: string;
  session: string;
  quantity: number;
  recorded_by: string | null;
  notes: string | null;
  cows?: { cow_id: string; name: string } | null;
};

export type FeedItem = {
  id: string;
  feed_name: string;
  feed_type: string;
  quantity: number;
  unit: string;
  daily_usage: number;
  cost: number;
  supplier: string | null;
  purchase_date: string | null;
  minimum_stock: number;
  expiry_date: string | null;
  notes: string | null;
};

export type FeedUsage = {
  id: string;
  feed_id: string;
  date: string;
  quantity_used: number;
  number_of_cows: number | null;
  notes: string | null;
  feed_inventory?: { feed_name: string; unit: string } | null;
};

export type Income = {
  id: string;
  date: string;
  source: string | null;
  category: string;
  customer: string | null;
  milk_quantity: number | null;
  price_per_litre: number | null;
  amount: number;
  payment_status: string;
  notes: string | null;
};

export type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string | null;
  supplier: string | null;
  payment_status: string;
  notes: string | null;
};

export type Notification = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  is_read: boolean;
  is_completed: boolean;
  related_id: string | null;
  created_at: string;
};

export type Farm = {
  id: string;
  farm_name: string;
  location: string | null;
  owner_name: string | null;
  contact: string | null;
  email: string | null;
};

export type Profile = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  photo: string | null;
};

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const COW_STATUSES = ["Active", "Pregnant", "Sick", "Sold", "Inactive"] as const;
export const HEALTH_STATUSES = ["Healthy", "Needs Attention", "Under Treatment"] as const;
export const BREEDS = [
  "Holstein Friesian",
  "Sahiwal",
  "Red Chittagong Cattle",
  "Pabna Cattle",
  "Munshiganj Cattle",
  "North Bengal Grey",
] as const;

export const VACCINE_TYPES = [
  "Foot and Mouth Disease (FMD) Vaccine",
  "Lumpy Skin Disease (LSD) Vaccine",
  "Black Quarter (BQ) Vaccine",
] as const;
export const FEED_TYPES = ["Grass", "Hay", "Silage", "Concentrate", "Other"] as const;
export const INCOME_CATEGORIES = ["Milk Sales", "Other Sales", "Other Income"] as const;
export const EXPENSE_CATEGORIES = [
  "Feed",
  "Medicine",
  "Veterinary",
  "Equipment",
  "Salaries",
  "Electricity",
  "Transportation",
  "Maintenance",
  "Other",
] as const;
export const NOTIFICATION_TYPES = ["Vaccination", "Feed"] as const;

export const listCows = async () =>
  unwrap<Cow[]>(await supabase.from("cows").select("*").order("cow_id"));

export const getCow = async (id: string) => {
  const { data, error } = await supabase.from("cows").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Cow | null;
};

export const listMilkRecords = async (fromDate?: string) => {
  let q = supabase
    .from("milk_records")
    .select("*, cows(cow_id, name)")
    .order("date", { ascending: false })
    .order("session")
    .limit(2000);
  if (fromDate) q = q.gte("date", fromDate);
  return unwrap<MilkRecord[]>(await q);
};

export const listCowMilk = async (cowId: string) =>
  unwrap<MilkRecord[]>(
    await supabase
      .from("milk_records")
      .select("*")
      .eq("cow_id", cowId)
      .order("date", { ascending: false })
      .limit(400),
  );

export const listFeed = async () =>
  unwrap<FeedItem[]>(await supabase.from("feed_inventory").select("*").order("feed_name"));

export const listFeedUsage = async () =>
  unwrap<FeedUsage[]>(
    await supabase
      .from("feed_usage")
      .select("*, feed_inventory(feed_name, unit)")
      .order("date", { ascending: false })
      .limit(400),
  );

export const listIncome = async () =>
  unwrap<Income[]>(
    await supabase.from("income").select("*").order("date", { ascending: false }).limit(1000),
  );

export const listExpenses = async () =>
  unwrap<Expense[]>(
    await supabase.from("expenses").select("*").order("date", { ascending: false }).limit(1000),
  );

export const listNotifications = async () =>
  unwrap<Notification[]>(
    await supabase
      .from("notifications")
      .select("*")
      .in("type", ["Vaccination", "Feed"])
      .order("created_at", { ascending: false })
      .limit(200),
  );

export const getFarm = async () => {
  const { data, error } = await supabase.from("farm").select("*").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Farm | null;
};

export const getProfile = async () => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as Profile;
  const inserted = await supabase
    .from("profiles")
    .insert({
      id: auth.user.id,
      email: auth.user.email ?? null,
      name: auth.user.email?.split("@")[0] ?? "Farm Manager",
    })
    .select("*")
    .maybeSingle();
  return (inserted.data as Profile) ?? null;
};

export function stockStatus(item: FeedItem): "Available" | "Low Stock" | "Out of Stock" {
  if (item.quantity <= 0) return "Out of Stock";
  if (item.quantity <= item.minimum_stock) return "Low Stock";
  return "Available";
}

export type Vaccination = {
  id: string;
  cow_id: string;
  vaccine_name: string;
  vaccination_date: string;
  next_due_date: string | null;
  is_completed: boolean;
  notes: string | null;
  created_at: string;
  cows?: { cow_id: string; name: string } | null;
};

export type VaccinationStatus = "Upcoming" | "Due Soon" | "Completed";

export const listVaccinations = async () =>
  unwrap<Vaccination[]>(
    await supabase
      .from("vaccinations")
      .select("*, cows(cow_id, name)")
      .order("next_due_date", { ascending: true, nullsFirst: false })
      .limit(1000),
  );

export const listCowVaccinations = async (cowId: string) =>
  unwrap<Vaccination[]>(
    await supabase
      .from("vaccinations")
      .select("*")
      .eq("cow_id", cowId)
      .order("vaccination_date", { ascending: false }),
  );

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  return Math.round((target.getTime() - startOfToday().getTime()) / 86400000);
}

export function vaccinationStatus(record: Vaccination): VaccinationStatus {
  if (record.is_completed || !record.next_due_date) return "Completed";
  const diff = daysUntil(record.next_due_date);
  if (diff === null) return "Completed";
  if (diff <= 2) return "Due Soon";
  return "Upcoming";
}

/**
 * Creates a Notification Centre entry for every vaccination that is due within
 * the next two days. `related_id` holds the vaccination id, so the same
 * vaccination never produces a duplicate notification.
 */
export async function syncVaccinationNotifications() {
  const records = await listVaccinations();
  const pending = records.filter((r) => {
    if (vaccinationStatus(r) !== "Due Soon") return false;
    const diff = daysUntil(r.next_due_date);
    return diff !== null && diff >= 0;
  });
  if (pending.length === 0) return 0;

  const { data: existing, error } = await supabase
    .from("notifications")
    .select("related_id")
    .eq("type", "Vaccination")
    .in(
      "related_id",
      pending.map((r) => r.id),
    );
  if (error) throw new Error(error.message);
  const seen = new Set((existing ?? []).map((n) => n.related_id));

  const rows = pending
    .filter((r) => !seen.has(r.id))
    .map((r) => {
      const due = new Date(`${r.next_due_date}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
      });
      const cow = r.cows?.name ?? "Cow";
      return {
        title: `Vaccination due soon: ${cow}`,
        description: `${cow} is due for ${r.vaccine_name} on ${due}.`,
        type: "Vaccination",
        priority: "Medium",
        related_id: r.id,
      };
    });
  if (rows.length === 0) return 0;
  const { error: insertError } = await supabase.from("notifications").insert(rows);
  if (insertError) throw new Error(insertError.message);
  return rows.length;
}

export async function saveVaccination(input: {
  id?: string;
  cow_id: string;
  vaccine_name: string;
  vaccination_date: string;
  next_due_date: string | null;
  is_completed: boolean;
  notes: string | null;
}) {
  const { id, ...values } = input;
  if (id) {
    const { error } = await supabase.from("vaccinations").update(values).eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from("vaccinations").insert(values);
  if (error) throw new Error(error.message);
}

export async function deleteVaccination(id: string) {
  await supabase.from("notifications").delete().eq("related_id", id).eq("type", "Vaccination");
  const { error } = await supabase.from("vaccinations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
