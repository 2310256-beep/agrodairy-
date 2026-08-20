import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CowFormDialog } from "@/components/dairy/cow-form";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  StatusBadge,
} from "@/components/dairy/ui";
import { supabase } from "@/integrations/supabase/client";
import { BREEDS, COW_STATUSES, listCows, listMilkRecords, type Cow } from "@/lib/api";
import { ageFromDob, daysAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cows/")({
  validateSearch: z.object({ q: z.string().optional(), new: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Cows — Agro Dairy Herd Management" },
      {
        name: "description",
        content:
          "Manage every cow on the farm: identification, breed, age, weight, health status and daily milk output.",
      },
      { property: "og:title", content: "Cows — Agro Dairy Herd Management" },
      {
        property: "og:description",
        content: "Search, filter and manage all cow records on your dairy farm.",
      },
    ],
  }),
  component: CowsPage,
});

function CowsPage() {
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState(search.q ?? "");
  const [breed, setBreed] = useState("all");
  const [gender, setGender] = useState("all");
  const [status, setStatus] = useState("all");
  const [age, setAge] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(search.new === "1");
  const [editing, setEditing] = useState<Cow | null>(null);

  const cowsQuery = useQuery({ queryKey: ["cows"], queryFn: listCows });
  const milkQuery = useQuery({
    queryKey: ["milk", "week"],
    queryFn: () => listMilkRecords(daysAgo(6)),
  });

  const dailyByCow = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of milkQuery.data ?? []) {
      map.set(r.cow_id, (map.get(r.cow_id) ?? 0) + Number(r.quantity));
    }
    for (const [k, v] of map) map.set(k, Math.round((v / 7) * 10) / 10);
    return map;
  }, [milkQuery.data]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cows").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Cow deleted", { description: "The record has been removed." });
      await queryClient.invalidateQueries({ queryKey: ["cows"] });
    },
    onError: (err: Error) => toast.error("Could not delete", { description: err.message }),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (cowsQuery.data ?? []).filter((cow) => {
      if (q && !`${cow.cow_id} ${cow.name}`.toLowerCase().includes(q)) return false;
      if (breed !== "all" && cow.breed !== breed) return false;
      if (gender !== "all" && cow.gender !== gender) return false;
      if (status !== "all" && cow.current_status !== status) return false;
      if (age !== "all" && cow.date_of_birth) {
        const years =
          (Date.now() - new Date(cow.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (age === "young" && years >= 2) return false;
        if (age === "prime" && (years < 2 || years > 5)) return false;
        if (age === "mature" && years <= 5) return false;
      }
      return true;
    });
  }, [cowsQuery.data, query, breed, gender, status, age]);

  if (cowsQuery.isError) return <ErrorBlock message="Cow records could not be loaded." />;

  return (
    <div>
      <PageHeader
        title="Cows"
        description="Manage and monitor all cows on your farm."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" /> Add New Cow
          </Button>
        }
      />

      <div className="card-surface mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ID or name"
            className="pl-9"
            maxLength={60}
          />
        </div>
        <Select value={breed} onValueChange={setBreed}>
          <SelectTrigger>
            <SelectValue placeholder="Breed" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All breeds</SelectItem>
            {BREEDS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger>
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All genders</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {COW_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={age} onValueChange={setAge}>
          <SelectTrigger>
            <SelectValue placeholder="Age" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ages</SelectItem>
            <SelectItem value="young">Under 2 years</SelectItem>
            <SelectItem value="prime">2 – 5 years</SelectItem>
            <SelectItem value="mature">Over 5 years</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="card-surface overflow-hidden">
        {cowsQuery.isLoading ? (
          <div className="p-5">
            <LoadingBlock rows={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No cows match your filters"
              description="Try clearing the search or filters, or add a new cow."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cow ID</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Breed</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Milk / day</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cow) => (
                  <TableRow key={cow.id}>
                    <TableCell className="font-semibold">{cow.cow_id}</TableCell>
                    <TableCell>
                      {cow.photo ? (
                        <img
                          src={cow.photo}
                          alt={`Cow ${cow.cow_id}`}
                          className="size-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {cow.name.charAt(0)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{cow.name}</TableCell>
                    <TableCell className="text-muted-foreground">{cow.breed}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ageFromDob(cow.date_of_birth)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {cow.weight ? `${Number(cow.weight)} kg` : "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {dailyByCow.get(cow.id) ? `${dailyByCow.get(cow.id)} L` : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={cow.current_status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" aria-label="View cow">
                          <Link to="/cows/$cowId" params={{ cowId: cow.id }}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit cow"
                          onClick={() => {
                            setEditing(cow);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <ConfirmDelete
                          title={`Delete cow ${cow.cow_id}?`}
                          description="All milk records for this cow will also be removed."
                          onConfirm={() => remove.mutate(cow.id)}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Delete cow">
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

      <p className="mt-3 text-xs text-muted-foreground">
        Showing {filtered.length} of {cowsQuery.data?.length ?? 0} cows.
      </p>

      <CowFormDialog open={dialogOpen} onOpenChange={setDialogOpen} cow={editing} />
    </div>
  );
}
