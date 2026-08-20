import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2, Utensils } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import {
  FEED_TYPES,
  listFeed,
  listFeedUsage,
  stockStatus,
  type FeedItem,
} from "@/lib/api";
import { money, shortDate, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Feed Management — Agro Dairy" },
      {
        name: "description",
        content:
          "Track feed inventory, record daily feed usage and get automatic low-stock alerts for your dairy farm.",
      },
      { property: "og:title", content: "Feed Management — Agro Dairy" },
      {
        property: "og:description",
        content: "Inventory levels, feed usage history and low-stock warnings.",
      },
    ],
  }),
  component: FeedPage,
});

const itemSchema = z.object({
  feed_name: z.string().trim().min(1, "Feed name is required").max(60),
  feed_type: z.string().min(1),
  quantity: z.string().refine((v) => Number(v) >= 0, "Quantity must be 0 or more"),
  unit: z.string().trim().min(1).max(10),
  minimum_stock: z.string().refine((v) => Number(v) >= 0, "Minimum stock must be 0 or more"),
  cost: z.string().refine((v) => Number(v) >= 0, "Cost must be 0 or more"),
  supplier: z.string().trim().max(80).optional(),
  purchase_date: z.string().max(10).optional(),
});

const usageSchema = z.object({
  feed_id: z.string().uuid("Select a feed item"),
  date: z.string().min(1),
  quantity_used: z.string().refine((v) => Number(v) > 0, "Quantity used must be greater than 0"),
  notes: z.string().trim().max(300).optional(),
});

function emptyItem() {
  return {
    feed_name: "",
    feed_type: "Hay",
    quantity: "",
    unit: "kg",
    minimum_stock: "",
    cost: "",
    supplier: "",
    purchase_date: today(),
  };
}

function FeedPage() {
  const queryClient = useQueryClient();
  const [itemOpen, setItemOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [editing, setEditing] = useState<FeedItem | null>(null);
  const [item, setItem] = useState(emptyItem());
  const [usage, setUsage] = useState({
    feed_id: "",
    date: today(),
    quantity_used: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const feedQuery = useQuery({ queryKey: ["feed"], queryFn: listFeed });
  const usageQuery = useQuery({ queryKey: ["feed-usage"], queryFn: listFeedUsage });

  const items = feedQuery.data ?? [];

  const stats = useMemo(() => {
    const value = items.reduce(
      (s, i) => s + Number(i.quantity) * Number(i.cost ?? 0),
      0,
    );
    const low = items.filter((i) => stockStatus(i) !== "Available");
    const monthUsage = (usageQuery.data ?? []).filter((u) =>
      u.date.startsWith(today().slice(0, 7)),
    );
    return { value, low, monthUsageCount: monthUsage.length };
  }, [items, usageQuery.data]);

  const saveItem = useMutation({
    mutationFn: async () => {
      const parsed = itemSchema.safeParse(item);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid feed item");
      const v = parsed.data;
      const payload = {
        feed_name: v.feed_name,
        feed_type: v.feed_type,
        quantity: Number(v.quantity),
        unit: v.unit,
        minimum_stock: Number(v.minimum_stock),
        cost: Number(v.cost),
        supplier: v.supplier || null,
        purchase_date: v.purchase_date || null,
      };
      const result = editing
        ? await supabase.from("feed_inventory").update(payload).eq("id", editing.id)
        : await supabase.from("feed_inventory").insert(payload);
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: async () => {
      toast.success(editing ? "Feed item updated" : "Feed item added");
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      setItemOpen(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveUsage = useMutation({
    mutationFn: async () => {
      const parsed = usageSchema.safeParse(usage);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid usage");
      const v = parsed.data;
      const feedItem = items.find((i) => i.id === v.feed_id);
      if (feedItem && Number(v.quantity_used) > Number(feedItem.quantity)) {
        throw new Error(
          `Only ${Number(feedItem.quantity)} ${feedItem.unit} of ${feedItem.feed_name} in stock.`,
        );
      }
      const { error: e } = await supabase.from("feed_usage").insert({
        feed_id: v.feed_id,
        date: v.date,
        quantity_used: Number(v.quantity_used),
        notes: v.notes || null,
      });
      if (e) throw new Error(e.message);
    },
    onSuccess: async () => {
      toast.success("Feed usage recorded", { description: "Stock levels have been updated." });
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      await queryClient.invalidateQueries({ queryKey: ["feed-usage"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setUsageOpen(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error: e } = await supabase.from("feed_inventory").delete().eq("id", id);
      if (e) throw new Error(e.message);
    },
    onSuccess: async () => {
      toast.success("Feed item deleted");
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (err: Error) => toast.error("Could not delete", { description: err.message }),
  });

  if (feedQuery.isError) return <ErrorBlock message="Feed inventory could not be loaded." />;

  return (
    <div>
      <PageHeader
        title="Feed Management"
        description="Monitor inventory levels, record usage and stay ahead of shortages."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                setUsage({ feed_id: "", date: today(), quantity_used: "", notes: "" });
                setUsageOpen(true);
              }}
            >
              <Utensils className="mr-1 size-4" /> Record Usage
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setError(null);
                setItem(emptyItem());
                setItemOpen(true);
              }}
            >
              <Plus className="mr-1 size-4" /> Add Feed Item
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Feed items" value={String(items.length)} />
        <StatCard label="Inventory value" value={money(stats.value)} />
        <StatCard
          label="Low / out of stock"
          value={String(stats.low.length)}
          tone="destructive"
          icon={<AlertTriangle className="size-4" />}
        />
        <StatCard label="Usage entries this month" value={String(stats.monthUsageCount)} />
      </div>

      {stats.low.length > 0 ? (
        <div className="mb-6 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="size-4 text-accent" /> Low stock warning
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.low
              .map((i) => `${i.feed_name} (${Number(i.quantity)} ${i.unit})`)
              .join(", ")}{" "}
            — consider restocking soon.
          </p>
        </div>
      ) : null}

      <SectionCard title="Inventory" className="mb-6">
        {feedQuery.isLoading ? (
          <LoadingBlock rows={5} />
        ) : items.length === 0 ? (
          <EmptyState title="No feed items yet" description="Add your first feed item to begin." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feed</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>In stock</TableHead>
                  <TableHead>Minimum</TableHead>
                  <TableHead>Cost / unit</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.feed_name}</TableCell>
                    <TableCell className="text-muted-foreground">{i.feed_type}</TableCell>
                    <TableCell className="font-semibold">
                      {Number(i.quantity)} {i.unit}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {Number(i.minimum_stock)} {i.unit}
                    </TableCell>
                    <TableCell>{money(Number(i.cost ?? 0))}</TableCell>
                    <TableCell className="text-muted-foreground">{i.supplier ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={stockStatus(i)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit feed item"
                          onClick={() => {
                            setEditing(i);
                            setError(null);
                            setItem({
                              feed_name: i.feed_name,
                              feed_type: i.feed_type,
                              quantity: String(Number(i.quantity)),
                              unit: i.unit,
                              minimum_stock: String(Number(i.minimum_stock)),
                              cost: String(Number(i.cost ?? 0)),
                              supplier: i.supplier ?? "",
                              purchase_date: i.purchase_date ?? "",
                            });
                            setItemOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <ConfirmDelete
                          title={`Delete ${i.feed_name}?`}
                          description="Usage history for this feed item will also be removed."
                          onConfirm={() => removeItem.mutate(i.id)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Delete feed item">
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
      </SectionCard>

      <SectionCard title="Recent feed usage" description="Stock is deducted automatically.">
        {usageQuery.isLoading ? (
          <LoadingBlock rows={4} />
        ) : (usageQuery.data ?? []).length === 0 ? (
          <EmptyState title="No usage recorded yet" />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(usageQuery.data ?? []).slice(0, 12).map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium text-foreground">
                  {u.feed_inventory?.feed_name ?? "Feed"}
                </span>
                <span className="text-muted-foreground">{shortDate(u.date)}</span>
                <span className="font-semibold text-foreground">
                  {Number(u.quantity_used)} {u.feed_inventory?.unit ?? ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit feed item" : "Add feed item"}</DialogTitle>
            <DialogDescription>
              Set stock levels and costs so low-stock alerts stay accurate.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="feed-name">Feed name</Label>
              <Input
                id="feed-name"
                value={item.feed_name}
                onChange={(e) => setItem({ ...item, feed_name: e.target.value })}
                placeholder="Napier Grass"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Feed type</Label>
              <Select
                value={item.feed_type}
                onValueChange={(v) => setItem({ ...item, feed_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEED_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feed-qty">Quantity in stock</Label>
              <Input
                id="feed-qty"
                type="number"
                value={item.quantity}
                onChange={(e) => setItem({ ...item, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feed-unit">Unit</Label>
              <Input
                id="feed-unit"
                value={item.unit}
                onChange={(e) => setItem({ ...item, unit: e.target.value })}
                placeholder="kg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feed-min">Minimum stock</Label>
              <Input
                id="feed-min"
                type="number"
                value={item.minimum_stock}
                onChange={(e) => setItem({ ...item, minimum_stock: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feed-cost">Cost per unit</Label>
              <Input
                id="feed-cost"
                type="number"
                value={item.cost}
                onChange={(e) => setItem({ ...item, cost: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feed-supplier">Supplier</Label>
              <Input
                id="feed-supplier"
                value={item.supplier}
                onChange={(e) => setItem({ ...item, supplier: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feed-date">Purchase date</Label>
              <Input
                id="feed-date"
                type="date"
                value={item.purchase_date}
                onChange={(e) => setItem({ ...item, purchase_date: e.target.value })}
              />
            </div>
          </div>
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveItem.mutate()} disabled={saveItem.isPending}>
              {editing ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={usageOpen} onOpenChange={setUsageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record feed usage</DialogTitle>
            <DialogDescription>
              Stock is deducted automatically and alerts trigger when levels run low.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Feed item</Label>
              <Select
                value={usage.feed_id}
                onValueChange={(v) => setUsage({ ...usage, feed_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select feed" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.feed_name} ({Number(i.quantity)} {i.unit} left)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usage-date">Date</Label>
              <Input
                id="usage-date"
                type="date"
                value={usage.date}
                onChange={(e) => setUsage({ ...usage, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usage-qty">Quantity used</Label>
              <Input
                id="usage-qty"
                type="number"
                step="0.1"
                value={usage.quantity_used}
                onChange={(e) => setUsage({ ...usage, quantity_used: e.target.value })}
              />
            </div>
          </div>
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUsageOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveUsage.mutate()} disabled={saveUsage.isPending}>
              Record usage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
