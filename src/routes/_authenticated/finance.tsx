import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/dairy/confirm-delete";
import { CategoryPieChart } from "@/components/dairy/charts";
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
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  listExpenses,
  listIncome,
} from "@/lib/api";
import { money, shortDate, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Agro Dairy" },
      {
        name: "description",
        content:
          "Record dairy farm income and expenses, review category breakdowns and monitor monthly profit or loss.",
      },
      { property: "og:title", content: "Finance — Agro Dairy" },
      {
        property: "og:description",
        content: "Income, expenses and profit tracking for your dairy farm.",
      },
    ],
  }),
  component: FinancePage,
});

const PAYMENT_STATUSES = ["Paid", "Pending"] as const;

const incomeSchema = z.object({
  date: z.string().min(1, "Date is required"),
  category: z.string().min(1),
  customer: z.string().trim().max(80),
  amount: z.string().refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  milk_quantity: z.string(),
  payment_status: z.string().min(1),
  notes: z.string().trim().max(300),
});

const expenseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  category: z.string().min(1),
  supplier: z.string().trim().max(80),
  amount: z.string().refine((v) => Number(v) > 0, "Amount must be greater than 0"),
  description: z.string().trim().max(200),
  payment_status: z.string().min(1),
  notes: z.string().trim().max(300),
});

function emptyIncome() {
  return {
    date: today(),
    category: "Milk Sales",
    customer: "",
    amount: "",
    milk_quantity: "",
    payment_status: "Paid",
    notes: "",
  };
}

function emptyExpense() {
  return {
    date: today(),
    category: "Feed",
    supplier: "",
    amount: "",
    description: "",
    payment_status: "Paid",
    notes: "",
  };
}

function FinancePage() {
  const queryClient = useQueryClient();
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeForm, setIncomeForm] = useState(emptyIncome());
  const [expenseForm, setExpenseForm] = useState(emptyExpense());
  const [error, setError] = useState<string | null>(null);

  const incomeQuery = useQuery({ queryKey: ["income"], queryFn: listIncome });
  const expenseQuery = useQuery({ queryKey: ["expenses"], queryFn: listExpenses });

  const income = incomeQuery.data ?? [];
  const expenses = expenseQuery.data ?? [];

  const stats = useMemo(() => {
    const month = today().slice(0, 7);
    const monthIncome = income
      .filter((r) => r.date.startsWith(month))
      .reduce((s, r) => s + Number(r.amount), 0);
    const monthExpense = expenses
      .filter((r) => r.date.startsWith(month))
      .reduce((s, r) => s + Number(r.amount), 0);
    const byCategory = new Map<string, number>();
    for (const e of expenses.filter((r) => r.date.startsWith(month))) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
    }
    return {
      monthIncome,
      monthExpense,
      profit: monthIncome - monthExpense,
      pie: [...byCategory.entries()].map(([label, value]) => ({ label, value })),
    };
  }, [income, expenses]);

  const saveIncome = useMutation({
    mutationFn: async () => {
      const parsed = incomeSchema.safeParse(incomeForm);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid income");
      const v = parsed.data;
      const qty = v.milk_quantity ? Number(v.milk_quantity) : null;
      const amount = Number(v.amount);
      const { error: err } = await supabase.from("income").insert({
        date: v.date,
        category: v.category,
        customer: v.customer || null,
        source: v.category,
        milk_quantity: qty,
        price_per_litre: qty && qty > 0 ? Number((amount / qty).toFixed(2)) : null,
        amount,
        payment_status: v.payment_status,
        notes: v.notes || null,
      });
      if (err) throw new Error(err.message);
    },
    onSuccess: async () => {
      toast.success("Income recorded");
      await queryClient.invalidateQueries({ queryKey: ["income"] });
      setIncomeOpen(false);
      setIncomeForm(emptyIncome());
    },
    onError: (err: Error) => setError(err.message),
  });

  const saveExpense = useMutation({
    mutationFn: async () => {
      const parsed = expenseSchema.safeParse(expenseForm);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid expense");
      const v = parsed.data;
      const { error: err } = await supabase.from("expenses").insert({
        date: v.date,
        category: v.category,
        supplier: v.supplier || null,
        amount: Number(v.amount),
        description: v.description || null,
        payment_status: v.payment_status,
        notes: v.notes || null,
      });
      if (err) throw new Error(err.message);
    },
    onSuccess: async () => {
      toast.success("Expense recorded");
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setExpenseOpen(false);
      setExpenseForm(emptyExpense());
    },
    onError: (err: Error) => setError(err.message),
  });

  const removeRow = useMutation({
    mutationFn: async ({ table, id }: { table: "income" | "expenses"; id: string }) => {
      const { error: err } = await supabase.from(table).delete().eq("id", id);
      if (err) throw new Error(err.message);
      return table;
    },
    onSuccess: async (table) => {
      toast.success("Record deleted");
      await queryClient.invalidateQueries({ queryKey: [table] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (incomeQuery.isLoading || expenseQuery.isLoading) return <LoadingBlock rows={6} />;
  if (incomeQuery.isError || expenseQuery.isError)
    return <ErrorBlock message="Could not load financial records." />;

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Income, expenses and monthly profit for your farm."
        actions={
          <>
            <Button
              onClick={() => {
                setError(null);
                setIncomeForm(emptyIncome());
                setIncomeOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" /> Add income
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                setExpenseForm(emptyExpense());
                setExpenseOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" /> Add expense
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Income this month"
          value={money(stats.monthIncome)}
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Expenses this month"
          value={money(stats.monthExpense)}
          tone="destructive"
          icon={<TrendingDown className="size-4" />}
        />
        <StatCard
          label="Net profit"
          value={money(stats.profit)}
          tone={stats.profit >= 0 ? "primary" : "destructive"}
          hint={stats.profit >= 0 ? "Profitable month" : "Spending exceeds income"}
          icon={<Wallet className="size-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="Expense breakdown"
          description="Current month by category"
          className="xl:col-span-1"
        >
          {stats.pie.length ? (
            <CategoryPieChart data={stats.pie} />
          ) : (
            <EmptyState title="No expenses this month" />
          )}
        </SectionCard>

        <SectionCard title="Records" description="Latest income and expenses" className="xl:col-span-2">
          <Tabs defaultValue="income">
            <TabsList>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
            </TabsList>

            <TabsContent value="income" className="mt-4">
              {income.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Litres</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {income.slice(0, 50).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{shortDate(r.date)}</TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.customer ?? "—"}</TableCell>
                          <TableCell>{r.milk_quantity ?? "—"}</TableCell>
                          <TableCell className="font-semibold">{money(Number(r.amount))}</TableCell>
                          <TableCell>
                            <StatusBadge status={r.payment_status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <ConfirmDelete
                              title="Delete income record?"
                              onConfirm={() => removeRow.mutate({ table: "income", id: r.id })}
                              trigger={
                                <Button variant="ghost" size="icon" aria-label="Delete income">
                                  <Trash2 className="size-4" />
                                </Button>
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState title="No income yet" description="Record your first milk sale." />
              )}
            </TabsContent>

            <TabsContent value="expenses" className="mt-4">
              {expenses.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.slice(0, 50).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{shortDate(r.date)}</TableCell>
                          <TableCell>{r.category}</TableCell>
                          <TableCell>{r.supplier ?? "—"}</TableCell>
                          <TableCell className="max-w-48 truncate">{r.description ?? "—"}</TableCell>
                          <TableCell className="font-semibold">{money(Number(r.amount))}</TableCell>
                          <TableCell>
                            <StatusBadge status={r.payment_status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <ConfirmDelete
                              title="Delete expense record?"
                              onConfirm={() => removeRow.mutate({ table: "expenses", id: r.id })}
                              trigger={
                                <Button variant="ghost" size="icon" aria-label="Delete expense">
                                  <Trash2 className="size-4" />
                                </Button>
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState title="No expenses yet" description="Record your first farm expense." />
              )}
            </TabsContent>
          </Tabs>
        </SectionCard>
      </div>

      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add income</DialogTitle>
            <DialogDescription>Milk sales and other farm earnings.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="inc-date">Date</Label>
              <Input
                id="inc-date"
                type="date"
                value={incomeForm.date}
                onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={incomeForm.category}
                onValueChange={(v) => setIncomeForm({ ...incomeForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="inc-customer">Customer</Label>
              <Input
                id="inc-customer"
                value={incomeForm.customer}
                onChange={(e) => setIncomeForm({ ...incomeForm, customer: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="inc-qty">Milk quantity (litres)</Label>
              <Input
                id="inc-qty"
                type="number"
                min="0"
                step="0.1"
                value={incomeForm.milk_quantity}
                onChange={(e) => setIncomeForm({ ...incomeForm, milk_quantity: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="inc-amount">Amount</Label>
              <Input
                id="inc-amount"
                type="number"
                min="0"
                step="0.01"
                value={incomeForm.amount}
                onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Payment status</Label>
              <Select
                value={incomeForm.payment_status}
                onValueChange={(v) => setIncomeForm({ ...incomeForm, payment_status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="inc-notes">Notes</Label>
              <Input
                id="inc-notes"
                value={incomeForm.notes}
                onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncomeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveIncome.mutate()} disabled={saveIncome.isPending}>
              Save income
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
            <DialogDescription>Feed, medicine, salaries and other costs.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="exp-date">Date</Label>
              <Input
                id="exp-date"
                type="date"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={expenseForm.category}
                onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="exp-supplier">Supplier</Label>
              <Input
                id="exp-supplier"
                value={expenseForm.supplier}
                onChange={(e) => setExpenseForm({ ...expenseForm, supplier: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="exp-amount">Amount</Label>
              <Input
                id="exp-amount"
                type="number"
                min="0"
                step="0.01"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>Payment status</Label>
              <Select
                value={expenseForm.payment_status}
                onValueChange={(v) => setExpenseForm({ ...expenseForm, payment_status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="exp-desc">Description</Label>
              <Input
                id="exp-desc"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveExpense.mutate()} disabled={saveExpense.isPending}>
              Save expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
