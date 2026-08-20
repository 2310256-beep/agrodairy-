import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { BREEDS, COW_STATUSES, HEALTH_STATUSES, type Cow } from "@/lib/api";

const schema = z.object({
  cow_id: z.string().trim().min(1, "Cow ID is required").max(20),
  name: z.string().trim().min(1, "Name is required").max(60),
  breed: z.string().min(1),
  date_of_birth: z.string().max(10).optional(),
  gender: z.string().min(1),
  weight: z.string().max(6).optional(),
  date_acquired: z.string().max(10).optional(),
  health_status: z.string().min(1),
  current_status: z.string().min(1),
  photo: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
});

function emptyForm() {
  return {
    cow_id: "",
    name: "",
    breed: "Munshiganj Cattle",
    date_of_birth: "",
    gender: "Female",
    weight: "",
    date_acquired: "",
    health_status: "Healthy",
    current_status: "Active",
    photo: "",
    notes: "",
  };
}

export function CowFormDialog({
  open,
  onOpenChange,
  cow,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cow?: Cow | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      cow
        ? {
            cow_id: cow.cow_id,
            name: cow.name,
            breed: cow.breed,
            date_of_birth: cow.date_of_birth ?? "",
            gender: cow.gender,
            weight: cow.weight ? String(cow.weight) : "",
            date_acquired: cow.date_acquired ?? "",
            health_status: cow.health_status,
            current_status: cow.current_status,
            photo: cow.photo ?? "",
            notes: cow.notes ?? "",
          }
        : emptyForm(),
    );
  }, [open, cow]);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid details");
      const values = parsed.data;
      const payload = {
        cow_id: values.cow_id,
        name: values.name,
        breed: values.breed,
        date_of_birth: values.date_of_birth || null,
        gender: values.gender,
        weight: values.weight ? Number(values.weight) : null,
        date_acquired: values.date_acquired || null,
        health_status: values.health_status,
        current_status: values.current_status,
        photo: values.photo || null,
        notes: values.notes || null,
      };
      const result = cow
        ? await supabase.from("cows").update(payload).eq("id", cow.id)
        : await supabase.from("cows").insert(payload);
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: async () => {
      toast.success(cow ? "Cow updated" : "Cow added", {
        description: `${form.cow_id} · ${form.name} saved successfully.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["cows"] });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cow ? "Edit cow" : "Add new cow"}</DialogTitle>
          <DialogDescription>
            Record identification, health and status details for this animal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cow_id">Cow ID</Label>
            <Input
              id="cow_id"
              value={form.cow_id}
              onChange={(e) => setForm({ ...form, cow_id: e.target.value })}
              placeholder="C-046"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Lakshmi"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Breed</Label>
            <Select value={form.breed} onValueChange={(v) => setForm({ ...form, breed: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BREEDS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dob">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              placeholder="420"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acquired">Date acquired</Label>
            <Input
              id="acquired"
              type="date"
              value={form.date_acquired}
              onChange={(e) => setForm({ ...form, date_acquired: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Health status</Label>
            <Select
              value={form.health_status}
              onValueChange={(v) => setForm({ ...form, health_status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEALTH_STATUSES.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Current status</Label>
            <Select
              value={form.current_status}
              onValueChange={(v) => setForm({ ...form, current_status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COW_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="photo">Photo URL</Label>
            <Input
              id="photo"
              value={form.photo}
              onChange={(e) => setForm({ ...form, photo: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
            {cow ? "Save changes" : "Add cow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
