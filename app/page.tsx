"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Banknote, CircleDollarSign, Clock3, Coffee, Fuel, Gift, HomeIcon, House, Landmark, LayoutDashboard, LogOut, MoreHorizontal, Plus, SettingsIcon, ShoppingBag, Utensils, Wallet } from "lucide-react";
import CategorySelect from "./category-select";
import { supabase } from "@/lib/supabase";
import { buildCycles, currentDebt, cycleEnd, cycleStartFor, DAILY_CATEGORIES, localDate, money, parseDateOnly, salaryDayFromPlanStart, shortMoney, toDateOnly } from "@/lib/money";
import type { Category, Settings, Transaction, TxType } from "@/lib/types";

const easeOut = [0.22, 1, 0.36, 1] as const;

const categories: Category[] = ["Ăn uống", "Cafe/Giải trí", "Đi lại/Xăng", "Mua sắm", "Khác", "Trọ", "Phát sinh", "Trả nợ", "Lương", "Thưởng", "Thu nhập khác"];
const expenseCategories = new Set<Category>(["Ăn uống", "Cafe/Giải trí", "Đi lại/Xăng", "Mua sắm", "Khác", "Trọ", "Phát sinh", "Trả nợ"]);
const categoryIcon: Record<Category, IconName> = { "Ăn uống": "food", "Cafe/Giải trí": "coffee", "Đi lại/Xăng": "fuel", "Mua sắm": "shopping", "Khác": "more", "Trọ": "home", "Phát sinh": "alert", "Trả nợ": "debt", "Lương": "income", "Thưởng": "star", "Thu nhập khác": "plus" };
const defaults: Omit<Settings, "user_id"> = { planned_salary: 21600000, daily_budget: 120000, rent_budget: 2500000, incidental_budget: 900000, starting_debt: 15000000, planned_debt_payment: 4000000, savings_goal: 100000000, salary_day: 15, plan_start_date: "2026-09-15", initial_savings: 0, t13_amount: 24000000, t13_date: null };
const nav = [["dashboard", "Tổng quan"], ["transactions", "Giao dịch"], ["cycles", "Kỳ lương"], ["settings", "Cấu hình"]] as const;
const dmy = (d: Date) => new Intl.DateTimeFormat("vi-VN").format(d);
const cycleEndDayLabel = (salaryDay: number) => (salaryDay === 1 ? "cuối tháng" : String(salaryDay - 1));
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
  const [authPending, setAuthPending] = useState(false), [authNotice, setAuthNotice] = useState("");
  const [authField, setAuthField] = useState<"email" | "password" | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null), [txs, setTxs] = useState<Transaction[]>([]), [tab, setTab] = useState<Tab>("dashboard");
  const [txDate, setTxDate] = useState(toDateOnly(localDate())), [desc, setDesc] = useState(""), [category, setCategory] = useState<Category>("Ăn uống"), [type, setType] = useState<TxType>("Chi"), [amount, setAmount] = useState(""), [note, setNote] = useState("");
  const [txError, setTxError] = useState(""), [toast, setToast] = useState<Toast>(null), [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);
  const [openCycle, setOpenCycle] = useState("");
  const reduceMotion = useReducedMotion();

  const goTab = (next: Tab) => {
    setTab(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  useEffect(() => {
    const callbackParams = new URLSearchParams(window.location.hash.slice(1));
    const callbackError = callbackParams.get("error_description") || new URLSearchParams(window.location.search).get("error_description");
    if (callbackError) {
      queueMicrotask(() => setAuthError("Link xác nhận đã hết hạn hoặc không hợp lệ. Vui lòng đăng ký lại để nhận email xác nhận mới."));
      window.history.replaceState(null, "", window.location.pathname);
    }
    supabase.auth.getSession().then(({ data, error }) => {
      setUid(data.session?.user.id ?? null);
      if (error) setAuthError(error.message);
      setReady(true);
    }).catch(() => { setAuthError("Không thể kết nối. Vui lòng thử lại."); setReady(true); });
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
  const salaryDay = settings ? salaryDayFromPlanStart(settings.plan_start_date) : 15;
  const cycleStart = settings ? cycleStartFor(today, salaryDay, parseDateOnly(settings.plan_start_date)) : today;
  const cycles = useMemo(() => settings ? buildCycles(txs, settings, today, 12) : [], [txs, settings, today]);
  const current = cycles.find(c => c.start.getTime() === cycleStart.getTime());
  const debt = settings ? currentDebt(txs, settings, cycleEnd(cycleStart)) : 0;
  const spentToday = txs.filter(t => t.type === "Chi" && DAILY_CATEGORIES.has(t.category) && t.occurred_on === toDateOnly(today)).reduce((a, t) => a + t.amount, 0);
  const remainingToday = (settings?.daily_budget ?? 0) - spentToday;
  const livingBudget = current?.livingBudget ?? (settings ? settings.daily_budget * 30 + settings.rent_budget + settings.incidental_budget : 0);
  const livingSpend = current?.livingSpend ?? 0;
  const budgetRemaining = current?.budgetRemaining ?? livingBudget;
  const totalOut = current?.totalOut ?? 0;
  const amountNumber = parseAmount(amount);
  const canDeleteTx = (tx: Transaction) => parseDateOnly(tx.occurred_on) >= cycleStart;
  const incomeCycles = cycles.filter(c => c.hasData || c.start <= cycleStart);
  const bonusIncome = settings?.t13_amount ?? 0;
  const carriedSavings = settings?.initial_savings ?? 0;
  const earnedIncome = incomeCycles.reduce((sum, c) => sum + c.income, 0);
  const cycleTxs = (start: Date) => txs.filter(t => {
    const d = parseDateOnly(t.occurred_on);
    return d >= start && d < new Date(start.getFullYear(), start.getMonth() + 1, start.getDate());
  });
  const openCycleDetails = (key: string) => {
    setOpenCycle(key);
    goTab("cycles");
  };

  async function auth(e: FormEvent) {
    e.preventDefault();
    if (authPending) return;
    setAuthError("");
    setAuthNotice("");
    setAuthField(null);
    const address = email.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
    if (!address) { setAuthField("email"); setAuthError("Vui lòng nhập email."); return; }
    if (!emailOk) { setAuthField("email"); setAuthError("Email không hợp lệ. Ví dụ: you@email.com"); return; }
    if (!password) { setAuthField("password"); setAuthError("Vui lòng nhập mật khẩu."); return; }
    if (password.length < 6) { setAuthField("password"); setAuthError("Mật khẩu cần ít nhất 6 ký tự."); return; }
    setAuthPending(true);
    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email: address, password })
        : await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: `${window.location.origin}/` } });
      if (result.error) {
        const messages: Record<string, string> = {
          invalid_credentials: "Email hoặc mật khẩu không đúng.",
          email_not_confirmed: "Bạn cần xác nhận email trước khi đăng nhập. Hãy kiểm tra hộp thư và mục Spam.",
          user_already_exists: "Email này đã được đăng ký. Vui lòng đăng nhập.",
          over_email_send_rate_limit: "Bạn đã yêu cầu quá nhiều email. Vui lòng chờ một lát rồi thử lại.",
          over_request_rate_limit: "Có quá nhiều yêu cầu. Vui lòng chờ một lát rồi thử lại.",
          signup_disabled: "Đăng ký hiện đang tạm tắt.",
        };
        const code = result.error.code ?? "";
        setAuthField(code === "invalid_credentials" || code === "email_not_confirmed" || code === "user_already_exists" ? "email" : null);
        setAuthError(messages[code] ?? result.error.message);
      } else if (mode === "signup" && !result.data.session) {
        setAuthNotice(`Đã tiếp nhận đăng ký cho ${address}. Hãy kiểm tra hộp thư (cả mục Spam) và nhấn link xác nhận để hoàn tất. Nếu email đã có tài khoản, hãy đăng nhập.`);
        setMode("login");
        setPassword("");
        setAuthField(null);
      }
    } catch {
      setAuthError("Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setAuthPending(false);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setToast({ kind: "error", text: error.message });
    else { setTxs([]); setSettings(null); setTab("dashboard"); }
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
      goTab("dashboard");
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
    const next = { ...settings, salary_day: salaryDayFromPlanStart(settings.plan_start_date), t13_date: null };
    setSettings(next);
    const { error } = await supabase.from("settings").update(next).eq("user_id", next.user_id);
    setToast(error ? { kind: "error", text: error.message } : { kind: "success", text: "Đã lưu cấu hình." });
  }

  if (!ready) return <Loading text="Đang tải ứng dụng..." />;
  if (!uid) return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><Logo large /><p className="auth-kicker">Personal finance</p><h1 className="sr-only">Money Flow</h1></div>{authNotice && <div className="auth-notice" role="status">{authNotice}</div>}<form onSubmit={auth} className="stack" noValidate aria-busy={authPending}><label>Email<input type="email" value={email} autoComplete="email" aria-invalid={authField === "email"} onChange={e => { setEmail(e.target.value); if (authError) { setAuthError(""); setAuthField(null); } }} placeholder="you@email.com" /></label><label>Mật khẩu<input type="password" value={password} autoComplete={mode === "login" ? "current-password" : "new-password"} aria-invalid={authField === "password"} onChange={e => { setPassword(e.target.value); if (authError) { setAuthError(""); setAuthField(null); } }} placeholder="Tối thiểu 6 ký tự" /></label><AnimatePresence>{authError && <motion.div key={authError} className="form-error auth-message shake" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>{authError}</motion.div>}</AnimatePresence><button className="primary" type="submit" disabled={authPending}>{authPending ? (mode === "login" ? "Đang đăng nhập…" : "Đang tạo tài khoản…") : (mode === "login" ? "Đăng nhập" : "Tạo tài khoản")}</button></form><button className="link-btn auth-switch" disabled={authPending} onClick={() => { setAuthError(""); setAuthNotice(""); setAuthField(null); setMode(mode === "login" ? "signup" : "login"); }}>{mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}</button></section></main>;
  if (loading || !settings) return <Loading text="Đang tải dữ liệu..." />;

  return <main className="app-shell">
    <ToastView toast={toast} />
    <aside className="sidebar"><div className="logo-row"><Logo /><div><span className="logo-cycle">Kỳ: ngày {salaryDay} → {cycleEndDayLabel(salaryDay)}</span></div></div><LayoutGroup id="side-nav"><nav>{nav.map(([k, l]) => <button key={k} className={tab === k ? "nav-active" : ""} onClick={() => goTab(k)}>{tab === k && <motion.span layoutId="side-nav-pill" className="nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}<NavIcon name={k} />{l}</button>)}</nav></LayoutGroup><button className="logout" onClick={signOut}><LogOut size={16} strokeWidth={2.2} aria-hidden="true" /><span>Đăng xuất</span></button></aside>
    <header className="mobile-account-bar"><Logo /><button type="button" className="logout-chip" onClick={signOut} aria-label="Đăng xuất"><LogOut size={16} strokeWidth={2.3} aria-hidden="true" /><span>Đăng xuất</span></button></header>
    <section className="content">
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          className="tab-panel"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: easeOut }}
        >
      {tab === "dashboard" && <><header className="hero"><div><span className="eyebrow">Kỳ hiện tại</span><div className="cycle-range"><div><span>Bắt đầu</span><strong>{dmy(cycleStart)}</strong></div><i>→</i><div><span>Kết thúc</span><strong>{dmy(cycleEnd(cycleStart))}</strong></div></div></div><button className="primary hero-action" onClick={() => goTab("transactions")}><Plus size={16} strokeWidth={2.5} aria-hidden="true" /><span>Giao dịch</span></button></header><section className="dashboard-section"><div className="section-title"><div><span className="eyebrow">Tổng quan kỳ hiện tại</span><h2>Dòng tiền thực tế</h2></div><span>{toDateOnly(today)}</span></div><div className="metric-grid sheet-metrics"><Metric title="Thu nhập kỳ này" value={money(current?.income ?? 0)} tone="blue" /><Metric title="Chi sinh hoạt kỳ này" value={money(livingSpend)} /><Metric title="Đã trả nợ kỳ này" value={money(current?.debtPaid ?? 0)} /><Metric title="Tổng tiền ra kỳ này" value={money(totalOut)} tone="amber" /><Metric title="Tiền còn lại" value={money(current?.savings ?? 0)} tone={(current?.savings ?? 0) >= 0 ? "green" : "red"} /><Metric title="Nợ hiện tại" value={money(debt)} tone="amber" /></div></section><div className="finance-grid"><article className="panel budget-panel"><div className="panel-head"><div><span className="eyebrow">Ngân sách kỳ hiện tại</span><h2>Còn/Vượt budget kỳ</h2></div><span className="pill">{pct(livingSpend / (livingBudget || 1))}</span></div><div className="budget-big"><strong className={budgetRemaining < 0 ? "bad-text" : ""}>{money(budgetRemaining)}</strong><span>{budgetRemaining >= 0 ? "còn lại" : "vượt"}</span></div><div className="progress"><span style={{ width: `${Math.min(100, Math.max(0, livingSpend / (livingBudget || 1) * 100))}%` }} /></div><div className="stat-list"><StatLine label="Budget/ngày" value={money(settings.daily_budget)} /><StatLine label="Đã chi hôm nay" value={money(spentToday)} /><StatLine label="Còn hôm nay" value={money(remainingToday)} bad={remainingToday < 0} /><StatLine label="Budget sinh hoạt/kỳ" value={money(livingBudget)} /><StatLine label="Đã dùng budget kỳ" value={money(livingSpend)} /><StatLine label="Trọ / Phát sinh" value={`${shortMoney(current?.rent ?? 0)} / ${shortMoney(current?.incidental ?? 0)}`} /></div></article><IncomeChart cycles={incomeCycles} earned={earnedIncome} bonus={bonusIncome} carried={carriedSavings} /></div><section className="section-head"><h2>Tóm tắt kỳ lương</h2><button className="link-btn" onClick={() => goTab("cycles")}>Xem tất cả</button></section><CycleSummary cycles={cycles.slice(0, 6)} onOpen={openCycleDetails} /><section className="section-head"><h2>Giao dịch gần đây</h2><button className="link-btn" onClick={() => goTab("transactions")}>Xem tất cả</button></section><TxList items={txs.slice(0, 6)} onDelete={setConfirmDelete} canDelete={canDeleteTx} /></>}
      {tab === "transactions" && <><header className="page-header"><div><span className="eyebrow">Nguồn dữ liệu chính</span><h1>Giao dịch</h1><p>Nhập giao dịch thật, mọi báo cáo sẽ tự cập nhật.</p></div></header><form className="tx-card" onSubmit={addTx}><div className="segmented"><motion.span className={`segmented-pill ${type === "Chi" ? "expense" : "income"}`} animate={{ x: type === "Chi" ? 0 : "calc(100% + 8px)" }} transition={{ type: "spring", stiffness: 420, damping: 34 }} /><button type="button" className={type === "Chi" ? "active" : ""} onClick={() => setType("Chi")}>Chi</button><button type="button" className={type === "Thu" ? "active" : ""} onClick={() => setType("Thu")}>Thu</button></div><label>Ngày<input type="date" value={txDate} aria-invalid={txError.includes("ngày")} onChange={e => { setTxDate(e.target.value); if (txError) setTxError(""); }} /></label><label>Nội dung<input value={desc} aria-invalid={txError.includes("nội dung")} onChange={e => { setDesc(e.target.value); if (txError) setTxError(""); }} placeholder="Ví dụ: Ăn trưa" /></label><div className="form-grid"><CategorySelect value={category} options={categories} onChange={c => { setCategory(c); setType(expenseCategories.has(c) ? "Chi" : "Thu"); if (txError) setTxError(""); }} /><label>Số tiền<input inputMode="numeric" value={amount} aria-invalid={txError.includes("Số tiền")} onChange={e => { setAmount(formatInputMoney(e.target.value)); if (txError) setTxError(""); }} placeholder="120.000" /></label></div><label>Ghi chú<input value={note} onChange={e => setNote(e.target.value)} placeholder="Không bắt buộc" /></label><AnimatePresence>{txError && <motion.div key={txError} className="form-error shake" role="alert" initial={reduceMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>{txError}</motion.div>}</AnimatePresence><button className="primary full" type="submit">Lưu giao dịch</button></form><TxList items={txs} onDelete={setConfirmDelete} canDelete={canDeleteTx} /></>}
      {tab === "cycles" && <><header className="page-header cycles-header"><div className="cycles-header-top"><div className="cycles-header-copy"><span className="eyebrow">Theo dõi chi tiêu</span><h1>Các kỳ lương</h1><p>Chọn một kỳ để xem thu, chi và số còn lại.</p></div><div className="cycles-header-icon" aria-hidden="true"><Clock3 size={18} strokeWidth={2.2} /></div></div><div className="cycle-rule" role="note"><span className="cycle-rule-caption">Quy tắc mỗi kỳ</span><div className="cycle-rule-track"><div className="cycle-rule-day"><small>Bắt đầu</small><strong>Ngày {salaryDay}</strong></div><span className="cycle-rule-arrow" aria-hidden="true"><i /></span><div className="cycle-rule-day"><small>Kết thúc</small><strong>{salaryDay === 1 ? "Cuối tháng" : `Ngày ${cycleEndDayLabel(salaryDay)}`}</strong></div></div></div></header><div className="cycle-list">{cycles.map(c => <CycleDetailCard key={c.start.toISOString()} cycle={c} items={cycleTxs(c.start)} open={openCycle === c.start.toISOString()} onToggle={() => setOpenCycle(openCycle === c.start.toISOString() ? "" : c.start.toISOString())} onViewAll={() => goTab("transactions")} />)}</div></>}
      {tab === "settings" && <><header className="page-header"><div><span className="eyebrow">Cấu hình</span><h1>Thiết lập chi tiêu</h1><p>Các mốc dưới đây dùng để tính ngân sách. Số thực tế vẫn lấy từ giao dịch.</p></div></header><form className="settings-shell" onSubmit={save}><section className="setting-group"><div><h2>Kỳ chi tiêu</h2><p>Ngày bắt đầu quyết định chu kỳ (ví dụ 7/9 → kỳ chạy tới 6/10).</p></div><label>Ngày bắt đầu kỳ đầu tiên<input type="date" value={settings.plan_start_date} onChange={e => { const plan_start_date = e.target.value; setSettings({ ...settings, plan_start_date, salary_day: salaryDayFromPlanStart(plan_start_date) }); }} /></label><p className="setting-hint">Mỗi kỳ chạy từ ngày {salaryDay} đến {salaryDay === 1 ? "cuối tháng" : `ngày ${cycleEndDayLabel(salaryDay)} tháng sau`}.</p></section><section className="setting-group"><div><h2>Ngân sách sinh hoạt</h2><p>Ngân sách mỗi kỳ = hạn mức/ngày × 30 + tiền trọ + phát sinh.</p></div><Setting label="Hạn mức chi tiêu mỗi ngày" value={settings.daily_budget} set={v => setSettings({ ...settings, daily_budget: v })} /><Setting label="Tiền trọ mỗi kỳ" value={settings.rent_budget} set={v => setSettings({ ...settings, rent_budget: v })} /><Setting label="Dự phòng phát sinh mỗi kỳ" value={settings.incidental_budget} set={v => setSettings({ ...settings, incidental_budget: v })} /></section><section className="setting-group debt-setting"><div><h2>Nợ cần trả</h2><p>Nhập số nợ ban đầu một lần. Mỗi giao dịch danh mục Trả nợ sẽ tự trừ dần.</p></div><Setting label="Số nợ ban đầu" value={settings.starting_debt} set={v => setSettings({ ...settings, starting_debt: v })} /><div className="debt-preview"><span>Nợ còn lại hiện tại</span><strong>{money(debt)}</strong></div></section><section className="setting-group"><div><h2>Thông tin thêm</h2><p>Số dư và thưởng năm sẽ được cộng vào tổng tiền trên Dashboard.</p></div><Setting label="Số dư tiết kiệm đầu kỳ" value={settings.initial_savings} set={v => setSettings({ ...settings, initial_savings: v })} /><p className="setting-hint">Tiền bạn đã có trước khi bắt đầu theo dõi (không phải lương kỳ này).</p><Setting label="Thưởng Tết / thưởng năm" value={settings.t13_amount} set={v => setSettings({ ...settings, t13_amount: v, t13_date: null })} /><p className="setting-hint">Điền số tiền thưởng năm để cộng vào tổng thu trên Dashboard.</p></section><button className="primary full settings-save" type="submit">Lưu cấu hình</button></form></>}
        </motion.div>
      </AnimatePresence>
    </section>
    <LayoutGroup id="bottom-nav"><nav className="bottom-nav mobile-shell-nav">{nav.map(([k, l]) => <button key={k} className={tab === k ? "nav-active" : ""} onClick={() => goTab(k)}>{tab === k && <motion.span layoutId="bottom-nav-pill" className="nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}<NavIcon name={k} />{l}</button>)}</nav></LayoutGroup>
    <AnimatePresence>{confirmDelete && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setConfirmDelete(null)}><motion.section className="modal" role="dialog" aria-modal="true" initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2, ease: easeOut }} onClick={e => e.stopPropagation()}><h2>Xóa giao dịch?</h2><p>{confirmDelete.description} · {money(confirmDelete.amount)}</p><div><button className="ghost" onClick={() => setConfirmDelete(null)}>Hủy</button><button className="danger" onClick={delTx}>Xóa</button></div></motion.section></motion.div>}</AnimatePresence>
  </main>;
}

function Logo({ large = false }: { large?: boolean }) {
  return (
    <div className={large ? "logo large" : "logo"} aria-hidden={false}>
      <img src="/logo.png" alt="Money Flow" width={large ? 72 : 42} height={large ? 72 : 42} />
    </div>
  );
}
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
function ToastView({ toast }: { toast: Toast }) {
  return <AnimatePresence>{toast && <motion.div className={`toast ${toast.kind}`} initial={{ opacity: 0, y: -12, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: -8, x: "-50%" }} transition={{ duration: 0.22, ease: easeOut }}>{toast.text}</motion.div>}</AnimatePresence>;
}
function Metric({ title, value, tone }: { title: string; value: string; tone?: "green" | "red" | "blue" | "amber" }) { return <article className={`metric ${tone ?? ""}`}><span>{title}</span><strong>{value}</strong></article>; }
function BudgetCard({ title, percent, main, sub, left, right, goal = false }: { title: string; percent: number; main: string; sub: string; left: string; right: string; goal?: boolean }) { return <article className="panel"><div className="panel-head"><div><span className="eyebrow">{goal ? "Goal" : "Budget"}</span><h2>{title}</h2></div><span className="pill">{pct(percent)}</span></div><div className="budget-big"><strong>{main}</strong><span>{sub}</span></div><div className={`progress ${goal ? "goal" : ""}`}><span style={{ width: `${Math.min(100, Math.max(0, percent * 100))}%` }} /></div><div className="split"><span>{left}</span><span>{right}</span></div></article>; }
function StatLine({ label, value, bad = false }: { label: string; value: string; bad?: boolean }) { return <div className="stat-line"><span>{label}</span><strong className={bad ? "bad-text" : ""}>{value}</strong></div>; }
function IncomeChart({ cycles, earned, bonus, carried }: { cycles: ReturnType<typeof buildCycles>; earned: number; bonus: number; carried: number }) {
  const visible = cycles.slice(0, 12);
  const totalOut = visible.reduce((sum, c) => sum + (c.hasData ? c.totalOut : 0), 0);
  const remaining = earned + bonus + carried - totalOut;
  const maxIncome = Math.max(1, ...visible.map(c => c.income));
  return (
    <article className="panel income-panel">
      <div className="panel-head">
        <div className="income-head-copy">
          <i className="income-head-icon" aria-hidden="true"><Wallet size={16} strokeWidth={2.2} /></i>
          <div>
            <span className="eyebrow">Dòng tiền</span>
            <h2>Còn lại theo kỳ</h2>
          </div>
        </div>
        <span className={`pill income-pill ${remaining < 0 ? "is-neg" : ""}`}>{money(remaining)}</span>
      </div>
      <div className={`income-total ${remaining < 0 ? "is-neg" : ""}`}>
        <div className="income-total-label">
          <Banknote size={15} strokeWidth={2.2} aria-hidden="true" />
          <span>Còn lại sau chi</span>
        </div>
        <strong className={remaining < 0 ? "bad-text" : ""}>{money(remaining)}</strong>
      </div>
      <div className="income-breakdown">
        <div className="tone-in">
          <i aria-hidden="true"><ArrowDownToLine size={15} strokeWidth={2.3} /></i>
          <span>Thu</span>
          <strong>{money(earned)}</strong>
        </div>
        <div className="tone-out">
          <i aria-hidden="true"><ArrowUpFromLine size={15} strokeWidth={2.3} /></i>
          <span>Chi</span>
          <strong>{money(totalOut)}</strong>
        </div>
        {bonus > 0 && (
          <div className="span-all tone-bonus">
            <i aria-hidden="true"><Gift size={15} strokeWidth={2.3} /></i>
            <span>Thưởng năm</span>
            <strong>{money(bonus)}</strong>
          </div>
        )}
        {carried > 0 && (
          <div className="span-all tone-carry">
            <i aria-hidden="true"><CircleDollarSign size={15} strokeWidth={2.3} /></i>
            <span>Số dư đầu kỳ</span>
            <strong>{money(carried)}</strong>
          </div>
        )}
      </div>
      <div className="bar-chart-wrap">
        <div className="bar-chart-legend">
          <span className="bar-chart-label">Còn lại so với thu từng kỳ</span>
          <div className="bar-legend-items">
            <em className="leg-income"><i />Thu</em>
            <em className="leg-remain"><i />Còn lại</em>
          </div>
        </div>
        <div className="bar-chart">
          {visible.map(c => {
            const incomeH = c.hasData && c.income > 0 ? Math.max(8, c.income / maxIncome * 100) : 0;
            const remainH = c.hasData && c.income > 0
              ? Math.max(c.savings > 0 ? 4 : 0, Math.max(0, c.savings) / maxIncome * 100)
              : (c.hasData && c.savings < 0 ? 8 : 0);
            return (
              <div className="bar-item" key={c.start.toISOString()}>
                <div className="bar-track">
                  {c.hasData && c.income > 0 && <span className="bar-base" style={{ height: `${incomeH}%` }} title={`Thu ${money(c.income)}`} />}
                  {c.hasData && (
                    <span
                      className={`bar-fill ${c.savings < 0 ? "is-neg" : ""}`}
                      style={{ height: `${c.savings < 0 ? Math.min(28, Math.abs(c.savings) / maxIncome * 100) : remainH}%` }}
                      title={`Còn lại ${money(c.savings)}`}
                    />
                  )}
                  {!c.hasData && <span className="bar-empty" />}
                </div>
                <b className={c.hasData && c.savings < 0 ? "bad-text" : ""}>{c.hasData ? shortMoney(c.savings) : "--"}</b>
                <small>Th{c.start.getMonth() + 1}</small>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
function CycleSummary({ cycles, onOpen }: { cycles: ReturnType<typeof buildCycles>; onOpen: (key: string) => void }) { return <div className="summary-table">{cycles.map(c => <button key={c.start.toISOString()} className={c.hasData ? "" : "is-empty"} onClick={() => onOpen(c.start.toISOString())}><div><span>{dmy(c.start)}</span><b>{dmy(c.end)}</b></div>{c.hasData ? <><strong className={c.savings < 0 ? "bad-text" : "good-text"}>{shortMoney(c.savings)}</strong><small>Chi {shortMoney(c.livingSpend)} · Nợ {shortMoney(c.debtPaid)}</small></> : <><strong>--</strong><small>Chưa có dữ liệu</small></>}</button>)}</div>; }
function CycleDetailCard({ cycle, items, open, onToggle, onViewAll }: { cycle: ReturnType<typeof buildCycles>[number]; items: Transaction[]; open: boolean; onToggle: () => void; onViewAll: () => void }) {
  const byCategory = categories.map(category => ({
    category,
    income: items.filter(t => t.type === "Thu" && t.category === category).reduce((a, t) => a + t.amount, 0),
    expense: items.filter(t => t.type === "Chi" && t.category === category).reduce((a, t) => a + t.amount, 0)
  })).filter(x => x.income || x.expense);
  const previewItems = items.slice(0, 3);
  return (
    <article className={`cycle-card ${open ? "open" : ""} ${cycle.hasData ? "" : "is-empty"}`}>
      <button className="cycle-toggle" type="button" onClick={onToggle}>
        <div className="cycle-title">
          <span className="cycle-range-text">{dmy(cycle.start)} → {dmy(cycle.end)}</span>
          <strong className={cycle.hasData ? (cycle.savings < 0 ? "bad-text" : "good-text") : "muted-text"}>
            {cycle.hasData ? money(cycle.savings) : "Chưa có dữ liệu"}
          </strong>
        </div>
        <span className="detail-pill"><span>{open ? "Thu gọn" : "Chi tiết"}</span><i /></span>
      </button>
      {cycle.hasData && (
        <div className="cycle-stats">
          <MiniStat icon="income" label="Thu" value={shortMoney(cycle.income)} tone="green" />
          <MiniStat icon="living" label="Chi sống" value={shortMoney(cycle.livingSpend)} />
          <MiniStat icon="debt" label="Trả nợ" value={shortMoney(cycle.debtPaid)} tone="amber" />
          <MiniStat icon="saving" label="Còn lại" value={shortMoney(cycle.savings)} tone="green" />
        </div>
      )}
      <AnimatePresence initial={false}>
      {open && (
        <motion.div
          className="cycle-detail"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.24, ease: easeOut }}
        >
          {!cycle.hasData || items.length === 0 ? (
            <div className="cycle-empty-state">
              <p>Chưa có giao dịch trong kỳ này.</p>
              <span>Thêm giao dịch để xem thống kê và số dư.</span>
            </div>
          ) : (
            <>
              <section className="cycle-section">
                <div className="detail-head"><h3>Theo danh mục</h3></div>
                <div className="category-breakdown">
                  {byCategory.map(x => (
                    <div key={x.category}>
                      <i><NavIcon name={categoryIcon[x.category]} /></i>
                      <span>{x.category}</span>
                      <strong>{money(x.income || x.expense)}</strong>
                    </div>
                  ))}
                </div>
              </section>
              <section className="cycle-section">
                <div className="detail-head">
                  <h3>Giao dịch nổi bật</h3>
                  {items.length > 3 && <button className="link-btn" type="button" onClick={onViewAll}>Xem tất cả</button>}
                </div>
                <TxList items={previewItems} onDelete={() => {}} readonly />
              </section>
            </>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </article>
  );
}
function MiniStat({ icon, label, value, tone }: { icon: IconName; label: string; value: string; tone?: "green" | "amber" }) { return <div className={`mini-stat ${tone ?? ""}`}><i><NavIcon name={icon} /></i><span>{label}</span><strong>{value}</strong></div>; }
function Setting({ label, value, set }: { label: string; value: number; set: (n: number) => void }) { return <label>{label}<input inputMode="numeric" value={new Intl.NumberFormat("vi-VN").format(value)} onChange={e => set(parseAmount(e.target.value))} /></label>; }
function TxList({ items, onDelete, readonly = false, canDelete }: { items: Transaction[]; onDelete: (tx: Transaction) => void; readonly?: boolean; canDelete?: (tx: Transaction) => boolean }) { return <div className="tx-list">{items.length === 0 && <div className="empty">Chưa có giao dịch.</div>}{items.map(t => { const locked = !readonly && canDelete && !canDelete(t); return <article className="tx-item" key={t.id}><div className={t.type === "Thu" ? "tx-dot income-bg" : "tx-dot expense-bg"}><NavIcon name={categoryIcon[t.category]} /></div><div><strong>{t.description}</strong><span>{dmy(parseDateOnly(t.occurred_on))} · {t.category}{t.note ? ` · ${t.note}` : ""}</span></div><div className="tx-money"><b className={t.type === "Thu" ? "good-text" : ""}>{t.type === "Thu" ? "+" : "-"}{money(t.amount)}</b>{locked ? <em>Đã chốt</em> : !readonly && <button onClick={() => onDelete(t)} aria-label="Xóa giao dịch">×</button>}</div></article>; })}</div>; }
