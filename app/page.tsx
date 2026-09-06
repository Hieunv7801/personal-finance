"use client";

import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, ArrowDownToLine, Banknote, CircleDollarSign, Clock3, Coffee, Fuel, Gift, HomeIcon, House, Landmark, LayoutDashboard, MoreHorizontal, Plus, SettingsIcon, ShoppingBag, Utensils } from "lucide-react";
import CategorySelect from "./category-select";
import { supabase } from "@/lib/supabase";
import { buildCycles, currentDebt, cycleEnd, cycleStartFor, DAILY_CATEGORIES, localDate, money, parseDateOnly, shortMoney, toDateOnly } from "@/lib/money";
import type { Category, Settings, Transaction, TxType } from "@/lib/types";

const categories: Category[] = ["Ăn uống", "Cafe/Giải trí", "Đi lại/Xăng", "Mua sắm", "Khác", "Trọ", "Phát sinh", "Trả nợ", "Lương", "Thưởng", "Thu nhập khác"];
const expenseCategories = new Set<Category>(["Ăn uống", "Cafe/Giải trí", "Đi lại/Xăng", "Mua sắm", "Khác", "Trọ", "Phát sinh", "Trả nợ"]);
const categoryIcon: Record<Category, IconName> = { "Ăn uống": "food", "Cafe/Giải trí": "coffee", "Đi lại/Xăng": "fuel", "Mua sắm": "shopping", "Khác": "more", "Trọ": "home", "Phát sinh": "alert", "Trả nợ": "debt", "Lương": "income", "Thưởng": "star", "Thu nhập khác": "plus" };
const defaults: Omit<Settings, "user_id"> = { planned_salary: 21600000, daily_budget: 120000, rent_budget: 2500000, incidental_budget: 900000, starting_debt: 15000000, planned_debt_payment: 4000000, savings_goal: 100000000, salary_day: 15, plan_start_date: "2026-09-15", initial_savings: 0, t13_amount: 24000000, t13_date: "2026-12-15" };
const nav = [["dashboard", "Tổng quan"], ["transactions", "Giao dịch"], ["cycles", "Kỳ lương"], ["settings", "Cấu hình"]] as const;
const dmy = (d: Date) => new Intl.DateTimeFormat("vi-VN").format(d);
const pct = (v: number) => `${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%`;
const parseAmount = (v: string) => Number(v.replace(/[^\d]/g, ""));
const formatInputMoney = (v: string) => {
  const n = parseAmount(v);
  return n ? new Intl.NumberFormat("vi-VN").format(n) : "";
};

type Tab = typeof nav[number][0];
type NavIconName = Tab;
type IconName = NavIconName | "food" | "coffee" | "fuel" | "shopping" | "more" | "home" | "alert" | "debt" | "income" | "star" | "plus" | "living" | "saving";
type Toast = { kind: "success" | "error" | "info"; text: string } | null;

export default function Home() {
  const [ready, setReady] = useState(false), [uid, setUid] = useState<string | null>(null), [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [mode, setMode] = useState<"login" | "signup">("login"), [authError, setAuthError] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null), [txs, setTxs] = useState<Transaction[]>([]), [tab, setTab] = useState<Tab>("dashboard");
  const [txDate, setTxDate] = useState(toDateOnly(localDate())), [desc, setDesc] = useState(""), [category, setCategory] = useState<Category>("Ăn uống"), [type, setType] = useState<TxType>("Chi"), [amount, setAmount] = useState(""), [note, setNote] = useState("");
  const [txError, setTxError] = useState(""), [toast, setToast] = useState<Toast>(null), [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);
  const [openCycle, setOpenCycle] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUid(data.session?.user.id ?? null); setReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUid(session?.user.id ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) { queueMicrotask(() => setLoading(false)); return; }
    (async () => {
      setLoading(true);
      const [{ data: s }, { data: t }] = await Promise.all([
        supabase.from("settings").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("transactions").select("*").eq("user_id", uid).order("occurred_on", { ascending: false }).order("created_at", { ascending: false })
      ]);
      if (!s) {
        const { data: created } = await supabase.from("settings").insert({ user_id: uid, ...defaults }).select("*").single();
        setSettings(created as Settings);
      } else setSettings(s as Settings);
      setTxs((t ?? []) as Transaction[]);
      setLoading(false);
    })();
  }, [uid]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const today = localDate();
  const cycleStart = settings ? cycleStartFor(today, settings.salary_day, parseDateOnly(settings.plan_start_date)) : today;
  const cycles = useMemo(() => settings ? buildCycles(txs, settings, today, 12) : [], [txs, settings, today]);
  const current = cycles.find(c => c.start.getTime() === cycleStart.getTime());
  const debt = settings ? currentDebt(txs, settings, cycleEnd(cycleStart)) : 0;
  const cumulative = current?.cumulative ?? settings?.initial_savings ?? 0;
  const goal = settings ? cumulative / settings.savings_goal : 0;
  const spentToday = txs.filter(t => t.type === "Chi" && DAILY_CATEGORIES.has(t.category) && t.occurred_on === toDateOnly(today)).reduce((a, t) => a + t.amount, 0);
  const remainingToday = (settings?.daily_budget ?? 0) - spentToday;
  const livingBudget = current?.livingBudget ?? (settings ? settings.daily_budget * 30 + settings.rent_budget + settings.incidental_budget : 0);
  const livingSpend = current?.livingSpend ?? 0;
  const budgetRemaining = current?.budgetRemaining ?? livingBudget;
  const totalOut = current?.totalOut ?? 0;
  const amountNumber = parseAmount(amount);
  const canDeleteTx = (tx: Transaction) => parseDateOnly(tx.occurred_on) >= cycleStart;
  const incomeCycles = cycles.filter(c => c.hasData || c.start <= cycleStart);
  const totalIncome = incomeCycles.reduce((sum, c) => sum + c.income, 0);
  const cycleTxs = (start: Date) => txs.filter(t => {
    const d = parseDateOnly(t.occurred_on);
    return d >= start && d < new Date(start.getFullYear(), start.getMonth() + 1, start.getDate());
  });
  const openCycleDetails = (key: string) => {
    setOpenCycle(key);
    setTab("cycles");
  };

  async function auth(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    if (!email.trim()) { setAuthError("Vui lòng nhập email."); return; }
    if (password.length < 6) { setAuthError("Mật khẩu cần ít nhất 6 ký tự."); return; }
    const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    if (result.error) setAuthError(result.error.message);
  }

  async function addTx(e: FormEvent) {
    e.preventDefault();
    setTxError("");
    if (!uid) return;
    if (!txDate) { setTxError("Chọn ngày giao dịch."); return; }
    if (!desc.trim()) { setTxError("Nhập nội dung giao dịch."); return; }
    if (!amountNumber) { setTxError("Số tiền phải lớn hơn 0."); return; }
    const { data, error } = await supabase.from("transactions").insert({ user_id: uid, occurred_on: txDate, description: desc.trim(), category, type, amount: amountNumber, note: note.trim() || null }).select("*").single();
    if (error) { setToast({ kind: "error", text: error.message }); return; }
    if (data) {
      setTxs(p => [data as Transaction, ...p]);
      setDesc(""); setAmount(""); setNote("");
      setToast({ kind: "success", text: "Đã lưu giao dịch." });
      setTab("dashboard");
    }
  }

  async function delTx() {
    if (!confirmDelete) return;
    const { error } = await supabase.from("transactions").delete().eq("id", confirmDelete.id);
    if (error) setToast({ kind: "error", text: error.message });
    else { setTxs(p => p.filter(t => t.id !== confirmDelete.id)); setToast({ kind: "info", text: "Đã xóa giao dịch." }); }
    setConfirmDelete(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const { error } = await supabase.from("settings").update(settings).eq("user_id", settings.user_id);
    setToast(error ? { kind: "error", text: error.message } : { kind: "success", text: "Đã lưu cấu hình." });
  }

  if (!ready) return <Loading text="Đang tải ứng dụng..." />;
  if (!uid) return <main className="auth-shell"><ToastView toast={authError ? { kind: "error", text: authError } : null} /><section className="auth-card"><Logo large /><span className="auth-kicker">Personal finance</span><h1>Money Flow</h1><p>Ghi tiền vào, tiền ra và để dashboard tự tính kỳ lương 15 → 14.</p><form onSubmit={auth} className="stack"><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required /></label><label>Mật khẩu<input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" required /></label><button className="primary" type="submit">{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button></form><button className="link-btn" onClick={() => { setAuthError(""); setMode(mode === "login" ? "signup" : "login"); }}>{mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}</button></section></main>;
  if (loading || !settings) return <Loading text="Đang tải dữ liệu..." />;

  return <main className="app-shell">
    <ToastView toast={toast} />
    <aside className="sidebar"><div className="logo-row"><Logo /><div><strong>Money Flow</strong><span>Chu kỳ {settings.salary_day} → 14</span></div></div><nav>{nav.map(([k, l]) => <button key={k} className={tab === k ? "nav-active" : ""} onClick={() => setTab(k)}><NavIcon name={k} />{l}</button>)}</nav><button className="logout" onClick={() => supabase.auth.signOut()}>Đăng xuất</button></aside>
    <section className="content">
      {tab === "dashboard" && <><header className="hero"><div><span className="eyebrow">Kỳ hiện tại</span><div className="cycle-range"><div><span>Bắt đầu</span><strong>{dmy(cycleStart)}</strong></div><i>→</i><div><span>Kết thúc</span><strong>{dmy(cycleEnd(cycleStart))}</strong></div></div></div><button className="primary hero-action" onClick={() => setTab("transactions")}>+ Giao dịch</button></header><section className="dashboard-section"><div className="section-title"><div><span className="eyebrow">Tổng quan kỳ hiện tại</span><h2>Dòng tiền thực tế</h2></div><span>{toDateOnly(today)}</span></div><div className="metric-grid sheet-metrics"><Metric title="Thu nhập kỳ này" value={money(current?.income ?? 0)} tone="blue" /><Metric title="Chi sinh hoạt kỳ này" value={money(livingSpend)} /><Metric title="Đã trả nợ kỳ này" value={money(current?.debtPaid ?? 0)} /><Metric title="Tổng tiền ra kỳ này" value={money(totalOut)} tone="amber" /><Metric title="Tiền còn lại / Tiết kiệm" value={money(current?.savings ?? 0)} tone={(current?.savings ?? 0) >= 0 ? "green" : "red"} /><Metric title="Nợ hiện tại" value={money(debt)} tone="amber" /><Metric title="Tích lũy" value={money(cumulative)} tone="green" /><Metric title="Tiến độ 100tr" value={pct(goal)} tone="green" /></div></section><div className="finance-grid"><article className="panel budget-panel"><div className="panel-head"><div><span className="eyebrow">Ngân sách kỳ hiện tại</span><h2>Còn/Vượt budget kỳ</h2></div><span className="pill">{pct(livingSpend / (livingBudget || 1))}</span></div><div className="budget-big"><strong className={budgetRemaining < 0 ? "bad-text" : ""}>{money(budgetRemaining)}</strong><span>{budgetRemaining >= 0 ? "còn lại" : "vượt"}</span></div><div className="progress"><span style={{ width: `${Math.min(100, Math.max(0, livingSpend / (livingBudget || 1) * 100))}%` }} /></div><div className="stat-list"><StatLine label="Budget/ngày" value={money(settings.daily_budget)} /><StatLine label="Đã chi hôm nay" value={money(spentToday)} /><StatLine label="Còn hôm nay" value={money(remainingToday)} bad={remainingToday < 0} /><StatLine label="Budget sinh hoạt/kỳ" value={money(livingBudget)} /><StatLine label="Đã dùng budget kỳ" value={money(livingSpend)} /><StatLine label="Trọ / Phát sinh" value={`${shortMoney(current?.rent ?? 0)} / ${shortMoney(current?.incidental ?? 0)}`} /></div></article><IncomeChart cycles={incomeCycles} total={totalIncome} /></div><section className="section-head"><h2>Tóm tắt kỳ lương</h2><button className="link-btn" onClick={() => setTab("cycles")}>Xem tất cả</button></section><CycleSummary cycles={cycles.slice(0, 6)} onOpen={openCycleDetails} /><section className="section-head"><h2>Giao dịch gần đây</h2><button className="link-btn" onClick={() => setTab("transactions")}>Xem tất cả</button></section><TxList items={txs.slice(0, 6)} onDelete={setConfirmDelete} canDelete={canDeleteTx} /></>}
      {tab === "transactions" && <><header className="page-header"><div><span className="eyebrow">Nguồn dữ liệu chính</span><h1>Giao dịch</h1><p>Nhập giao dịch thật, mọi báo cáo sẽ tự cập nhật.</p></div></header><form className="tx-card" onSubmit={addTx}><div className="segmented"><button type="button" className={type === "Chi" ? "active expense-bg" : ""} onClick={() => setType("Chi")}>Chi</button><button type="button" className={type === "Thu" ? "active income-bg" : ""} onClick={() => setType("Thu")}>Thu</button></div><label>Ngày<input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} /></label><label>Nội dung<input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ví dụ: Ăn trưa" /></label><div className="form-grid"><CategorySelect value={category} options={categories} onChange={c => { setCategory(c); setType(expenseCategories.has(c) ? "Chi" : "Thu"); }} /><label>Số tiền<input inputMode="numeric" value={amount} onChange={e => setAmount(formatInputMoney(e.target.value))} placeholder="120.000" /></label></div><label>Ghi chú<input value={note} onChange={e => setNote(e.target.value)} placeholder="Không bắt buộc" /></label>{txError && <div className="form-error">{txError}</div>}<button className="primary full" type="submit">Lưu giao dịch</button></form><TxList items={txs} onDelete={setConfirmDelete} canDelete={canDeleteTx} /></>}
      {tab === "cycles" && <><header className="page-header"><div><span className="eyebrow">15 → 14</span><h1>Các kỳ lương</h1><p>Bấm vào từng kỳ để xem tổng hợp và các khoản lớn.</p></div></header><div className="cycle-list">{cycles.map(c => <CycleDetailCard key={c.start.toISOString()} cycle={c} items={cycleTxs(c.start)} open={openCycle === c.start.toISOString()} onToggle={() => setOpenCycle(openCycle === c.start.toISOString() ? "" : c.start.toISOString())} onViewAll={() => setTab("transactions")} />)}</div></>}
      {tab === "settings" && <><header className="page-header"><div><span className="eyebrow">Cấu hình</span><h1>Thiết lập dòng tiền</h1><p>Các số này là mốc kế hoạch. Actual vẫn lấy từ giao dịch.</p></div></header><form className="settings-shell" onSubmit={save}><section className="setting-group"><div><h2>Thu nhập & chu kỳ</h2><p>Dùng để xác định kỳ tài chính và tham chiếu khi nạp dữ liệu mẫu.</p></div><Setting label="Lương kế hoạch/kỳ" value={settings.planned_salary} set={v => setSettings({ ...settings, planned_salary: v })} /><div className="form-grid"><label>Ngày nhận lương<input type="number" min={1} max={28} value={settings.salary_day} onChange={e => setSettings({ ...settings, salary_day: Number(e.target.value) })} /></label><label>Ngày bắt đầu<input type="date" value={settings.plan_start_date} onChange={e => setSettings({ ...settings, plan_start_date: e.target.value })} /></label></div></section><section className="setting-group"><div><h2>Ngân sách sinh hoạt</h2><p>Budget kỳ = ngân sách/ngày × 30 + trọ + phát sinh.</p></div><Setting label="Ngân sách/ngày" value={settings.daily_budget} set={v => setSettings({ ...settings, daily_budget: v })} /><Setting label="Ngân sách trọ/kỳ" value={settings.rent_budget} set={v => setSettings({ ...settings, rent_budget: v })} /><Setting label="Ngân sách phát sinh/kỳ" value={settings.incidental_budget} set={v => setSettings({ ...settings, incidental_budget: v })} /></section><section className="setting-group debt-setting"><div><h2>Nợ hiện tại</h2><p>Nhập nợ ban đầu một lần. Khi có giao dịch danh mục Trả nợ, app tự trừ dần cho tới 0.</p></div><Setting label="Nợ ban đầu" value={settings.starting_debt} set={v => setSettings({ ...settings, starting_debt: v })} /><div className="debt-preview"><span>Nợ còn lại theo dữ liệu hiện tại</span><strong>{money(debt)}</strong></div></section><section className="setting-group"><div><h2>Thông tin bổ sung</h2><p>Tùy chọn, không ảnh hưởng trực tiếp tới actual nếu chưa có transaction.</p></div><Setting label="Tích lũy trước kế hoạch" value={settings.initial_savings} set={v => setSettings({ ...settings, initial_savings: v })} /><Setting label="Thưởng T13 dự kiến" value={settings.t13_amount} set={v => setSettings({ ...settings, t13_amount: v })} /><label>Ngày T13 dự kiến<input type="date" value={settings.t13_date ?? ""} onChange={e => setSettings({ ...settings, t13_date: e.target.value || null })} /></label></section><button className="primary full settings-save" type="submit">Lưu cấu hình</button></form></>}
    </section>
    <nav className="bottom-nav mobile-shell-nav">{nav.map(([k, l]) => <button key={k} className={tab === k ? "nav-active" : ""} onClick={() => setTab(k)}><NavIcon name={k} />{l}</button>)}</nav>
    {confirmDelete && <div className="modal-backdrop"><section className="modal"><h2>Xóa giao dịch?</h2><p>{confirmDelete.description} · {money(confirmDelete.amount)}</p><div><button className="ghost" onClick={() => setConfirmDelete(null)}>Hủy</button><button className="danger" onClick={delTx}>Xóa</button></div></section></div>}
  </main>;
}

function Logo({ large = false }: { large?: boolean }) { return <div className={large ? "logo large" : "logo"}><span>M</span><i /></div>; }
function NavIcon({ name }: { name: IconName }) {
  const Icon = {
    dashboard: LayoutDashboard,
    transactions: Plus,
    cycles: Clock3,
    settings: SettingsIcon,
    food: Utensils,
    coffee: Coffee,
    fuel: Fuel,
    shopping: ShoppingBag,
    more: MoreHorizontal,
    home: House,
    alert: AlertTriangle,
    debt: Landmark,
    income: ArrowDownToLine,
    star: Gift,
    plus: CircleDollarSign,
    living: HomeIcon,
    saving: Banknote
  }[name];
  return <Icon aria-hidden="true" />;
}
function Loading({ text }: { text: string }) { return <main className="center-screen"><Logo large /><p>{text}</p></main>; }
function ToastView({ toast }: { toast: Toast }) { return toast ? <div className={`toast ${toast.kind}`}>{toast.text}</div> : null; }
function Metric({ title, value, tone }: { title: string; value: string; tone?: "green" | "red" | "blue" | "amber" }) { return <article className={`metric ${tone ?? ""}`}><span>{title}</span><strong>{value}</strong></article>; }
function BudgetCard({ title, percent, main, sub, left, right, goal = false }: { title: string; percent: number; main: string; sub: string; left: string; right: string; goal?: boolean }) { return <article className="panel"><div className="panel-head"><div><span className="eyebrow">{goal ? "Goal" : "Budget"}</span><h2>{title}</h2></div><span className="pill">{pct(percent)}</span></div><div className="budget-big"><strong>{main}</strong><span>{sub}</span></div><div className={`progress ${goal ? "goal" : ""}`}><span style={{ width: `${Math.min(100, Math.max(0, percent * 100))}%` }} /></div><div className="split"><span>{left}</span><span>{right}</span></div></article>; }
function StatLine({ label, value, bad = false }: { label: string; value: string; bad?: boolean }) { return <div className="stat-line"><span>{label}</span><strong className={bad ? "bad-text" : ""}>{value}</strong></div>; }
function IncomeChart({ cycles, total }: { cycles: ReturnType<typeof buildCycles>; total: number }) {
  const visible = cycles.slice(0, 12);
  const maxIncome = Math.max(1, ...visible.map(c => c.income));
  return <article className="panel income-panel"><div className="panel-head"><div><span className="eyebrow">Thu nhập</span><h2>Theo từng kỳ</h2></div><span className="pill">{money(total)}</span></div><div className="income-total"><span>Tổng thu nhập</span><strong>{money(total)}</strong></div><div className="bar-chart">{visible.map(c => <div className="bar-item" key={c.start.toISOString()}><div className="bar-track"><span style={{ height: `${Math.max(4, c.income / maxIncome * 100)}%` }} /></div><b>{shortMoney(c.income)}</b><small>Th{c.start.getMonth() + 1}</small></div>)}</div></article>;
}
function CycleSummary({ cycles, onOpen }: { cycles: ReturnType<typeof buildCycles>; onOpen: (key: string) => void }) { return <div className="summary-table">{cycles.map(c => <button key={c.start.toISOString()} className={c.hasData ? "" : "is-empty"} onClick={() => onOpen(c.start.toISOString())}><div><span>{dmy(c.start)}</span><b>{dmy(c.end)}</b></div>{c.hasData ? <><strong className={c.savings < 0 ? "bad-text" : "good-text"}>{shortMoney(c.savings)}</strong><small>Chi {shortMoney(c.livingSpend)} · Nợ {shortMoney(c.debtPaid)}</small></> : <><strong>--</strong><small>Chưa có dữ liệu</small></>}</button>)}</div>; }
function CycleDetailCard({ cycle, items, open, onToggle, onViewAll }: { cycle: ReturnType<typeof buildCycles>[number]; items: Transaction[]; open: boolean; onToggle: () => void; onViewAll: () => void }) {
  const byCategory = categories.map(category => ({
    category,
    income: items.filter(t => t.type === "Thu" && t.category === category).reduce((a, t) => a + t.amount, 0),
    expense: items.filter(t => t.type === "Chi" && t.category === category).reduce((a, t) => a + t.amount, 0)
  })).filter(x => x.income || x.expense);
  const previewItems = items.slice(0, 3);
  return <article className={`cycle-card ${open ? "open" : ""}`}><button className="cycle-toggle" onClick={onToggle}><div className="cycle-title"><span>{dmy(cycle.start)} → {dmy(cycle.end)}</span><strong className={cycle.savings < 0 ? "bad-text" : "good-text"}>{cycle.hasData ? money(cycle.savings) : "Chưa có dữ liệu"}</strong></div><b className="detail-pill"><span>{open ? "Thu gọn" : "Chi tiết"}</span><i /></b></button>{cycle.hasData && <div className="cycle-stats"><MiniStat icon="income" label="Thu" value={shortMoney(cycle.income)} tone="green" /><MiniStat icon="living" label="Chi sống" value={shortMoney(cycle.livingSpend)} /><MiniStat icon="debt" label="Trả nợ" value={shortMoney(cycle.debtPaid)} tone="amber" /><MiniStat icon="saving" label="Tích lũy" value={shortMoney(cycle.cumulative)} tone="green" /></div>}{open && <div className="cycle-detail"><div className="category-breakdown"><h3>Thống kê theo danh mục</h3>{byCategory.length === 0 ? <p>Chưa có giao dịch trong kỳ.</p> : byCategory.map(x => <div key={x.category}><i><NavIcon name={categoryIcon[x.category]} /></i><span>{x.category}</span><strong>{money(x.income || x.expense)}</strong></div>)}</div><div className="detail-head"><h3>Giao dịch nổi bật</h3>{items.length > 3 && <button className="link-btn" onClick={onViewAll}>Xem tất cả</button>}</div>{previewItems.length ? <TxList items={previewItems} onDelete={() => {}} readonly /> : <div className="empty cycle-empty">Chưa có giao dịch trong kỳ.</div>}</div>}</article>;
}
function MiniStat({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone?: "green" | "amber" }) { return <div className={`mini-stat ${tone ?? ""}`}><i><NavIcon name={icon} /></i><span>{label}</span><strong>{value}</strong></div>; }
function Setting({ label, value, set }: { label: string; value: number; set: (n: number) => void }) { return <label>{label}<input inputMode="numeric" value={new Intl.NumberFormat("vi-VN").format(value)} onChange={e => set(parseAmount(e.target.value))} /></label>; }
function TxList({ items, onDelete, readonly = false, canDelete }: { items: Transaction[]; onDelete: (tx: Transaction) => void; readonly?: boolean; canDelete?: (tx: Transaction) => boolean }) { return <div className="tx-list">{items.length === 0 && <div className="empty">Chưa có giao dịch.</div>}{items.map(t => { const locked = !readonly && canDelete && !canDelete(t); return <article className="tx-item" key={t.id}><div className={t.type === "Thu" ? "tx-dot income-bg" : "tx-dot expense-bg"}><NavIcon name={categoryIcon[t.category]} /></div><div><strong>{t.description}</strong><span>{dmy(parseDateOnly(t.occurred_on))} · {t.category}{t.note ? ` · ${t.note}` : ""}</span></div><div className="tx-money"><b className={t.type === "Thu" ? "good-text" : ""}>{t.type === "Thu" ? "+" : "-"}{money(t.amount)}</b>{locked ? <em>Đã chốt</em> : !readonly && <button onClick={() => onDelete(t)} aria-label="Xóa giao dịch">×</button>}</div></article>; })}</div>; }
