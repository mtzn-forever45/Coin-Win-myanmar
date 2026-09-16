// ======================================================
// Coin Win Myanmar - app.js
// ======================================================

// ---------- Supabase ----------
const SUPABASE_URL = https://oymkceiqfchtvcxdltor.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95bWtjZWlxZmNodHZjeGRsdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjA4MjcsImV4cCI6MjEwNDg5NjgyN30.KPwCk-8OKrHxzyt746hjccSzbUHKTA1AI3LNSjk4rPg";


const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

// ---------- Helper ----------
const $ = (id) => document.getElementById(id);

function setMessage(id, message) {
  const el = $(id);
  if (el) el.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

// ======================================================
// AUTH
// ======================================================

async function login() {
  const email = $("email")?.value.trim();
  const password = $("password")?.value;

  setMessage("authMsg", "");

  if (!email || !password) {
    setMessage("authMsg", "Email နဲ့ Password ဖြည့်ပါ။");
    return;
  }

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMessage("authMsg", "❌ " + error.message);
      return;
    }

    currentUser = data.user;

    await showApp();

  } catch (err) {
    console.error(err);
    setMessage("authMsg", "❌ " + err.message);
  }
}

async function signup() {
  const email = $("email")?.value.trim();
  const password = $("password")?.value;

  setMessage("authMsg", "");

  if (!email || !password) {
    setMessage("authMsg", "Email နဲ့ Password ဖြည့်ပါ။");
    return;
  }

  if (password.length < 6) {
    setMessage("authMsg", "Password အနည်းဆုံး 6 လုံးရှိရပါမယ်။");
    return;
  }

  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password
    });

    if (error) {
      setMessage("authMsg", "❌ " + error.message);
      return;
    }

    if (data.session) {
      currentUser = data.user;
      setMessage("authMsg", "✅ Account created!");
      await showApp();
    } else {
      setMessage(
        "authMsg",
        "✅ Account created. Email confirmation လိုရင် Email ကိုစစ်ပါ။"
      );
    }

  } catch (err) {
    console.error(err);
    setMessage("authMsg", "❌ " + err.message);
  }
}

async function logout() {
  await sb.auth.signOut();
  currentUser = null;

  if ($("app")) $("app").hidden = true;
  if ($("authCard")) $("authCard").hidden = false;

  setMessage("authMsg", "");
}

// ======================================================
// SHOW APP
// ======================================================

async function showApp() {
  if (!currentUser) return;

  if ($("authCard")) $("authCard").hidden = true;
  if ($("app")) $("app").hidden = false;

  if ($("userEmail")) {
    $("userEmail").textContent = currentUser.email || "";
  }

  await Promise.all([
    loadProfile(),
    loadTasks(),
    loadTransactions(),
    loadWithdrawals(),
    setupReferral(),
    loadAdminTasks(),
    loadAdminWithdrawals()
  ]);
}

// ======================================================
// PROFILE / BALANCE
// ======================================================

async function loadProfile() {
  if (!currentUser) return;

  const { data, error } = await sb
    .from("profiles")
    .select("coin_balance")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    console.error("Profile:", error.message);
    return;
  }

  if ($("balance")) {
    $("balance").textContent = data?.coin_balance ?? 0;
  }
}

// ======================================================
// TASKS
// ======================================================

async function loadTasks() {
  if (!currentUser) return;

  const box = $("tasks");
  if (!box) return;

  box.innerHTML = "Loading...";

  const { data, error } = await sb
    .from("tasks")
    .select("id,title,reward_coins")
    .order("id");

  if (error) {
    box.textContent = "❌ " + error.message;
    return;
  }

  box.innerHTML = "";

  if (!data?.length) {
    box.innerHTML = '<p class="muted">No tasks yet.</p>';
    return;
  }

  for (const task of data) {

    const { data: claim, error: claimError } = await sb
      .from("task_claims")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("task_id", task.id)
      .maybeSingle();

    if (claimError) {
      console.error("Claim check:", claimError.message);
    }

    const div = document.createElement("div");
    div.className = "task";

    if (claim) {
      div.innerHTML = `
        <strong>${escapeHtml(task.title)}</strong>
        <div class="muted">
          Reward: ${Number(task.reward_coins || 0)} Coins
        </div>
        <button disabled>✅ Already Claimed</button>
      `;
    } else {
      div.innerHTML = `
        <strong>${escapeHtml(task.title)}</strong>
        <div class="muted">
          Reward: ${Number(task.reward_coins || 0)} Coins
        </div>
        <button class="claim-btn">Claim Task</button>
      `;

      div.querySelector(".claim-btn").onclick = () => {
        claimTask(task.id);
      };
    }

    box.appendChild(div);
  }
}

async function claimTask(taskId) {
  if (!currentUser) return;

  const { data, error } = await sb.rpc("claim_task", {
    p_task_id: taskId
  });

  if (error) {
    alert("❌ " + error.message);
    return;
  }

  alert(`✅ Success! +${data} Coins`);

  await Promise.all([
    loadProfile(),
    loadTasks(),
    loadTransactions()
  ]);
}

// ======================================================
// TRANSACTIONS
// ======================================================

async function loadTransactions() {
  if (!currentUser) return;

  const box = $("transactions");
  if (!box) return;

  const { data, error } = await sb
    .from("coin_transactions")
    .select("amount,type,created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(30);

  box.innerHTML = "";

  if (error) {
    box.textContent = "❌ " + error.message;
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p class="muted">No transactions yet.</p>';
    return;
  }

  for (const t of data) {
    const div = document.createElement("div");
    div.className = "tx";

    let label = t.type;

    if (t.type === "task_reward") {
      label = "🎯 Task Reward";
    } else if (t.type === "withdrawal_approved") {
      label = "💳 Withdrawal Approved";
    } else if (t.type === "withdrawal_rejected_refund") {
      label = "↩️ Withdrawal Refund";
    }

    const prefix = Number(t.amount) >= 0 ? "+" : "";

    div.innerHTML = `
      <strong>${prefix}${Number(t.amount)} Coins</strong>
      · ${escapeHtml(label)}
      <div class="muted">
        ${new Date(t.created_at).toLocaleString()}
      </div>
    `;

    box.appendChild(div);
  }
}

// ======================================================
// WITHDRAWAL
// ======================================================

async function withdraw() {
  if (!currentUser) return;

  const amount = Number($("withdrawAmount")?.value);
  const method = $("paymentMethod")?.value;
  const account = $("paymentAccount")?.value.trim();

  setMessage("withdrawMsg", "");

  if (!Number.isInteger(amount) || amount <= 0) {
    setMessage("withdrawMsg", "Amount မှန်မှန်ထည့်ပါ။");
    return;
  }

  if (!account) {
    setMessage("withdrawMsg", "Demo account / phone ဖြည့်ပါ။");
    return;
  }

  const { data, error } = await sb.rpc("request_withdrawal", {
    p_amount: amount,
    p_payment_method: method,
    p_payment_account: account
  });

  if (error) {
    setMessage("withdrawMsg", "❌ " + error.message);
    return;
  }

  setMessage(
    "withdrawMsg",
    `✅ Withdrawal request #${data} submitted.`
  );

  $("withdrawAmount").value = "";
  $("paymentAccount").value = "";

  await Promise.all([
    loadProfile(),
    loadTransactions(),
    loadWithdrawals()
  ]);
}

async function loadWithdrawals() {
  if (!currentUser) return;

  const box = $("withdrawals");
  if (!box) return;

  const { data, error } = await sb
    .from("withdrawals")
    .select("id,amount,status,payment_method,created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(20);

  box.innerHTML = "";

  if (error) {
    box.textContent = "❌ " + error.message;
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p class="muted">No withdrawals yet.</p>';
    return;
  }

  for (const w of data) {
    const div = document.createElement("div");
    div.className = "tx";

    div.innerHTML = `
      <strong>Withdrawal #${w.id}</strong>
      · ${Number(w.amount)} Coins
      <div class="muted">
        ${escapeHtml(w.payment_method)}
      </div>
      <div class="withdraw-status ${escapeHtml(w.status)}">
        ${escapeHtml(w.status)}
      </div>
      <div class="muted">
        ${new Date(w.created_at).toLocaleString()}
      </div>
    `;

    box.appendChild(div);
  }
}

// ======================================================
// ADMIN - TASKS
// ======================================================

async function isAdmin() {
  if (!currentUser) return false;

  const { data, error } = await sb
    .from("admins")
    .select("user_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Admin check:", error.message);
    return false;
  }

  return !!data;
}

async function loadAdminTasks() {
  const card = $("adminCard");
  const box = $("adminTasks");

  if (!card || !box || !currentUser) return;

  const admin = await isAdmin();

  if (!admin) {
    card.hidden = true;
    return;
  }

  card.hidden = false;
  box.innerHTML = "Loading...";

  const { data, error } = await sb
    .from("tasks")
    .select("id,title,reward_coins")
    .order("id");

  if (error) {
    box.textContent = "❌ " + error.message;
    return;
  }

  box.innerHTML = "";

  if (!data?.length) {
    box.innerHTML = '<p class="muted">No tasks yet.</p>';
    return;
  }

  for (const task of data) {
    const div = document.createElement("div");
    div.className = "tx";

    div.innerHTML = `
      <strong>#${task.id} · ${escapeHtml(task.title)}</strong>
      <div class="muted">
        Reward: ${Number(task.reward_coins)} Coins
      </div>
      <button class="edit-task">✏️ Edit</button>
      <button class="delete-task">🗑️ Delete</button>
    `;

    div.querySelector(".edit-task").onclick = () => {
      editTask(task.id, task.title, task.reward_coins);
    };

    div.querySelector(".delete-task").onclick = () => {
      deleteTask(task.id);
    };

    box.appendChild(div);
  }
}

async function addTask() {
  if (!(await isAdmin())) {
    setMessage("taskMsg", "❌ Admin only.");
    return;
  }

  const title = $("taskTitle")?.value.trim();
  const reward = Number($("taskReward")?.value);

  setMessage("taskMsg", "");

  if (!title || !Number.isInteger(reward) || reward <= 0) {
    setMessage("taskMsg", "Task title နဲ့ Reward Coins ဖြည့်ပါ။");
    return;
  }

  const { error } = await sb
    .from("tasks")
    .insert({
      title,
      reward_coins: reward
    });

  if (error) {
    setMessage("taskMsg", "❌ " + error.message);
    return;
  }

  setMessage("taskMsg", "✅ Task added successfully!");

  $("taskTitle").value = "";
  $("taskReward").value = "";

  await Promise.all([
    loadTasks(),
    loadAdminTasks()
  ]);
}

async function editTask(id, oldTitle, oldReward) {
  if (!(await isAdmin())) {
    alert("Admin only.");
    return;
  }

  const title = prompt("Task title:", oldTitle);
  if (title === null) return;

  const rewardInput = prompt("Reward Coins:", oldReward);
  if (rewardInput === null) return;

  const reward = Number(rewardInput);

  if (!title.trim() || !Number.isInteger(reward) || reward <= 0) {
    alert("Task title နဲ့ Reward Coins မှန်မှန်ထည့်ပါ။");
    return;
  }

  const { error } = await sb
    .from("tasks")
    .update({
      title: title.trim(),
      reward_coins: reward
    })
    .eq("id", id);

  if (error) {
    alert("❌ " + error.message);
    return;
  }

  alert("✅ Task updated!");

  await Promise.all([
    loadTasks(),
    loadAdminTasks()
  ]);
}

async function deleteTask(id) {
  if (!(await isAdmin())) {
    alert("Admin only.");
    return;
  }

  if (!confirm(`Task #${id} ကို ဖျက်မလား?`)) {
    return;
  }

  const { error } = await sb
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) {
    alert("❌ " + error.message);
    return;
  }

  alert("🗑️ Task deleted!");

  await Promise.all([
    loadTasks(),
    loadAdminTasks()
  ]);
}

// ======================================================
// ADMIN - WITHDRAWALS
// ======================================================

async function loadAdminWithdrawals() {
  const card = $("adminCard");
  const box = $("adminWithdrawals");

  if (!card || !box || !currentUser) return;

  const admin = await isAdmin();

  if (!admin) {
    card.hidden = true;
    return;
  }

  card.hidden = false;

  const { data, error } = await sb
    .from("withdrawals")
    .select(
      "id,user_id,amount,status,payment_method,payment_account,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  box.innerHTML = "";

  if (error) {
    box.textContent = "❌ " + error.message;
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p class="muted">No withdrawals yet.</p>';
    return;
  }

  for (const w of data) {
    const div = document.createElement("div");
    div.className = "tx";

    div.innerHTML = `
      <strong>
        Withdrawal #${w.id} · ${Number(w.amount)} Coins
      </strong>

      <div class="muted">
        ${escapeHtml(w.payment_method)}
      </div>

      <div class="muted">
        ${escapeHtml(w.payment_account)}
      </div>

      <div class="muted">
        Status: ${escapeHtml(w.status)}
      </div>

      <div class="muted">
        ${new Date(w.created_at).toLocaleString()}
      </div>

      ${
        w.status === "pending"
          ? `
            <button class="approve-btn">✅ Approve</button>
            <button class="reject-btn">❌ Reject</button>
          `
          : ""
      }
    `;

    if (w.status === "pending") {
      div.querySelector(".approve-btn").onclick = () => {
        updateWithdrawalStatus(w.id, "approved");
      };

      div.querySelector(".reject-btn").onclick = () => {
        updateWithdrawalStatus(w.id, "rejected");
      };
    }

    box.appendChild(div);
  }
}

async function updateWithdrawalStatus(id, status) {
  if (!(await isAdmin())) {
    alert("Admin only.");
    return;
  }

  const { error } = await sb.rpc(
    "update_withdrawal_status",
    {
      p_withdrawal_id: id,
      p_status: status
    }
  );

  if (error) {
    alert("❌ " + error.message);
    return;
  }

  alert(`✅ Withdrawal #${id} → ${status}`);

  await Promise.all([
    loadAdminWithdrawals(),
    loadProfile(),
    loadTransactions(),
    loadWithdrawals()
  ]);
}

// ======================================================
// REFERRAL
// ======================================================

async function setupReferral() {
  if (!currentUser) return;

  const linkInput = $("referralLink");

  if (!linkInput) return;

  const { data, error } = await sb
    .from("profiles")
    .select("referral_code")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    setMessage("referralMsg", error.message);
    return;
  }

  let code = data?.referral_code;

  if (!code) {
    code = crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();

    const { error: updateError } = await sb
      .from("profiles")
      .update({
        referral_code: code
      })
      .eq("id", currentUser.id);

    if (updateError) {
      setMessage("referralMsg", updateError.message);
      return;
    }
  }

  const link =
    `${location.origin}${location.pathname}?ref=${encodeURIComponent(code)}`;

  linkInput.value = link;
}

async function copyReferral() {
  const link = $("referralLink")?.value;

  if (!link) return;

  try {
    await navigator.clipboard.writeText(link);
    setMessage("referralMsg", "✅ Invite Link copied!");
  } catch (err) {
    setMessage("referralMsg", "❌ Copy မလုပ်နိုင်ပါ။");
  }
}

// ======================================================
// EVENTS
// ======================================================

function setupEvents() {

  // Register
  const signupBtn = $("signupBtn");

  if (signupBtn) {
    signupBtn.onclick = signup;
  }

  // Logout
  const logoutBtn = $("logoutBtn");

  if (logoutBtn) {
    logoutBtn.onclick = logout;
  }

  // Withdrawal
  const withdrawBtn = $("withdrawBtn");

  if (withdrawBtn) {
    withdrawBtn.onclick = withdraw;
  }

  // Referral copy
  const copyReferralBtn = $("copyReferralBtn");

  if (copyReferralBtn) {
    copyReferralBtn.onclick = copyReferral;
  }
}

// ======================================================
// START APP
// ======================================================

(async function init() {

  setupEvents();

  if (
    !SUPABASE_URL ||
    !SUPABASE_KEY ||
    SUPABASE_URL.includes("YOUR_") ||
    SUPABASE_KEY.includes("YOUR_")
  ) {
    setMessage(
      "authMsg",
      "❌ app.js ထဲမှာ Supabase URL နဲ့ Publishable/Anon key ထည့်ပါ။"
    );
    return;
  }

  try {

    const { data, error } = await sb.auth.getSession();

    if (error) {
      setMessage("authMsg", "❌ " + error.message);
      return;
    }

    if (data?.session?.user) {

      currentUser = data.session.user;

      await showApp();

    } else {

      if ($("authCard")) {
        $("authCard").hidden = false;
      }

      if ($("app")) {
        $("app").hidden = true;
      }
    }

  } catch (err) {

    console.error(err);

    setMessage(
      "authMsg",
      "❌ " + err.message
    );
  }

})();