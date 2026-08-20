import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { MilkTrendChart } from "@/components/dairy/charts";
import { ConfirmDelete } from "@/components/dairy/confirm-delete";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/dairy/ui";
import { supabase } from "@/integrations/supabase/client";
import { listCows, listMilkRecords, type MilkRecord } from "@/lib/api";
import { dayLabel, daysAgo, litres, shortDate, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/milk")({
  head: () => ({
    meta: [
      { title: "Milk Production — Agro Dairy" },
      {
        name: "description",
        content:
          "Record morning, noon and evening milking sessions per cow and track daily, weekly and monthly production totals.",
      },
      { property: "og:title", content: "Milk Production — Agro Dairy" },
      {
        property: "og:description",
        content: "Log milking sessions and monitor production trends across the herd.",
      },
    ],
  }),
  component: MilkPage,
});

const SESSIONS = ["Morning", "Noon", "Evening"] as const;

const schema = z.object({
  cow_id: z.string().uuid("Select a cow"),
  date: z.string().min(1, "Date is required"),
  session: z.string().min(1),
  quantity: z
    .string()
    .min(1, "Quantity is required")
    .refine((v) => Number(v) > 0 && Number(v) <= 100, "Quantity must be between 0 and 100 L"),
  notes: z.string().trim().max(300).optional(),
});

function MilkPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MilkRecord | null>(null);
  const [filterCow, setFilterCow] = useState("all");
  const [filterSession, setFilterSession] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [form, setForm] = useState({
    cow_id: "",
    date: today(),
    session: "Morning",
    quantity: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const cowsQuery = useQuery({ queryKey: ["cows"], queryFn: listCows });
  const milkQuery = useQuery({
    queryKey: ["milk", "all"],
    queryFn: () => listMilkRecords(daysAgo(120)),
  });

  const records = milkQuery.data ?? [];

  const stats = useMemo(() => {
    const t = today();
    const week = daysAgo(6);
    const month = t.slice(0, 7);
    const sum = (list: MilkRecord[]) => list.reduce((s, r) => s + Number(r.quantity), 0);
    const todays = records.filter((r) => r.date === t);
    return {
      today: sum(todays),
      week: sum(records.filter((r) => r.date >= week)),
      month: sum(records.filter((r) => r.date.startsWith(month))),
      cowsMilked: new Set(todays.map((r) => r.cow_id)).size,
    };
  }, [records]);

  const trend = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const r of records) byDay.set(r.date, (byDay.get(r.date) ?? 0) + Number(r.quantity));
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([date, value]) => ({ label: dayLabel(date), litres: Math.round(value * 10) / 10 }));
  }, [records]);

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (filterCow !== "all" && r.cow_id !== filterCow) return false;
        if (filterSession !== "all" && r.session !== filterSession) return false;
        if (filterDate && r.date !== filterDate) return false;
        return true;
      }),
    [records, filterCow, filterSession, filterDate],
  );

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid entry");
      const v = parsed.data;
      const payload = {
        cow_id: v.cow_id,
        date: v.date,
        session: v.session,
        quantity: Number(v.quantity),
        notes: v.notes || null,
      };
      const result = editing
        ? await supabase.from("milk_records").update(payload).eq("id", editing.id)
        : await supabase.from("milk_records").insert(payload);
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: async () => {
      toast.success(editing ? "Record updated" : "Milk record added");
      await queryClient.invalidateQueries({ queryKey: ["milk"] });
      await queryClient.invalidateQueries({ queryKey: ["cow-milk"] });
      setOpen(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: e } = await supabase.from("milk_records").delete().eq("id", id);
      if (e) throw new Error(e.message);
    },
    onSuccess: async () => {
      toast.success("Record deleted");
      await queryClient.invalidateQueries({ queryKey: ["milk"] });
    },
    onError: (err: Error) => toast.error("Could not delete", { description: err.message }),
  });

  function startAdd() {
    setEditing(null);
    setError(null);
    setForm({ cow_id: "", date: today(), session: "Morning", quantity: "", notes: "" });
    setOpen(true);
  }

  function startEdit(record: MilkRecord) {
    setEditing(record);
    setError(null);
    setForm({
      cow_id: record.cow_id,
      date: record.date,
      session: record.session,
      quantity: String(record.quantity),
      notes: record.notes ?? "",
    });
    setOpen(true);
  }

  if (milkQuery.isError) return <ErrorBlock message="Milk records could not be loaded." />;

  return (
    <div>
      <PageHeader
        title="Milk Production"
        description="Log each milking session and monitor herd output over time."
        actions={
          <Button onClick={startAdd}>
            <Plus className="mr-1 size-4" /> Add Milk Record
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today" value={litres(stats.today, 0)} hint={`${stats.cowsMilked} cows milked`} />
        <StatCard label="Last 7 days" value={litres(stats.week, 0)} />
        <StatCard label="This month" value={litres(stats.month, 0)} />
        <StatCard
          label="Average per cow today"
          value={litres(stats.cowsMilked ? stats.today / stats.cowsMilked : 0)}
        />
      </div>

      <SectionCard
        title="Production trend"
        description="Total litres per day over the last 30 recorded days."
        className="mb-6"
      >
        {milkQuery.isLoading ? <LoadingBlock rows={4} /> : <MilkTrendChart data={trend} />}
      </SectionCard>

      <div className="card-surface mb-5 grid gap-3 p-4 sm:grid-cols-3">
        <Select value={filterCow} onValueChange={setFilterCow}>
          <SelectTrigger>
            <SelectValue placeholder="Cow" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cows</SelectItem>
            {(cowsQuery.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.cow_id} · {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSession} onValueChange={setFilterSession}>
          <SelectTrigger>
            <SelectValue placeholder="Session" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sessions</SelectItem>
            {SESSIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
      </div>

      <div className="card-surface overflow-hidden">
        {milkQuery.isLoading ? (
          <div className="p-5">
            <LoadingBlock rows={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No milk records found"
              description="Adjust the filters or add a new milking record."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Cow</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{shortDate(r.date)}</TableCell>
                    <TableCell className="font-medium">
                      {r.cows ? `${r.cows.cow_id} · ${r.cows.name}` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.session}</TableCell>
                    <TableCell className="font-semibold">{litres(r.quantity)}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {r.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit record"
                          onClick={() => startEdit(r)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <ConfirmDelete
                          title="Delete milk record?"
                          onConfirm={() => remove.mutate(r.id)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Delete record">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit milk record" : "Add milk record"}</DialogTitle>
            <DialogDescription>
              Select the cow, milking session and quantity produced.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cow</Label>
              <Select value={form.cow_id} onValueChange={(v) => setForm({ ...form, cow_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a cow" />
                </SelectTrigger>
                <SelectContent>
                  {(cowsQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.cow_id} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="milk-date">Date</Label>
              <Input
                id="milk-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Session</Label>
              <Select value={form.session} onValueChange={(v) => setForm({ ...form, session: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="qty">Quantity (litres)</Label>
              <Input
                id="qty"
                type="number"
                step="0.1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="8.5"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="milk-notes">Notes</Label>
              <Textarea
                id="milk-notes"
                rows={3}
                maxLength={300}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {editing ? "Save changes" : "Add record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
