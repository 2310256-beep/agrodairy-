import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Leaf, Milk, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agro Dairy — Smart Dairy Farm Management System" },
      {
        name: "description",
        content:
          "Agro Dairy is a complete dairy farm management system for cow records, milk production, feed inventory, alerts and farm finances in Taka.",
      },
      { property: "og:title", content: "Agro Dairy — Smart Dairy Farm Management System" },
      {
        property: "og:description",
        content:
          "Manage cows, milk production, feed stock, alerts and farm finances from one clean dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Leaf, title: "Cow records", text: "Breed, age, weight, health and production history for every cow." },
  { icon: Milk, title: "Milk tracking", text: "Morning and evening yields with automatic daily totals." },
  { icon: Boxes, title: "Feed inventory", text: "Stock levels, daily usage and low-stock warnings." },
  { icon: Wallet, title: "Farm finances", text: "Income, expenses and net profit in Bangladeshi Taka." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Milk className="size-5" />
          </span>
          <span className="text-lg font-bold text-foreground">Agro Dairy</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <section className="py-14 text-center sm:py-20">
          <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            Smart Management for a Better Dairy Farm
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
            Run your dairy farm with clear numbers, not guesswork
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Agro Dairy brings cows, daily milk production, feed stock and farm finances together in
            one simple system built for small and medium dairy farms.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Open the dashboard</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Create an account</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <article key={f.title} className="card-surface p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-foreground">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
