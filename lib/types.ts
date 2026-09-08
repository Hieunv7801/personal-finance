export type TxType = "Thu" | "Chi";
export type Category = "Ăn uống" | "Cafe/Giải trí" | "Đi lại/Xăng" | "Mua sắm" | "Khác" | "Trọ" | "Phát sinh" | "Trả nợ" | "Lương" | "Thưởng" | "Thu nhập khác";
export type Debt = { id: string; user_id: string; name: string; principal: number; created_at: string };
export type Transaction = { id: string; user_id: string; occurred_on: string; description: string; category: Category; type: TxType; amount: number; note: string | null; debt_id: string | null; created_at: string };
export type Settings = { user_id: string; planned_salary: number; daily_budget: number; rent_budget: number; incidental_budget: number; starting_debt: number; planned_debt_payment: number; savings_goal: number; salary_day: number; plan_start_date: string; initial_savings: number; t13_amount: number; t13_date: string | null };
export type CycleRow = { start: Date; end: Date; income: number; dailySpend: number; rent: number; incidental: number; livingSpend: number; livingBudget: number; budgetRemaining: number; debtPaid: number; totalOut: number; savings: number; cumulative: number; hasData: boolean };
