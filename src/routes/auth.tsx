import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Milk, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Agro Dairy Farm Management" },
      {
        name: "description",
        content:
          "Sign in to Agro Dairy to manage cows, milk production, feed inventory and farm finances.",
      },
      { property: "og:title", content: "Sign in — Agro Dairy Farm Management" },
      {
        property: "og:description",
        content: "Secure access to your dairy farm records and daily production data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const destination = search.redirect?.startsWith("/") ? search.redirect : "/dashboard";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "forgot") {
      const parsed = z.string().trim().email().safeParse(email);
      if (!parsed.success) return setError("Enter a valid email address.");
      setLoading(true);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/auth`,
      });
      setLoading(false);
      if (resetError) return setError(resetError.message);
      setSent(true);
      toast.success("Reset link sent", { description: "Check your inbox for the reset email." });
      return;
    }

    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid details.");

    setLoading(true);
    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { name: name.trim() || parsed.data.email.split("@")[0] },
        },
      });
      setLoading(false);
      if (signUpError) return setError(signUpError.message);
      toast.success("Account created", { description: "Welcome to Agro Dairy." });
      navigate({ to: destination });
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (signInError) {
      return setError(
        signInError.message.toLowerCase().includes("invalid")
          ? "Incorrect email or password. Please try again."
          : signInError.message,
      );
    }
    toast.success("Signed in", { description: "Welcome back to Agro Dairy." });
    navigate({ to: destination });
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Milk className="size-5" />
          </span>
          <span className="text-lg font-bold">Agro Dairy</span>
        </div>
        <div className="max-w-sm">
          <h2 className="text-3xl font-bold leading-tight">
            Smart Management for a Better Dairy Farm
          </h2>
          <p className="mt-3 text-sm text-sidebar-foreground/75">
            Keep every cow, every litre of milk, every sack of feed and every taka accounted for —
            from one simple dashboard.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-sidebar-foreground/85">
            <li>• Cow records with health and production history</li>
            <li>• Morning and evening milk tracking</li>
            <li>• Feed inventory with low-stock alerts</li>
            <li>• Income, expense and profit reports in Taka</li>
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/60">
          Agro Dairy Farm · Savar, Dhaka
        </p>
      </section>

      <section className="flex items-center justify-center bg-background px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:text-left">
            <div className="mb-4 flex items-center justify-center gap-2 lg:justify-start">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Milk className="size-5" />
              </span>
              <span className="text-xl font-bold text-foreground">Agro Dairy</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {mode === "login"
                ? "Sign in to your farm"
                : mode === "signup"
                  ? "Create your account"
                  : "Reset your password"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "forgot"
                ? "We'll email you a link to set a new password."
                : "Smart Management for a Better Dairy Farm"}
            </p>
          </div>

          {sent && mode === "forgot" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm text-primary">
                A password reset link has been sent to <strong>{email}</strong>.
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSent(false);
                  setMode("login");
                }}
              >
                Back to login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Md. Rafiqul Islam"
                    maxLength={100}
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@dairyfarm.com"
                  maxLength={255}
                />
              </div>

              {mode !== "forgot" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                      maxLength={72}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              ) : null}

              {mode === "login" ? (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={remember}
                      onCheckedChange={(v) => setRemember(Boolean(v))}
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {mode === "login" ? "Login" : mode === "signup" ? "Create account" : "Send reset link"}
              </Button>


              <p className="text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>
                    New to Agro Dairy?{" "}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => {
                        setMode("signup");
                        setError(null);
                      }}
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                  >
                    Back to login
                  </button>
                )}
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
