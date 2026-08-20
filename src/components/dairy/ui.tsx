import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "primary" | "accent" | "destructive" | "muted";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  }[tone];

  return (
    <div className="card-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span className={cn("flex size-9 items-center justify-center rounded-lg", toneClass)}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-surface p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-primary/10 text-primary border-primary/20",
    Available: "bg-primary/10 text-primary border-primary/20",
    Healthy: "bg-primary/10 text-primary border-primary/20",
    Paid: "bg-primary/10 text-primary border-primary/20",
    Completed: "bg-primary/10 text-primary border-primary/20",
    Upcoming: "bg-chart-5/10 text-chart-5 border-chart-5/20",
    "Due Soon": "bg-accent/15 text-accent border-accent/25",
    Pregnant: "bg-chart-5/10 text-chart-5 border-chart-5/20",
    "Low Stock": "bg-accent/15 text-accent border-accent/25",
    "Needs Attention": "bg-accent/15 text-accent border-accent/25",
    Pending: "bg-accent/15 text-accent border-accent/25",
    Medium: "bg-accent/15 text-accent border-accent/25",
    Sick: "bg-destructive/10 text-destructive border-destructive/20",
    "Out of Stock": "bg-destructive/10 text-destructive border-destructive/20",
    "Under Treatment": "bg-destructive/10 text-destructive border-destructive/20",
    High: "bg-destructive/10 text-destructive border-destructive/20",
    Sold: "bg-muted text-muted-foreground border-border",
    Inactive: "bg-muted text-muted-foreground border-border",
    Low: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", map[status] ?? "bg-muted")}>
      {status}
    </Badge>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-12 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ErrorBlock({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {message ?? "Something went wrong while loading this data."}
    </div>
  );
}
