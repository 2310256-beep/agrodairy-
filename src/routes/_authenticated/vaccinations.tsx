import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Pencil, Plus, ShieldCheck, Syringe, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDelete } from "@/components/dairy/confirm-delete";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/dairy/ui";
import {
  VACCINE_TYPES,
  daysUntil,
  deleteVaccination,
  listCows,
  listVaccinations,
  saveVaccination,
  syncVaccinationNotifications,
  vaccinationStatus,
  type Vaccination,
} from "@/lib/api";
import { shortDate, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vaccinations")({
  head: () => ({
    meta: [
      { title: "Vaccination Tracking — Agro Dairy" },
      {
        name: "description",
        content:
          "Track FMD, LSD and BQ vaccinations for every cow with vaccination dates, due dates and upcoming reminders.",
      },
      { property: "og:title", content: "Vaccination Tracking — Agro Dairy" },
      {
        property: "og:description",
        content: "Cow-by-cow vaccination records with due-soon and overdue reminders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VaccinationsPage,
});

const schema = z.object({
  cow_id: z.string().uuid("Select a cow"),
  vaccine_name: z.string().min(1, "Select a vaccine"),
  vaccination_date: z.string().min(10, "Vaccination date is required"),
  next_due_date: z.string().max(10).optional(),
  notes: z.string().trim().max(500).optional(),
});

const DEFAULT_GAP: Record<string, number> = {
  "Foot and Mouth Disease (FMD) Vaccine": 180,
  "Lumpy Skin Disease (LSD) Vaccine": 365,
  "Black Quarter (BQ) Vaccine": 365,
};

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function VaccinationDialog({
  open,
  onOpenChange,
  record,
  cows,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: Vaccination | null;
  cows: { id: string; cow_id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    cow_id: "",
    vaccine_name: VACCINE_TYPES[0] as string,
    vaccination_date: today(),
    next_due_date: "",
    is_completed: false,
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      record
        ? {
            cow_id: record.cow_id,
            vaccine_name: record.vaccine_name,
            vaccination_date: record.vaccination_date,
            next_due_date: record.next_due_date ?? "",
            is_completed: record.is_completed,
            notes: record.notes ?? "",
          }
        : {
            cow_id: cows[0]?.id ?? "",
            vaccine_name: VACCINE_TYPES[0] as string,
            vaccination_date: today(),
            next_due_date: addDays(today(), DEFAULT_GAP[VACCINE_TYPES[0]] ?? 180),
            is_completed: false,
            notes: "",
          },
    );
  }, [open, record, cows]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid details");
      await saveVaccination({
        ...(record ? { id: record.id } : {}),
        cow_id: parsed.data.cow_id,
        vaccine_name: parsed.data.vaccine_name,
        vaccination_date: parsed.data.vaccination_date,
        next_due_date: parsed.data.next_due_date || null,
        is_completed: form.is_completed,
        notes: parsed.data.notes || null,
      });
      await syncVaccinationNotifications();
    },
    onSuccess: async () => {
      toast.success(record ? "Vaccination updated" : "Vaccination recorded");
      await queryClient.invalidateQueries({ queryKey: ["vaccinations"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{record ? "Edit vaccination" : "Record vaccination"}</DialogTitle>
          <DialogDescription>
            Link a vaccine to a cow and set the next due date so reminders appear automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Cow</Label>
            <Select
              value={form.cow_id}
              onValueChange={(v) => setForm((f) => ({ ...f, cow_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a cow" />
              </SelectTrigger>
              <SelectContent>
                {cows.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.cow_id} · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Vaccine</Label>
            <Select
              value={form.vaccine_name}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  vaccine_name: v,
                  next_due_date: f.vaccination_date
                    ? addDays(f.vaccination_date, DEFAULT_GAP[v] ?? 180)
                    : f.next_due_date,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VACCINE_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vdate">Vaccination date</Label>
            <Input
              id="vdate"
              type="date"
              value={form.vaccination_date}
              onChange={(e) => setForm((f) => ({ ...f, vaccination_date: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ndate">Next due date</Label>
            <Input
              id="ndate"
              type="date"
              value={form.next_due_date}
              onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Status</Label>
            <Select
              value={form.is_completed ? "completed" : "active"}
              onValueChange={(v) => setForm((f) => ({ ...f, is_completed: v === "completed" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Schedule tracked (auto status)</SelectItem>
                <SelectItem value="completed">Completed — no further dose needed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="vnotes">Notes</Label>
            <Textarea
              id="vnotes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              maxLength={500}
              rows={3}
            />
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {record ? "Save changes" : "Record vaccination"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VaccinationsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vaccination | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [vaccineFilter, setVaccineFilter] = useState("all");

  const query = useQuery({ queryKey: ["vaccinations"], queryFn: listVaccinations });
  const cowsQuery = useQuery({ queryKey: ["cows"], queryFn: listCows });
  const rows = query.data ?? [];

  useEffect(() => {
    if (rows.length === 0) return;
    let cancelled = false;
    syncVaccinationNotifications()
      .then((created) => {
        if (!cancelled && created > 0) {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [rows.length, queryClient]);

  const stats = useMemo(() => {
    const counts = { Upcoming: 0, "Due Soon": 0, Completed: 0 } as Record<
      string,
      number
    >;
    rows.forEach((r) => {
      counts[vaccinationStatus(r)] = (counts[vaccinationStatus(r)] ?? 0) + 1;
    });
    return counts;
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && vaccinationStatus(r) !== statusFilter) return false;
        if (vaccineFilter !== "all" && r.vaccine_name !== vaccineFilter) return false;
        return true;
      }),
    [rows, statusFilter, vaccineFilter],
  );

  const removeMutation = useMutation({
    mutationFn: deleteVaccination,
    onSuccess: async () => {
      toast.success("Vaccination record deleted");
      await queryClient.invalidateQueries({ queryKey: ["vaccinations"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error("Could not delete record", { description: e.message }),
  });

  return (
    <div>
      <PageHeader
        title="Vaccination Tracking"
        description="Vaccination history and upcoming doses for every cow in the herd."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" /> Record vaccination
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total records"
          value={String(rows.length)}
          icon={<Syringe className="size-4" />}
        />
        <StatCard
          label="Due within 2 days"
          value={String(stats["Due Soon"] ?? 0)}
          tone="accent"
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Upcoming"
          value={String(stats["Upcoming"] ?? 0)}
          tone="muted"
          icon={<ShieldCheck className="size-4" />}
        />
      </div>

      <SectionCard
        title="Vaccination records"
        description="Every dose recorded against a cow, with its next due date."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={vaccineFilter} onValueChange={setVaccineFilter}>
              <SelectTrigger className="w-[210px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vaccines</SelectItem>
                {VACCINE_TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Upcoming">Upcoming</SelectItem>
                <SelectItem value="Due Soon">Due Soon</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {query.isLoading ? (
          <LoadingBlock rows={6} />
        ) : query.isError ? (
          <ErrorBlock message={(query.error as Error).message} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No vaccination records"
            description="Record a vaccination to start tracking due dates."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Cow</th>
                  <th className="py-2 pr-4 font-semibold">Vaccine</th>
                  <th className="py-2 pr-4 font-semibold">Vaccinated</th>
                  <th className="py-2 pr-4 font-semibold">Next due</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-0 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const status = vaccinationStatus(r);
                  const diff = daysUntil(r.next_due_date);
                  return (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-foreground">{r.cows?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.cows?.cow_id}</p>
                      </td>
                      <td className="py-3 pr-4 text-foreground">{r.vaccine_name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {shortDate(r.vaccination_date)}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-foreground">{shortDate(r.next_due_date)}</p>
                        {diff !== null && !r.is_completed ? (
                          <p className="text-xs text-muted-foreground">
                            {`in ${Math.max(diff, 0)} days`}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={status} />
                      </td>
                      <td className="py-3 pr-0">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit vaccination"
                            onClick={() => {
                              setEditing(r);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <ConfirmDelete
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete vaccination"
                                className="text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            }
                            title="Delete vaccination record?"
                            description={`${r.vaccine_name} for ${r.cows?.name ?? "this cow"} will be removed.`}
                            onConfirm={() => removeMutation.mutate(r.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <VaccinationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={editing}
        cows={cowsQuery.data ?? []}
      />
    </div>
  );
}
