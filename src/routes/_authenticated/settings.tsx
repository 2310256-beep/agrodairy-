import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBlock, LoadingBlock, PageHeader, SectionCard } from "@/components/dairy/ui";
import { supabase } from "@/integrations/supabase/client";
import { getFarm, getProfile } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Agro Dairy" },
      {
        name: "description",
        content: "Update your Agro Dairy farm details and personal profile information.",
      },
      { property: "og:title", content: "Settings — Agro Dairy" },
      {
        property: "og:description",
        content: "Manage farm profile and account details.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const farmQuery = useQuery({ queryKey: ["farm"], queryFn: getFarm });
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getProfile });

  const [farm, setFarm] = useState({
    farm_name: "",
    location: "",
    owner_name: "",
    contact: "",
    email: "",
  });
  const [profile, setProfile] = useState({ name: "", role: "" });

  useEffect(() => {
    const f = farmQuery.data;
    if (f) {
      setFarm({
        farm_name: f.farm_name ?? "",
        location: f.location ?? "",
        owner_name: f.owner_name ?? "",
        contact: f.contact ?? "",
        email: f.email ?? "",
      });
    }
  }, [farmQuery.data]);

  useEffect(() => {
    const p = profileQuery.data;
    if (p) setProfile({ name: p.name ?? "", role: p.role ?? "" });
  }, [profileQuery.data]);

  const saveFarm = useMutation({
    mutationFn: async () => {
      if (!farm.farm_name.trim()) throw new Error("Farm name is required");
      const payload = {
        farm_name: farm.farm_name.trim(),
        location: farm.location.trim() || null,
        owner_name: farm.owner_name.trim() || null,
        contact: farm.contact.trim() || null,
        email: farm.email.trim() || null,
      };
      const existing = farmQuery.data;
      const { error } = existing
        ? await supabase.from("farm").update(payload).eq("id", existing.id)
        : await supabase.from("farm").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Farm details saved");
      await queryClient.invalidateQueries({ queryKey: ["farm"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const id = profileQuery.data?.id;
      if (!id) throw new Error("No profile found");
      if (!profile.name.trim()) throw new Error("Name is required");
      const { error } = await supabase
        .from("profiles")
        .update({ name: profile.name.trim(), role: profile.role.trim() || "Farm Manager" })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast.success("Profile updated");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (farmQuery.isLoading || profileQuery.isLoading) return <LoadingBlock rows={5} />;
  if (farmQuery.isError || profileQuery.isError)
    return <ErrorBlock message="Could not load settings." />;

  return (
    <div>
      <PageHeader title="Settings" description="Farm information and your account profile." />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Farm details" description="Shown across reports and the dashboard.">
          <div className="grid gap-3">
            <div>
              <Label htmlFor="farm-name">Farm name</Label>
              <Input
                id="farm-name"
                value={farm.farm_name}
                maxLength={80}
                onChange={(e) => setFarm({ ...farm, farm_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="farm-location">Location</Label>
              <Input
                id="farm-location"
                value={farm.location}
                maxLength={120}
                onChange={(e) => setFarm({ ...farm, location: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="farm-owner">Owner name</Label>
              <Input
                id="farm-owner"
                value={farm.owner_name}
                maxLength={80}
                onChange={(e) => setFarm({ ...farm, owner_name: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="farm-contact">Contact number</Label>
                <Input
                  id="farm-contact"
                  value={farm.contact}
                  maxLength={30}
                  onChange={(e) => setFarm({ ...farm, contact: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="farm-email">Farm email</Label>
                <Input
                  id="farm-email"
                  type="email"
                  value={farm.email}
                  maxLength={120}
                  onChange={(e) => setFarm({ ...farm, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Button onClick={() => saveFarm.mutate()} disabled={saveFarm.isPending}>
                <Save className="mr-2 size-4" /> Save farm details
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Your profile" description="How your name appears in Agro Dairy.">
          <div className="grid gap-3">
            <div>
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={profile.name}
                maxLength={60}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="profile-role">Role</Label>
              <Input
                id="profile-role"
                value={profile.role}
                maxLength={40}
                onChange={(e) => setProfile({ ...profile, role: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={profileQuery.data?.email ?? ""} disabled />
            </div>
            <div>
              <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                <Save className="mr-2 size-4" /> Save profile
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
