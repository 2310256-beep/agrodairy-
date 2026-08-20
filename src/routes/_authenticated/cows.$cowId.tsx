import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Bell, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/dairy/confirm-delete";
import { CowFormDialog } from "@/components/dairy/cow-form";
import { MilkTrendChart } from "@/components/dairy/charts";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/dairy/ui";
import { supabase } from "@/integrations/supabase/client";
import {
  getCow,
  listCowMilk,
  listCowVaccinations,
  listNotifications,
  vaccinationStatus,
} from "@/lib/api";
import { ageFromDob, dayLabel, litres, shortDate, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cows/$cowId")({
  head: () => ({
    meta: [
      { title: "Cow Profile — Agro Dairy" },
      {
        name: "description",
        content:
          "Full profile for a single cow: identification, health status, milk production summary and recent records.",
      },
      { property: "og:title", content: "Cow Profile — Agro Dairy" },
      {
        property: "og:description",
        content: "Identification, health and production history for this cow.",
      },
    ],
  }),
  component: CowProfile,
});

function CowProfile() {
  const { cowId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const cowQuery = useQuery({ queryKey: ["cow", cowId], queryFn: () => getCow(cowId) });
  const milkQuery = useQuery({ queryKey: ["cow-milk", cowId], queryFn: () => listCowMilk(cowId) });
  const notifQuery = useQuery({ queryKey: ["notifications"], queryFn: listNotifications });
  const vaccineQuery = useQuery({
    queryKey: ["cow-vaccinations", cowId],
    queryFn: () => listCowVaccinations(cowId),
  });
  const vaccinations = vaccineQuery.data ?? [];

  const cow = cowQuery.data;
  const records = milkQuery.data ?? [];

  const summary = useMemo(() => {
    const todayStr = today();
    const monthPrefix = todayStr.slice(0, 7);
    const todayMilk = records
      .filter((r) => r.date === todayStr)
      .reduce((s, r) => s + Number(r.quantity), 0);
    const monthly = records
      .filter((r) => r.date.startsWith(monthPrefix))
      .reduce((s, r) => s + Number(r.quantity), 0);
    const days = new Set(records.map((r) => r.date)).size || 1;
    const total = records.reduce((s, r) => s + Number(r.quantity), 0);
    return { todayMilk, monthly, average: total / days };
  }, [records]);

  const trend = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const r of records.slice(0, 60)) {
      byDay.set(r.date, (byDay.get(r.date) ?? 0) + Number(r.quantity));
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, value]) => ({ label: dayLabel(date), litres: Math.round(value * 10) / 10 }));
  }, [records]);

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cows").delete().eq("id", cowId);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Cow deleted");
      await queryClient.invalidateQueries({ queryKey: ["cows"] });
      navigate({ to: "/cows" });
    },
    onError: (err: Error) => toast.error("Could not delete", { description: err.message }),
  });

  if (cowQuery.isLoading) return <LoadingBlock rows={6} />;
  if (cowQuery.isError) return <ErrorBlock message="This cow could not be loaded." />;
  if (!cow)
    return (
      <EmptyState title="Cow not found" description="This record may have been deleted." />
    );

  const relatedAlerts = (notifQuery.data ?? []).filter(
    (n) => n.related_id === cow.id || n.title.includes(cow.cow_id) || n.title.includes(cow.name),
  );

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/cows">
          <ArrowLeft className="mr-1 size-4" /> Back to cows
        </Link>
      </Button>

      <PageHeader
        title={`${cow.cow_id} · ${cow.name}`}
        description={`${cow.breed} · ${cow.gender} · ${ageFromDob(cow.date_of_birth)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 size-4" /> Edit
            </Button>
            <ConfirmDelete
              title={`Delete cow ${cow.cow_id}?`}
              description="All milk records for this cow will also be removed."
              onConfirm={() => remove.mutate()}
              trigger={
                <Button variant="outline" className="text-destructive">
                  <Trash2 className="mr-1 size-4" /> Delete
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Identification" className="lg:col-span-1">
          <div className="flex items-center gap-4">
            {cow.photo ? (
              <img
                src={cow.photo}
                alt={`Cow ${cow.cow_id}`}
                className="size-20 rounded-2xl object-cover"
              />
            ) : (
              <span className="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
                {cow.name.charAt(0)}
              </span>
            )}
            <div className="space-y-1">
              <StatusBadge status={cow.current_status} />
              <StatusBadge status={cow.health_status} />
            </div>
          </div>
          <dl className="mt-5 space-y-2 text-sm">
            {[
              ["Cow ID", cow.cow_id],
              ["Name", cow.name],
              ["Breed", cow.breed],
              ["Gender", cow.gender],
              ["Age", ageFromDob(cow.date_of_birth)],
              ["Date of birth", shortDate(cow.date_of_birth)],
              ["Weight", cow.weight ? `${Number(cow.weight)} kg` : "—"],
              ["Date acquired", shortDate(cow.date_acquired)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-border pb-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          {cow.notes ? (
            <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              {cow.notes}
            </p>
          ) : null}
        </SectionCard>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Today's milk" value={litres(summary.todayMilk)} />
            <StatCard label="Average daily milk" value={litres(summary.average)} />
            <StatCard label="This month" value={litres(summary.monthly, 0)} />
          </div>

          <SectionCard title="Recent production" description="Last 14 recorded days.">
            {trend.length === 0 ? (
              <EmptyState title="No milk records for this cow yet" />
            ) : (
              <MilkTrendChart data={trend} />
            )}
          </SectionCard>

          <SectionCard title="Recent milk records">
            {records.length === 0 ? (
              <EmptyState title="No records" />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {records.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">
                      {shortDate(r.date)} · {r.session}
                    </span>
                    <span className="font-semibold text-foreground">{litres(r.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Vaccinations"
            description="Doses given to this cow and their next due dates."
            actions={
              <Button variant="outline" size="sm" asChild>
                <Link to="/vaccinations">Manage</Link>
              </Button>
            }
          >
            {vaccinations.length === 0 ? (
              <EmptyState
                title="No vaccination records"
                description="Record a vaccination from the Vaccinations page."
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {vaccinations.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{v.vaccine_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Given {shortDate(v.vaccination_date)} · Next due{" "}
                        {shortDate(v.next_due_date)}
                      </p>
                    </div>
                    <StatusBadge status={vaccinationStatus(v)} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Alerts for this cow">
            {relatedAlerts.length === 0 ? (
              <EmptyState title="No alerts" description="This cow has no pending reminders." />
            ) : (
              <ul className="space-y-2">
                {relatedAlerts.map((n) => (
                  <li key={n.id} className="flex gap-3 rounded-lg border border-border p-3">
                    <Bell className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <CowFormDialog open={editOpen} onOpenChange={setEditOpen} cow={cow} />
    </div>
  );
}
