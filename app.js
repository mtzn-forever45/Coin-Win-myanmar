// Coin Win Myanmar - Supabase frontend starter
// IMPORTANT: Put ONLY your Supabase Project URL and Publishable/Anon key here.
// NEVER put a Supabase Secret/Service Role key in this file.

const SUPABASE_URL = "https://oymkceiqfchtvcxdltor.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95bWtjZWlxZmNodHZjeGRsdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjA4MjcsImV4cCI6MjEwNDg5NjgyN30.KPwCk-8OKrHxzyt746hjccSzbUHKTA1AI3LNSjk4rPg";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;

const $ = id => document.getElementById(id);

async function login() {
  const { data, error } = await sb.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });
  if (error) return $("authMsg").textContent = error.message;
  currentUser = data.user;
  await showApp();
}

async function signup() {
  const { data, error } = await sb.auth.signUp({
    email: $("email").value.trim(),
    password: $("password").value
  });
  if (error) return $("authMsg").textContent = error.message;
  $("authMsg").textContent = data.session
    ? "Account created."
    : "Account created. Check your email if confirmation is enabled.";
}

async function showApp() {
  $("authCard").hidden = true;
  $("app").hidden = false;
  $("userEmail").textContent = currentUser.email || "";

  await Promise.all([
    loadProfile(),
    loadTasks(),
    loadTransactions(),
    loadWithdrawals()
  ]);

  await Promise.all([
    loadAdminWithdrawals(),
    loadAdminTasks()
  ]);
}

  async function loadAdminWithdrawals() {
  const adminCard = $("adminCard");
  const box = $("adminWithdrawals");

  const { data: admin, error: adminError } = await sb
    .from("admins")
    .select("user_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (adminError || !admin) {
    adminCard.hidden = true;
    return;
  }

  adminCard.hidden = false;

  const { data, error } = await sb
    .from("withdrawals")
    .select("id,user_id,amount,status,payment_method,payment_account,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  box.innerHTML = "";

  if (error) {
    box.textContent = error.message;
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
      <strong>Withdrawal #${w.id} · ${w.amount} Coins</strong>
      <div class="muted">${escapeHtml(w.payment_method)} · ${escapeHtml(w.status)}</div>
      <div class="muted">${escapeHtml(w.payment_account)}</div>
      <div class="muted">${new Date(w.created_at).toLocaleString()}</div>

      ${
        w.status === "pending"
          ? `
            <button onclick="updateWithdrawalStatus(${w.id}, 'approved')">
              ✅ Approve
            </button>
            <button onclick="updateWithdrawalStatus(${w.id}, 'rejected')">
              ❌ Reject
            </button>
          `
          : ""
      }
    `;

    box.appendChild(div);
  }
}

async function updateWithdrawalStatus(id, status) {
  const { error } = await sb.rpc("update_withdrawal_status", {
    p_withdrawal_id: id,
    p_status: status
  });

  if (error) {
    alert(error.message);
    return;
  }

  alert(`Withdrawal #${id} → ${status}`);

  await Promise.all([
    loadAdminWithdrawals(),
    loadProfile()
  ]);
}

async function loadAdminTasks() {
  const box = $("adminTasks");
  box.innerHTML = "";

  const { data: admin, error: adminError } = await sb
    .from("admins")
    .select("user_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (adminError || !admin) {
    return;
  }

  const { data, error } = await sb
    .from("tasks")
    .select("id,title,reward_coins")
    .order("id");

  if (error) {
    box.textContent = error.message;
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p class="muted">No tasks yet.</p>';
    return;
  }

  for (const task of data) {
    const div = document.createElement("div");
    div.className = "tx";

    div.innerHTML = `
      <strong>#${task.id} · ${escapeHtml(task.title)}</strong>
      <div class="muted">Reward: ${task.reward_coins} Coins</div>
      <button onclick="editTask(${task.id}, '${escapeHtml(task.title)}', ${task.reward_coins})">
  ✏️ Edit
</button>

<button onclick="deleteTask(${task.id})">
  🗑️ Delete
</button>
`;
    box.appendChild(div);
  }
}

async function editTask(id, oldTitle, oldReward) {
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
    alert(error.message);
    return;
  }

  alert("✅ Task updated!");
  await Promise.all([
    loadAdminTasks(),
    loadTasks()
  ]);
}
async function deleteTask(id) {
  const ok = confirm(`Task #${id} ကို ဖျက်မလား?`);
  if (!ok) return;

  const { error } = await sb
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  alert("🗑️ Task deleted!");

  await Promise.all([
    loadAdminTasks(),
    loadTasks()
  ]);
}

async function loadProfile() {
  const { data, error } = await sb.from("profiles")
    .select("coin_balance")
    .eq("id", currentUser.id)
    .single();
  if (!error) $("balance").textContent = data.coin_balance ?? 0;
}

async function loadTasks() {
  const { data, error } = await sb.from("tasks")
    .select("id,title,reward_coins")
    .order("id");

  const box = $("tasks");
  box.innerHTML = "";

  if (error) {
    box.textContent = error.message;
    return;
  }

  for (const task of data || []) {
    const { data: claim } = await sb
      .from("task_claims")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("task_id", task.id)
      .maybeSingle();

    const div = document.createElement("div");
    div.className = "task";

    if (claim) {
      div.innerHTML = `
        <strong>${escapeHtml(task.title)}</strong>
        <div class="muted">Reward: ${task.reward_coins} Coins</div>
        <button disabled>✅ Already Claimed</button>
      `;
    } else {
      div.innerHTML = `
        <strong>${escapeHtml(task.title)}</strong>
        <div class="muted">Reward: ${task.reward_coins} Coins</div>
        <button>Claim Task</button>
      `;

      div.querySelector("button").onclick = () => claimTask(task.id);
    }

    box.appendChild(div);
  }
}

async function addTask() {
  const title = $("taskTitle").value.trim();
  const reward = Number($("taskReward").value);
  const msg = $("taskMsg");

  msg.textContent = "";

  if (!title || !reward || reward <= 0) {
    msg.textContent = "Task title နဲ့ Reward Coins ဖြည့်ပါ။";
    return;
  }

  const { error } = await sb
    .from("tasks")
    .insert({
      title: title,
      reward_coins: reward
    });

  if (error) {
    msg.textContent = error.message;
    return;
  }

  msg.textContent = "✅ Task added successfully!";

  $("taskTitle").value = "";
  $("taskReward").value = "";

  await loadTasks();
}

async function saveReferralBonus() {
  const bonus = Number($("referralBonus").value);
  const msg = $("referralMsg");

  msg.textContent = "";

  if (!Number.isInteger(bonus) || bonus <= 0) {
    msg.textContent = "Referral Bonus Coins မှန်မှန်ထည့်ပါ။";
    return;
  }

  const { error } = await sb
    .from("app_settings")
    .update({ value: bonus })
    .eq("key", "referral_bonus_coins");

  if (error) {
    msg.textContent = "❌ " + error.message;
    return;
  }

  msg.textContent = `✅ Referral Bonus = ${bonus} Coins`;
}

async function claimTask(taskId) {
  const { data, error } = await sb.rpc("claim_task", { p_task_id: taskId });
  if (error) {
    alert(error.message);
    return;
  }
  alert(`Success! +${data} Coins`);
  await Promise.all([loadProfile(), loadTransactions(), loadTasks()]);
}

async function loadTransactions() {
  const { data, error } = await sb.from("coin_transactions")
    .select("amount,type,created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const box = $("transactions");
  box.innerHTML = "";

  if (error) {
    box.textContent = error.message;
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
    let prefix = t.amount >= 0 ? "+" : "";

    if (t.type === "task_reward") {
      label = "🎯 Task Reward";
    } else if (t.type === "withdrawal_approved") {
      label = "💳 Withdrawal Approved";
    } else if (t.type === "withdrawal_rejected_refund") {
      label = "↩️ Withdrawal Refund";
    }

    div.innerHTML = `
      <strong>${prefix}${t.amount} Coins</strong> · ${escapeHtml(label)}
      <div class="muted">${new Date(t.created_at).toLocaleString()}</div>
    `;

    box.appendChild(div);
  }
}
async function loadWithdrawals() {
  const { data, error } = await sb.from("withdrawals")
    .select("id,amount,status,payment_method,created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const box = $("withdrawals");
  box.innerHTML = "";

  if (error) {
    box.textContent = error.message;
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
      <strong>Withdrawal #${w.id}</strong> · ${w.amount} Coins
      <div class="muted">${escapeHtml(w.payment_method)}</div>
      <span class="withdraw-status ${escapeHtml(w.status)}">
        ${escapeHtml(w.status)}
      </span>
      <div class="muted">${new Date(w.created_at).toLocaleString()}</div>
    `;

    box.appendChild(div);
  }
}

async function withdraw() {
  const amount = Number($("withdrawAmount").value);
  const method = $("paymentMethod").value;
  const account = $("paymentAccount").value.trim();
  $("withdrawMsg").textContent = "";

  if (!amount || amount <= 0 || !account) {
    $("withdrawMsg").textContent = "Amount နဲ့ Demo account ဖြည့်ပါ။";
    return;
  }

  const { data, error } = await sb.rpc("request_withdrawal", {
    p_amount: amount,
    p_payment_method: method,
    p_payment_account: account
  });

  if (error) {
    $("withdrawMsg").textContent = error.message;
    return;
  }

  $("withdrawMsg").textContent =
    `Withdrawal request #${data} submitted (pending).`;

  await Promise.all([
  loadProfile(),
  loadTasks(),
  loadTransactions(),
  loadWithdrawals()
]);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

$("loginBtn").onclick = login;
$("signupBtn").onclick = signup;
$("logoutBtn").onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};
$("withdrawBtn").onclick = withdraw;

(async () => {
  if (SUPABASE_URL.includes("PASTE_") || SUPABASE_KEY.includes("PASTE_")) {
    $("authMsg").textContent = "app.js ထဲမှာ Supabase URL နဲ့ Publishable/Anon key ထည့်ပါ။";
    return;
  }
  const { data } = await sb.auth.getSession();
  if (data.session) {
    currentUser = data.session.user;
    await showApp();
  }
})();

$("saveReferralBonusBtn").onclick = saveReferralBonus;