// Coin Win Myanmar - Supabase frontend

const SUPABASE_URL = "https://oymkceiqfchtvcxdltor.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95bWtjZWlxZmNodHZjeGRsdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjA4MjcsImV4cCI6MjEwNDg5NjgyN30.KPwCk-8OKrHxzyt746hjccSzbUHKTA1AI3LNSjk4rPg";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function setMessage(id, message) {
  const el = $(id);
  if (el) el.textContent = message;
}


// =========================
// LOGIN
// =========================

async function login() {
  const msg = $("authMsg");

  const email = $("email")?.value.trim();
  const password = $("password")?.value;

  if (!email || !password) {
    if (msg) msg.textContent = "❌ Email နဲ့ Password ဖြည့်ပါ။";
    return;
  }

  if (msg) {
    msg.textContent = "🔄 Login လုပ်နေပါတယ်...";
  }

  try {
    const { data, error } =
      await sb.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      console.error(error);

      if (msg) {
        msg.textContent = "❌ " + error.message;
      }

      return;
    }

    currentUser = data.user;

    if (msg) {
      msg.textContent = "✅ Login အောင်မြင်ပါပြီ။";
    }

    await showApp();

  } catch (err) {
    console.error(err);

    if (msg) {
      msg.textContent = "❌ " + err.message;
    }
  }
}


// =========================
// SHOW APP
// =========================

async function showApp() {

  const authCard = $("authCard");
  const app = $("app");

  if (authCard) authCard.hidden = true;
  if (app) app.hidden = false;

  if ($("userEmail")) {
    $("userEmail").textContent = currentUser?.email || "";
  }

  await Promise.all([
    loadProfile(),
    loadTasks(),
    loadTransactions(),
    loadWithdrawals(),
    loadAdminTasks(),
    loadAdminWithdrawals(),
    setupReferral()
  ]);
}


// =========================
// PROFILE
// =========================

async function loadProfile() {
  if (!currentUser) return;

  const balanceBox = $("balance");

  if (balanceBox) {
    balanceBox.textContent = "Loading...";
  }

  const { data, error } = await sb
    .from("profiles")
    .select("coin_balance")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    console.error("PROFILE ERROR:", error);

    if (balanceBox) {
      balanceBox.textContent = "ERROR";
    }

    alert(
      "Profile Balance Error:\n" +
      error.message
    );

    return;
  }

  console.log("CURRENT USER:", currentUser.id);
  console.log("BALANCE:", data.coin_balance);

  if (balanceBox) {
    balanceBox.textContent =
      data.coin_balance ?? 0;
  }
}


// =========================
// TASKS
// =========================

async function loadTasks() {
  const box = $("tasks");

  if (!box) return;

  box.innerHTML = "";

  const { data, error } = await sb
    .from("tasks")
    .select("id,title,reward_coins")
    .order("id");

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

    // 🎥 Watch video
    if (
      task.title.toLowerCase().includes("watch video") &&
      !claim
    ) {

      div.innerHTML = `
        <strong>🎥 ${escapeHtml(task.title)}</strong>

        <div class="muted">
          Reward: ${task.reward_coins} Coins
        </div>

        <button class="watchBtn">
          ▶️ Watch Video
        </button>

        <button class="claimBtn" disabled>
          🔒 Claim after watching
        </button>

        <p class="videoMsg muted"></p>
      `;

      const watchBtn = div.querySelector(".watchBtn");
      const claimBtn = div.querySelector(".claimBtn");
      const videoMsg = div.querySelector(".videoMsg");

      watchBtn.onclick = () => {

        videoMsg.textContent =
          "🎬 Video ကြည့်နေပါတယ်...";

        watchBtn.disabled = true;

        setTimeout(() => {

          videoMsg.textContent =
            "✅ Video ကြည့်ပြီးပါပြီ။ Claim လုပ်နိုင်ပါပြီ။";

          claimBtn.disabled = false;

        }, 5000);
      };

      claimBtn.onclick = () => {
        claimTask(task.id);
      };

    }

    // Already claimed
    else if (claim) {

      div.innerHTML = `
        <strong>${escapeHtml(task.title)}</strong>

        <div class="muted">
          Reward: ${task.reward_coins} Coins
        </div>

        <button disabled>
          ✅ Already Claimed
        </button>
      `;

    }

    // Normal task
    else {

      div.innerHTML = `
        <strong>${escapeHtml(task.title)}</strong>

        <div class="muted">
          Reward: ${task.reward_coins} Coins
        </div>

        <button>
          Claim Task
        </button>
      `;

      div.querySelector("button").onclick = () =>
        claimTask(task.id);
    }

    box.appendChild(div);
  }
}

// =========================
// CLAIM TASK
// =========================

async function claimTask(taskId) {

  const { data, error } = await sb.rpc(
    "claim_task",
    {
      p_task_id: taskId
    }
  );

  if (error) {
    alert(error.message);
    return;
  }

  alert(`Success! +${data} Coins`);

  await Promise.all([
    loadProfile(),
    loadTransactions(),
    loadTasks()
  ]);
}


// =========================
// TRANSACTIONS
// =========================

async function loadTransactions() {

  const box = $("transactions");

  if (!box) return;

  box.innerHTML = "";

  const { data, error } = await sb
    .from("coin_transactions")
    .select("amount,type,created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", {
      ascending: false
    })
    .limit(30);

  if (error) {
    box.textContent = error.message;
    return;
  }

  if (!data?.length) {
    box.innerHTML =
      '<p class="muted">No transactions yet.</p>';
    return;
  }

  for (const t of data) {

    let label = t.type;

    if (t.type === "task_reward") {
      label = "🎯 Task Reward";
    }

    if (t.type === "withdrawal_approved") {
      label = "💳 Withdrawal Approved";
    }

    if (t.type === "withdrawal_rejected_refund") {
      label = "↩️ Withdrawal Refund";
    }

    const prefix = t.amount >= 0 ? "+" : "";

    const div = document.createElement("div");

    div.className = "tx";

    div.innerHTML = `
      <strong>
        ${prefix}${t.amount} Coins
      </strong>
      · ${escapeHtml(label)}

      <div class="muted">
        ${new Date(t.created_at).toLocaleString()}
      </div>
    `;

    box.appendChild(div);
  }
}


// =========================
// WITHDRAWALS
// =========================

async function loadWithdrawals() {

  const box = $("withdrawals");

  if (!box) return;

  box.innerHTML = "";

  const { data, error } = await sb
    .from("withdrawals")
    .select(
      "id,amount,status,payment_method,created_at"
    )
    .eq("user_id", currentUser.id)
    .order("created_at", {
      ascending: false
    })
    .limit(20);

  if (error) {
    box.textContent = error.message;
    return;
  }

  if (!data?.length) {
    box.innerHTML =
      '<p class="muted">No withdrawals yet.</p>';
    return;
  }

  for (const w of data) {

    const div = document.createElement("div");

    div.className = "tx";

    div.innerHTML = `
      <strong>
        Withdrawal #${w.id}
      </strong>
      · ${w.amount} Coins

      <div class="muted">
        ${escapeHtml(w.payment_method)}
      </div>

      <span class="withdraw-status ${escapeHtml(w.status)}">
        ${escapeHtml(w.status)}
      </span>

      <div class="muted">
        ${new Date(w.created_at).toLocaleString()}
      </div>
    `;

    box.appendChild(div);
  }
}


// =========================
// REQUEST WITHDRAWAL
// =========================

async function withdraw() {

  const amount = Number(
    $("withdrawAmount")?.value
  );

  const method =
    $("paymentMethod")?.value;

  const account =
    $("paymentAccount")?.value.trim();

  const msg = $("withdrawMsg");

  if (msg) msg.textContent = "";

  if (!amount || amount <= 0 || !account) {

    if (msg) {
      msg.textContent =
        "Amount နဲ့ Demo account ဖြည့်ပါ။";
    }

    return;
  }

  const { data, error } = await sb.rpc(
    "request_withdrawal",
    {
      p_amount: amount,
      p_payment_method: method,
      p_payment_account: account
    }
  );

  if (error) {

    if (msg) msg.textContent = error.message;

    return;
  }

  if (msg) {
    msg.textContent =
      `Withdrawal request #${data} submitted (pending).`;
  }

  await Promise.all([
    loadProfile(),
    loadTasks(),
    loadTransactions(),
    loadWithdrawals()
  ]);
}


// =========================
// ADMIN TASKS
// =========================

async function loadAdminTasks() {

  const box = $("adminTasks");

  if (!box) return;

  box.innerHTML = "";

  const { data: admin } = await sb
    .from("admins")
    .select("user_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!admin) return;

  const { data, error } = await sb
    .from("tasks")
    .select("id,title,reward_coins")
    .order("id");

  if (error) {
    box.textContent = error.message;
    return;
  }

  for (const task of data || []) {

    const div = document.createElement("div");

    div.className = "tx";

    div.innerHTML = `
      <strong>
        #${task.id} · ${escapeHtml(task.title)}
      </strong>

      <div class="muted">
        Reward: ${task.reward_coins} Coins
      </div>

      <button>
        ✏️ Edit
      </button>

      <button>
        🗑️ Delete
      </button>
    `;

    const buttons = div.querySelectorAll("button");

    buttons[0].onclick = () =>
      editTask(
        task.id,
        task.title,
        task.reward_coins
      );

    buttons[1].onclick = () =>
      deleteTask(task.id);

    box.appendChild(div);
  }
}


// =========================
// EDIT TASK
// =========================

async function editTask(
  id,
  oldTitle,
  oldReward
) {

  const title = prompt(
    "Task title:",
    oldTitle
  );

  if (title === null) return;

  const rewardInput = prompt(
    "Reward Coins:",
    oldReward
  );

  if (rewardInput === null) return;

  const reward = Number(rewardInput);

  if (
    !title.trim() ||
    !Number.isInteger(reward) ||
    reward <= 0
  ) {
    alert(
      "Task title နဲ့ Reward Coins မှန်မှန်ထည့်ပါ။"
    );
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


// =========================
// DELETE TASK
// =========================

async function deleteTask(id) {

  if (!confirm(`Task #${id} ကို ဖျက်မလား?`)) {
    return;
  }

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


// =========================
// ADD TASK
// =========================

async function addTask() {

  const title =
    $("taskTitle")?.value.trim();

  const reward =
    Number($("taskReward")?.value);

  const msg = $("taskMsg");

  if (!title || !reward || reward <= 0) {

    if (msg) {
      msg.textContent =
        "Task title နဲ့ Reward Coins ဖြည့်ပါ။";
    }

    return;
  }

  const { error } = await sb
    .from("tasks")
    .insert({
      title,
      reward_coins: reward
    });

  if (error) {

    if (msg) msg.textContent = error.message;

    return;
  }

  if (msg) {
    msg.textContent =
      "✅ Task added successfully!";
  }

  $("taskTitle").value = "";
  $("taskReward").value = "";

  await Promise.all([
    loadTasks(),
    loadAdminTasks()
  ]);
}


// =========================
// ADMIN WITHDRAWALS
// =========================

async function loadAdminWithdrawals() {

  const adminCard = $("adminCard");
  const box = $("adminWithdrawals");

  if (!adminCard || !box) return;

  const { data: admin } = await sb
    .from("admins")
    .select("user_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!admin) {

    adminCard.hidden = true;

    return;
  }

  adminCard.hidden = false;

  const { data, error } = await sb
    .from("withdrawals")
    .select(
      "id,user_id,amount,status,payment_method,payment_account,created_at"
    )
    .order("created_at", {
      ascending: false
    })
    .limit(50);

  if (error) {

    box.textContent = error.message;

    return;
  }

  box.innerHTML = "";

  if (!data?.length) {

    box.innerHTML =
      '<p class="muted">No withdrawals yet.</p>';

    return;
  }

  for (const w of data) {

    const div = document.createElement("div");

    div.className = "tx";

    div.innerHTML = `
      <strong>
        Withdrawal #${w.id} · ${w.amount} Coins
      </strong>

      <div class="muted">
        ${escapeHtml(w.payment_method)}
        · ${escapeHtml(w.status)}
      </div>

      <div class="muted">
        ${escapeHtml(w.payment_account)}
      </div>

      <div class="muted">
        ${new Date(w.created_at).toLocaleString()}
      </div>
    `;

    if (w.status === "pending") {

      const approve =
        document.createElement("button");

      approve.textContent = "✅ Approve";

      approve.onclick = () =>
        updateWithdrawalStatus(
          w.id,
          "approved"
        );

      const reject =
        document.createElement("button");

      reject.textContent = "❌ Reject";

      reject.onclick = () =>
        updateWithdrawalStatus(
          w.id,
          "rejected"
        );

      div.appendChild(approve);
      div.appendChild(reject);
    }

    box.appendChild(div);
  }
}


// =========================
// UPDATE WITHDRAWAL
// =========================

async function updateWithdrawalStatus(
  id,
  status
) {

  const { error } = await sb.rpc(
    "update_withdrawal_status",
    {
      p_withdrawal_id: id,
      p_status: status
    }
  );

  if (error) {

    alert(error.message);

    return;
  }

  alert(
    `Withdrawal #${id} → ${status}`
  );

  await Promise.all([
    loadAdminWithdrawals(),
    loadProfile(),
    loadWithdrawals(),
    loadTransactions()
  ]);
}


// =========================
// REFERRAL
// =========================

async function setupReferral() {

  const linkBox = $("referralLink");

  if (!linkBox) return;

  const { data, error } = await sb
    .from("profiles")
    .select("referral_code")
    .eq("id", currentUser.id)
    .single();

  if (error) {

    console.log(
      "Referral setup skipped:",
      error.message
    );

    return;
  }

  let code = data?.referral_code;

  if (!code) {

    code = crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();

    const { error: updateError } =
      await sb
        .from("profiles")
        .update({
          referral_code: code
        })
        .eq("id", currentUser.id);

    if (updateError) {

      console.log(
        "Referral code update skipped:",
        updateError.message
      );

      return;
    }
  }

  linkBox.value =
    `${location.origin}${location.pathname}?ref=${encodeURIComponent(code)}`;
}


// =========================
// REFERRAL BONUS
// =========================

async function saveReferralBonus() {

  const bonusInput = $("referralBonus");
  const msg = $("referralMsg");

  const bonus = Number(bonusInput?.value);

  if (!Number.isInteger(bonus) || bonus <= 0) {
    if (msg) {
      msg.textContent = "Referral Bonus Coins မှန်မှန်ထည့်ပါ။";
    }
    return;
  }

  if (msg) {
    msg.textContent = "Saving...";
  }

  const { data, error } = await sb
    .from("app_settings")
    .update({ value: bonus })
    .eq("key", "referral_bonus_coins")
    .select();

  if (error) {
    if (msg) {
      msg.textContent = "❌ " + error.message;
    }
    return;
  }

  if (!data || data.length === 0) {
    if (msg) {
      msg.textContent =
        "❌ referral_bonus_coins row မတွေ့ပါ။";
    }
    return;
  }

  if (msg) {
    msg.textContent =
      `✅ Referral Bonus = ${bonus} Coins`;
  }
}

async function logoutUser() {
  await sb.auth.signOut();
  location.reload();
}

// =========================
// EVENTS
// =========================

document.addEventListener("DOMContentLoaded", () => {

  const signupBtn = $("signupBtn");

  if (signupBtn && typeof signup === "function") {
  signupBtn.onclick = signup;
}

  const logoutBtn = $("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", logoutUser);
}

  const withdrawBtn = $("withdrawBtn");

  if (withdrawBtn) {
    withdrawBtn.onclick = withdraw;
  }

  const copyReferralBtn = $("copyReferralBtn");

  if (copyReferralBtn) {

    copyReferralBtn.onclick = function () {

      const linkBox = $("referralLink");
      const msg = $("referralMsg");

      if (!linkBox) {
        alert("Referral Link box မတွေ့ပါ။");
        return;
      }

      if (!linkBox.value) {
        alert("Invite Link မရှိသေးပါ။");
        return;
      }

      linkBox.focus();
      linkBox.select();

      try {

        const copied = document.execCommand("copy");

        if (copied) {
          if (msg) {
            msg.textContent = "✅ Invite Link copied!";
          }
        } else {
          if (msg) {
            msg.textContent =
              "📋 Link ကို ဖိထားပြီး Copy လုပ်ပါ။";
          }
        }

      } catch (err) {

        console.error("COPY ERROR:", err);

        if (msg) {
          msg.textContent =
            "📋 Link ကို ဖိထားပြီး Copy လုပ်ပါ။";
        }
      }
    };
  }

});

// =========================
// AUTO LOGIN
// =========================

(async () => {

  try {

    const { data } =
      await sb.auth.getSession();

    if (data.session) {

      currentUser =
        data.session.user;

      await showApp();
    }

  } catch (err) {

    console.error(err);

    setMessage(
      "authMsg",
      "❌ " + err.message
    );
  }

})();