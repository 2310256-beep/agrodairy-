import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
} from "@/components/dairy/ui";
import { supabase } from "@/integrations/supabase/client";
import { NOTIFICATION_TYPES, listNotifications, syncVaccinationNotifications } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Agro Dairy" },
      {
        name: "description",
        content:
          "Review dairy farm alerts for vaccinations, low feed stock, veterinary visits and production changes.",
      },
      { property: "og:title", content: "Notifications — Agro Dairy" },
      {
        property: "og:description",
        content: "All farm alerts and reminders in one place.",
      },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const [type, setType] = useState("all");
  const [state, setState] = useState("all");

  const query = useQuery({ queryKey: ["notifications"], queryFn: listNotifications });

  // Vaccination reminders are generated from the current date, so refresh them
  // whenever the Notification Centre is opened.
  useEffect(() => {
    syncVaccinationNotifications()
      .then((created) => {
        if (created > 0) queryClient.invalidateQueries({ queryKey: ["notifications"] });
      })
      .catch(() => undefined);
  }, [queryClient]);
  const rows = query.data ?? [];

  const filtered = useMemo(
    () =>
      rows.filter((n) => {
        if (type !== "all" && n.type !== type) return false;
        if (state === "unread" && n.is_read) return false;
        if (state === "completed" && !n.is_completed) return false;
        return true;
      }),
    [rows, type, state],
  );

  const unread = rows.filter((n) => !n.is_read).length;

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { is_read?: boolean; is_completed?: boolean } }) => {
      const { error } = await supabase.from("notifications").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("All notifications marked as read");
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Notification deleted");
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (query.isLoading) return <LoadingBlock rows={6} />;
  if (query.isError) return <ErrorBlock message="Could not load notifications." />;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Alerts and reminders across your herd, feed and finances."
        actions={
          <Button variant="outline" onClick={() => markAllRead.mutate()} disabled={unread === 0}>
            <CheckCheck className="mr-2 size-4" /> Mark all read
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total alerts" value={String(rows.length)} icon={<Bell className="size-4" />} />
        <StatCard label="Unread" value={String(unread)} tone="accent" />
      </div>

      <SectionCard
        title="All notifications"
        description={`${filtered.length} shown`}
        className="mt-6"
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {filtered.length ? (
          <ul className="space-y-3">
            {filtered.map((n) => (
              <li
                key={n.id}
                className={`rounded-xl border p-4 ${n.is_read ? "border-border" : "border-primary/30 bg-primary/5"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{n.title}</p>
                      <span className="text-xs text-muted-foreground">{n.type}</span>
                    </div>
                    {n.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{n.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {relativeTime(n.created_at)}
                      {n.is_completed ? " · Completed" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!n.is_read ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => update.mutate({ id: n.id, patch: { is_read: true } })}
                      >
                        <Check className="mr-1 size-4" /> Read
                      </Button>
                    ) : null}
                    {!n.is_completed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          update.mutate({ id: n.id, patch: { is_completed: true, is_read: true } })
                        }
                      >
                        Complete
                      </Button>
                    ) : null}
                    <ConfirmDelete
                      title="Delete notification?"
                      onConfirm={() => remove.mutate(n.id)}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Delete notification">
                          <Trash2 className="size-4" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing here" description="No notifications match these filters." />
        )}
      </SectionCard>
    </div>
  );
}
