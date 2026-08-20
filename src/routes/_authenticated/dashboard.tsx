import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Boxes,
  Coins,
  Leaf,
  Milk,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GroupedBarChart, MilkTrendChart } from "@/components/dairy/charts";
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
  listCows,
  listExpenses,
  listFeed,
  listIncome,
  listMilkRecords,
  listNotifications,
  stockStatus,
} from "@/lib/api";
import { dayLabel, daysAgo, money, relativeTime, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Farm Dashboard — Agro Dairy" },
      {
        name: "description",
        content:
          "Daily overview of milk production, herd status, feed stock and farm profit for your dairy farm.",
      },
      { property: "og:title", content: "Farm Dashboard — Agro Dairy" },
      {
        property: "og:description",
        content: "Milk production, herd status, feed stock and monthly profit at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

const QUICK_ACTIONS = [
  { to: "/cows", label: "Add Cow", search: { new: "1" } },
  { to: "/milk", label: "Record Milk", search: { new: "1" } },
  { to: "/feed", label: "Add Feed", search: { new: "feed" } },
  { to: "/feed", label: "Record Feed Usage", search: { new: "usage" } },
  { to: "/finance", label: "Add Income", search: { new: "income" } },
  { to: "/finance", label: "Add Expense", search: { new: "expense" } },
] as const;

function Dashboard() {
  const [range, setRange] = useState<7 | 30>(7);

  const cowsQuery = useQuery({ queryKey: ["cows"], queryFn: listCows });
  const milkQuery = useQuery({
    queryKey: ["milk", "dashboard"],
    queryFn: () => listMilkRecords(daysAgo(30)),
  });
  const feedQuery = useQuery({ queryKey: ["feed"], queryFn: listFeed });
  const incomeQuery = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQuery = useQuery({ queryKey: ["expenses"], queryFn: listExpenses });
  const notifQuery = useQuery({ queryKey: ["notifications"], queryFn: listNotifications });

  const cows = cowsQuery.data ?? [];
  const milk = milkQuery.data ?? [];
  const feed = feedQuery.data ?? [];
  const income = incomeQuery.data ?? [];
  const expenses = expenseQuery.data ?? [];

  const monthPrefix = today().slice(0, 7);

  const stats = useMemo(() => {
    const todayStr = today();
    const todayMilk = milk
      .filter((m) => m.date === todayStr)
      .reduce((sum, m) => sum + Number(m.quantity), 0);
    const monthlyIncome = income
      .filter((i) => i.date.startsWith(monthPrefix))
      .reduce((s, i) => s + Number(i.amount), 0);
    const monthlyExpense = expenses
      .filter((e) => e.date.startsWith(monthPrefix))
      .reduce((s, e) => s + Number(e.amount), 0);
    const lowStock = feed.filter((f) => stockStatus(f) !== "Available").length;
    return {
      totalCows: cows.length,
      todayMilk,
      monthlyIncome,
      monthlyExpense,
      profit: monthlyIncome - monthlyExpense,
      lowStock,
    };
  }, [cows, milk, income, expenses, feed, monthPrefix]);

  const trend = useMemo(() => {
    const byDay = new Map<string, number>();
    for (let i = range - 1; i >= 0; i -= 1) byDay.set(daysAgo(i), 0);
    for (const record of milk) {
      if (byDay.has(record.date)) {
        byDay.set(record.date, (byDay.get(record.date) ?? 0) + Number(record.quantity));
      }
    }
    return [...byDay.entries()].map(([date, value]) => ({
      label: dayLabel(date),
      litres: Math.round(value * 10) / 10,
    }));
  }, [milk, range]);

  const financeChart = useMemo(() => {
    const months = new Map<string, { income: number; expense: number }>();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.set(d.toISOString().slice(0, 7), { income: 0, expense: 0 });
    }
    for (const i of income) {
      const key = i.date.slice(0, 7);
      const entry = months.get(key);
      if (entry) entry.income += Number(i.amount);
    }
    for (const e of expenses) {
      const key = e.date.slice(0, 7);
      const entry = months.get(key);
      if (entry) entry.expense += Number(e.amount);
    }
    return [...months.entries()].map(([key, v]) => ({
      label: new Date(`${key}-01`).toLocaleDateString("en-GB", { month: "short" }),
      income: Math.round(v.income),
      expense: Math.round(v.expense),
    }));
  }, [income, expenses]);

  const topCows = useMemo(() => {
    const totals = new Map<string, { name: string; cowId: string; litres: number }>();
    const since = daysAgo(6);
    for (const record of milk) {
      if (record.date < since || !record.cows) continue;
      const key = record.cow_id;
      const current = totals.get(key) ?? {
        name: record.cows.name,
        cowId: record.cows.cow_id,
        litres: 0,
      };
      current.litres += Number(record.quantity);
      totals.set(key, current);
    }
    return [...totals.values()]
      .sort((a, b) => b.litres - a.litres)
      .slice(0, 5)
      .map((c) => ({ ...c, litres: Math.round((c.litres / 7) * 10) / 10 }));
  }, [milk]);

  const loading =
    cowsQuery.isLoading || milkQuery.isLoading || feedQuery.isLoading || incomeQuery.isLoading;
  const failed = cowsQuery.isError || milkQuery.isError || feedQuery.isError;

  if (failed) return <ErrorBlock message="Farm data could not be loaded. Please refresh." />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A live overview of your herd, production, feed and farm finances."
      />

      {loading ? (
        <LoadingBlock rows={6} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Total Cows"
              value={String(stats.totalCows)}
              hint={`${cows.filter((c) => c.current_status === "Active").length} active`}
              icon={<Leaf className="size-4" />}
            />
            <StatCard
              label="Today's Milk Production"
              value={`${Math.round(stats.todayMilk)} L`}
              hint="Morning + evening sessions"
              icon={<Milk className="size-4" />}
            />
            <StatCard
              label="Monthly Income"
              value={money(stats.monthlyIncome)}
              hint="Current month"
              icon={<TrendingUp className="size-4" />}
            />
            <StatCard
              label="Monthly Expenses"
              value={money(stats.monthlyExpense)}
              hint="Current month"
              tone="accent"
              icon={<TrendingDown className="size-4" />}
            />
            <StatCard
              label="Net Profit"
              value={money(stats.profit)}
              hint="Income − expenses"
              tone={stats.profit >= 0 ? "primary" : "destructive"}
              icon={<Coins className="size-4" />}
            />
            <StatCard
              label="Low Stock Items"
              value={String(stats.lowStock)}
              hint="Feed items at or below minimum"
              tone="destructive"
              icon={<AlertTriangle className="size-4" />}
            />
          </div>

          <SectionCard
            className="mt-6"
            title="Milk production"
            description="Calculated from saved milk records."
            actions={
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                {([7, 30] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {r} days
                  </button>
                ))}
              </div>
            }
          >
            <MilkTrendChart data={trend} />
          </SectionCard>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <SectionCard title="Income vs Expense" description="Last six months, in Taka.">
              <GroupedBarChart
                data={financeChart}
                keys={[
                  { key: "income", label: "Income" },
                  { key: "expense", label: "Expense" },
                ]}
                colors={["var(--chart-1)", "var(--chart-2)"]}
              />
            </SectionCard>

            <SectionCard title="Cow overview" description="Herd status and top producers.">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total", value: cows.length },
                  {
                    label: "Active",
                    value: cows.filter((c) => c.current_status === "Active").length,
                  },
                  {
                    label: "Need attention",
                    value: cows.filter(
                      (c) => c.health_status !== "Healthy" || c.current_status === "Sick",
                    ).length,
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-muted/60 p-3 text-center">
                    <p className="text-xl font-bold text-foreground">{item.value}</p>
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Top milk producers (7-day average)
                </p>
                {topCows.length === 0 ? (
                  <EmptyState title="No milk records yet" />
                ) : (
                  topCows.map((cow) => (
                    <div
                      key={cow.cowId}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {cow.cowId} · {cow.name}
                      </span>
                      <span className="text-sm font-semibold text-primary">{cow.litres} L/day</span>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Feed stock"
              description="Current quantity against minimum stock level."
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link to="/feed">View all</Link>
                </Button>
              }
            >
              <div className="space-y-3">
                {feed.slice(0, 5).map((item) => {
                  const status = stockStatus(item);
                  const pct = item.minimum_stock
                    ? Math.min(100, (Number(item.quantity) / (Number(item.minimum_stock) * 2)) * 100)
                    : 100;
                  return (
                    <div key={item.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {item.feed_name}
                        </span>
                        <StatusBadge status={status} />
                      </div>
                      <Progress value={pct} className="mt-2 h-2" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Number(item.quantity)} {item.unit} in stock · minimum{" "}
                        {Number(item.minimum_stock)} {item.unit}
                      </p>
                    </div>
                  );
                })}
                {feed.length === 0 ? <EmptyState title="No feed items yet" /> : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Recent notifications"
              description="Latest alerts from across the farm."
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link to="/notifications">View all</Link>
                </Button>
              }
            >
              <div className="space-y-3">
                {(notifQuery.data ?? []).slice(0, 5).map((n) => (
                  <div key={n.id} className="flex gap-3 rounded-lg border border-border p-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bell className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(n.created_at)} · {n.type}
                      </p>
                    </div>
                  </div>
                ))}
                {(notifQuery.data ?? []).length === 0 ? (
                  <EmptyState title="No notifications" />
                ) : null}
              </div>
            </SectionCard>
          </div>

          <SectionCard className="mt-6" title="Quick actions">
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => (
                <Button key={action.label} asChild variant="outline" size="sm">
                  <Link to={action.to} search={action.search}>
                    <Plus className="mr-1 size-4" />
                    {action.label}
                  </Link>
                </Button>
              ))}
            </div>
          </SectionCard>

          <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <Boxes className="size-3.5" /> All figures are calculated live from your saved records.
          </p>
        </>
      )}
    </div>
  );
}
