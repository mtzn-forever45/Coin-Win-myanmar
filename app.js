// ============================================================
// Coin Win Myanmar - Supabase Frontend
// Clean Version - Admin Settings Only
// ============================================================

const SUPABASE_URL =
  "https://oymkceiqfchtvcxdltor.supabase.co";

const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95bWtjZWlxZmNodHZjeGRsdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjA4MjcsImV4cCI6MjEwNDg5NjgyN30.KPwCk-8OKrHxzyt746hjccSzbUHKTA1AI3LNSjk4rPg";

const sb = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;
let currentIsAdmin = false;

const $ = (id) =>
  document.getElementById(id);


// ============================================================
// HELPERS
// ============================================================

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[c]
  );
}

function setMessage(id, message) {
  const el = $(id);

  if (el) {
    el.textContent =
      message || "";
  }
}

function setHidden(id, hidden) {
  const el = $(id);

  if (el) {
    el.hidden = hidden;
  }
}

function isValidPositiveInteger(value) {
  return (
    Number.isInteger(value) &&
    value > 0
  );
}

function formatDate(value) {
  if (!value) return "";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString();
}


// ============================================================
// LOGIN
// ============================================================

async function login() {

  const email =
    $("email")?.value.trim();

  const password =
    $("password")?.value || "";

  if (!email || !password) {

    setMessage(
      "authMsg",
      "❌ Email နဲ့ Password ဖြည့်ပါ။"
    );

    return;
  }

  setMessage(
    "authMsg",
    "🔄 Login လုပ်နေပါတယ်..."
  );

  try {

    const {
      data,
      error
    } =
      await sb.auth.signInWithPassword({
        email,
        password
      });

    if (error) {

      console.error(
        "LOGIN ERROR:",
        error
      );

      setMessage(
        "authMsg",
        "❌ " + error.message
      );

      return;
    }

    currentUser =
      data.user;

    setMessage(
      "authMsg",
      "✅ Login အောင်မြင်ပါပြီ။"
    );

    await showApp();

  } catch (err) {

    console.error(
      "LOGIN ERROR:",
      err
    );

    setMessage(
      "authMsg",
      "❌ " +
      (
        err?.message ||
        "Login failed."
      )
    );
  }
}


// ============================================================
// REGISTER
// ============================================================

async function signup() {

  const email =
    $("email")?.value.trim();

  const password =
    $("password")?.value || "";

  if (!email || !password) {

    setMessage(
      "authMsg",
      "❌ Email နဲ့ Password ဖြည့်ပါ။"
    );

    return;
  }

  if (password.length < 6) {

    setMessage(
      "authMsg",
      "❌ Password အနည်းဆုံး 6 လုံးထည့်ပါ။"
    );

    return;
  }

  setMessage(
    "authMsg",
    "🔄 Register လုပ်နေပါတယ်..."
  );

  try {

    const {
      data,
      error
    } =
      await sb.auth.signUp({
        email,
        password
      });

    if (error) {

      console.error(
        "SIGNUP ERROR:",
        error
      );

      setMessage(
        "authMsg",
        "❌ " + error.message
      );

      return;
    }

    if (
      data.session &&
      data.user
    ) {

      currentUser =
        data.user;

      setMessage(
        "authMsg",
        "✅ Register အောင်မြင်ပါပြီ။"
      );

      await showApp();

    } else {

      setMessage(
        "authMsg",
        "✅ Register အောင်မြင်ပါပြီ။ Email ကို Confirm လုပ်ပြီး Login ဝင်ပါ။"
      );
    }

  } catch (err) {

    console.error(
      "SIGNUP ERROR:",
      err
    );

    setMessage(
      "authMsg",
      "❌ " +
      (
        err?.message ||
        "Registration failed."
      )
    );
  }
}


// ============================================================
// FORGOT PASSWORD
// ============================================================

async function forgotPassword() {

  const email =
    $("email")?.value.trim();

  if (!email) {

    setMessage(
      "authMsg",
      "❌ Password ပြန်ပြောင်းရန် Email ထည့်ပါ။"
    );

    return;
  }

  setMessage(
    "authMsg",
    "🔄 Password reset link ပို့နေပါတယ်..."
  );

  try {

    const redirectTo =
      window.location.origin +
      window.location.pathname;

    const {
      error
    } =
      await sb.auth.resetPasswordForEmail(
        email,
        {
          redirectTo
        }
      );

    if (error) {

      console.error(
        "FORGOT PASSWORD ERROR:",
        error
      );

      setMessage(
        "authMsg",
        "❌ " + error.message
      );

      return;
    }

    setMessage(
      "authMsg",
      "✅ Password reset link ကို Email ထဲ ပို့ပြီးပါပြီ။"
    );

  } catch (err) {

    console.error(
      "FORGOT PASSWORD ERROR:",
      err
    );

    setMessage(
      "authMsg",
      "❌ " +
      (
        err?.message ||
        "Password reset failed."
      )
    );
  }
}


// ============================================================
// UPDATE PASSWORD
// ============================================================

async function updatePassword() {

  const newPassword =
    $("newPassword")?.value || "";

  const confirmPassword =
    $("confirmPassword")?.value || "";

  if (
    !newPassword ||
    !confirmPassword
  ) {

    setMessage(
      "resetPasswordMsg",
      "❌ Password အသစ် နှစ်နေရာလုံး ဖြည့်ပါ။"
    );

    return;
  }

  if (
    newPassword.length < 6
  ) {

    setMessage(
      "resetPasswordMsg",
      "❌ Password အနည်းဆုံး 6 လုံးထည့်ပါ။"
    );

    return;
  }

  if (
    newPassword !==
    confirmPassword
  ) {

    setMessage(
      "resetPasswordMsg",
      "❌ Password နှစ်ခု မတူပါ။"
    );

    return;
  }

  setMessage(
    "resetPasswordMsg",
    "🔄 Password ပြောင်းနေပါတယ်..."
  );

  try {

    const {
      error
    } =
      await sb.auth.updateUser({
        password:
          newPassword
      });

    if (error) {

      setMessage(
        "resetPasswordMsg",
        "❌ " + error.message
      );

      return;
    }

    setMessage(
      "resetPasswordMsg",
      "✅ Password ပြောင်းပြီးပါပြီ။"
    );

    setTimeout(
      async () => {

        await sb.auth.signOut();

        currentUser = null;
        currentIsAdmin = false;

        setHidden(
          "resetPasswordCard",
          true
        );

        setHidden(
          "authCard",
          false
        );

        setHidden(
          "app",
          true
        );

        setMessage(
          "authMsg",
          "✅ Password အသစ်နဲ့ Login ဝင်ပါ။"
        );

      },
      1200
    );

  } catch (err) {

    console.error(
      "UPDATE PASSWORD ERROR:",
      err
    );

    setMessage(
      "resetPasswordMsg",
      "❌ " +
      (
        err?.message ||
        "Password update failed."
      )
    );
  }
}


// ============================================================
// SAVE REFERRAL FROM URL
// ============================================================

(function saveReferralFromUrl() {

  try {

    const params =
      new URLSearchParams(
        window.location.search
      );

    const ref =
      params.get("ref");

    if (ref) {

      localStorage.setItem(
        "pending_referral",
        ref.trim().toUpperCase()
      );
    }

  } catch (err) {

    console.error(
      "REFERRAL URL ERROR:",
      err
    );
  }

})();


// ============================================================
// CHECK ADMIN
// ============================================================

async function checkAdmin() {

  if (!currentUser) {

    currentIsAdmin = false;

    return false;
  }

  try {

    const {
      data,
      error
    } =
      await sb
        .from("admins")
        .select("user_id")
        .eq(
          "user_id",
          currentUser.id
        )
        .maybeSingle();

    if (error) {

      console.error(
        "ADMIN CHECK ERROR:",
        error
      );

      currentIsAdmin = false;

      return false;
    }

    currentIsAdmin =
      !!data;

    return currentIsAdmin;

  } catch (err) {

    console.error(
      "ADMIN CHECK ERROR:",
      err
    );

    currentIsAdmin = false;

    return false;
  }
}


// ============================================================
// SHOW APP
// ============================================================

async function showApp() {

  if (!currentUser) {
    return;
  }

  setHidden(
    "authCard",
    true
  );

  setHidden(
    "resetPasswordCard",
    true
  );

  setHidden(
    "app",
    false
  );

  if ($("userEmail")) {

    $("userEmail").textContent =
      currentUser.email || "";
  }

  await checkAdmin();

  setHidden(
    "adminCard",
    !currentIsAdmin
  );

  await applyPendingReferral();

  await Promise.all([
    loadProfile(),
    loadTasks(),
    loadTransactions(),
    loadWithdrawals(),
    setupReferral()
  ]);

  if (currentIsAdmin) {

    await Promise.all([
      loadAdminSettings(),
      loadAdminTasks(),
      loadAdminWithdrawals()
    ]);
  }
}


// ============================================================
// APPLY REFERRAL
// ============================================================

async function applyPendingReferral() {

  if (!currentUser) {
    return;
  }

  const ref =
    localStorage.getItem(
      "pending_referral"
    );

  if (!ref) {
    return;
  }

  try {

    const {
      data,
      error
    } =
      await sb.rpc(
        "apply_referral",
        {
          p_referral_code:
            ref
        }
      );

    if (error) {

      console.error(
        "REFERRAL APPLY ERROR:",
        error
      );

      return;
    }

    console.log(
      "REFERRAL BONUS:",
      data
    );

    localStorage.removeItem(
      "pending_referral"
    );

  } catch (err) {

    console.error(
      "REFERRAL ERROR:",
      err
    );
  }
}


// ============================================================
// PROFILE
// ============================================================

async function loadProfile() {

  if (!currentUser) {
    return;
  }

  const balanceBox =
    $("balance");

  if (balanceBox) {
    balanceBox.textContent =
      "Loading...";
  }

  const {
    data,
    error
  } =
    await sb
      .from("profiles")
      .select("coin_balance")
      .eq(
        "id",
        currentUser.id
      )
      .single();

  if (error) {

    console.error(
      "PROFILE ERROR:",
      error
    );

    if (balanceBox) {
      balanceBox.textContent =
        "ERROR";
    }

    return;
  }

  if (balanceBox) {

    balanceBox.textContent =
      data?.coin_balance ?? 0;
  }
}


// ============================================================
// LOAD TASKS
// ============================================================

async function loadTasks() {

  const box =
    $("tasks");

  if (
    !box ||
    !currentUser
  ) {
    return;
  }

  box.innerHTML = "";

  const {
    data,
    error
  } =
    await sb
      .from("tasks")
      .select(
        "id,title,reward_coins,video_url"
      )
      .order("id");

  if (error) {

    console.error(
      "TASK LOAD ERROR:",
      error
    );

    box.textContent =
      "❌ " + error.message;

    return;
  }

  if (!data?.length) {

    box.innerHTML =
      '<p class="muted">No tasks available.</p>';

    return;
  }

  for (const task of data) {

    await renderTask(
      box,
      task
    );
  }
}


// ============================================================
// RENDER TASK
// ============================================================

async function renderTask(
  box,
  task
) {

  const {
    data: claim,
    error
  } =
    await sb
      .from("task_claims")
      .select("id")
      .eq(
        "user_id",
        currentUser.id
      )
      .eq(
        "task_id",
        task.id
      )
      .maybeSingle();

  if (error) {

    console.error(
      "TASK CLAIM CHECK ERROR:",
      error
    );
  }

  const div =
    document.createElement(
      "div"
    );

  div.className =
    "task";

  const reward =
    Number(
      task.reward_coins
    ) || 0;


  // Already claimed
  if (claim) {

    div.innerHTML = `
      <strong>
        ${escapeHtml(task.title)}
      </strong>

      <div class="muted">
        Reward: ${reward} Coins
      </div>

      <button disabled>
        ✅ Already Claimed
      </button>
    `;

    box.appendChild(div);

    return;
  }


  // Video task
  if (task.video_url) {

    div.innerHTML = `
      <strong>
        🎥 ${escapeHtml(task.title)}
      </strong>

      <div class="muted">
        Reward: ${reward} Coins
      </div>

      <button
        type="button"
        class="watchBtn"
      >
        ▶️ Watch Video
      </button>

      <button
        type="button"
        class="claimBtn"
        disabled
      >
        🔒 Claim after watching
      </button>

      <p class="videoMsg muted"></p>
    `;

    const watchBtn =
      div.querySelector(
        ".watchBtn"
      );

    const claimBtn =
      div.querySelector(
        ".claimBtn"
      );

    const videoMsg =
      div.querySelector(
        ".videoMsg"
      );

    let watched = false;

    watchBtn.onclick =
      () => {

        if (watched) {
          return;
        }

        watched = true;

        try {

          window.open(
            task.video_url,
            "_blank",
            "noopener,noreferrer"
          );

        } catch (err) {

          console.error(
            "VIDEO OPEN ERROR:",
            err
          );
        }

        watchBtn.disabled =
          true;

        if (videoMsg) {

          videoMsg.textContent =
            "🎬 Video ဖွင့်ပြီးပါပြီ။ 5 စက္ကန့်စောင့်ပါ...";
        }

        setTimeout(
          () => {

            if (videoMsg) {

              videoMsg.textContent =
                "✅ Video ကြည့်ပြီးပါပြီ။ Claim လုပ်နိုင်ပါပြီ။";
            }

            if (claimBtn) {
              claimBtn.disabled =
                false;
            }

          },
          5000
        );
      };


    claimBtn.onclick =
      async () => {

        if (claimBtn.disabled) {
          return;
        }

        claimBtn.disabled =
          true;

        await claimTask(
          task.id
        );
      };

    box.appendChild(div);

    return;
  }


  // Normal task
  div.innerHTML = `
    <strong>
      ${escapeHtml(task.title)}
    </strong>

    <div class="muted">
      Reward: ${reward} Coins
    </div>

    <button
      type="button"
      class="normalClaimBtn"
    >
      🎁 Claim Task
    </button>
  `;

  const button =
    div.querySelector(
      ".normalClaimBtn"
    );

  button.onclick =
    async () => {

      if (button.disabled) {
        return;
      }

      button.disabled =
        true;

      await claimTask(
        task.id
      );
    };

  box.appendChild(div);
}


// ============================================================
// CLAIM TASK
// ============================================================

async function claimTask(
  taskId
) {

  if (!currentUser) {

    alert(
      "Please login first."
    );

    return;
  }

  try {

    const {
      data,
      error
    } =
      await sb.rpc(
        "claim_task",
        {
          p_task_id:
            taskId
        }
      );

    if (error) {

      console.error(
        "CLAIM TASK ERROR:",
        error
      );

      alert(
        "❌ " + error.message
      );

      return;
    }

    alert(
      `Success! +${data} Coins`
    );

    await Promise.all([
      loadProfile(),
      loadTransactions(),
      loadTasks()
    ]);

  } catch (err) {

    console.error(
      "CLAIM TASK ERROR:",
      err
    );

    alert(
      "❌ " +
      (
        err?.message ||
        "Task claim failed."
      )
    );
  }
}


// ============================================================
// TRANSACTIONS
// ============================================================

async function loadTransactions() {

  const box =
    $("transactions");

  if (
    !box ||
    !currentUser
  ) {
    return;
  }

  box.innerHTML = "";

  const {
    data,
    error
  } =
    await sb
      .from("coin_transactions")
      .select(
        "amount,type,created_at"
      )
      .eq(
        "user_id",
        currentUser.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(30);

  if (error) {

    console.error(
      "TRANSACTIONS ERROR:",
      error
    );

    box.textContent =
      "❌ " + error.message;

    return;
  }

  if (!data?.length) {

    box.innerHTML =
      '<p class="muted">No transactions yet.</p>';

    return;
  }

  for (const t of data) {

    let label =
      t.type ||
      "Transaction";

    if (
      t.type ===
      "task_reward"
    ) {
      label =
        "🎯 Task Reward";
    }

    if (
      t.type ===
      "withdrawal_approved"
    ) {
      label =
        "💳 Withdrawal Approved";
    }

    if (
      t.type ===
      "withdrawal_rejected_refund"
    ) {
      label =
        "↩️ Withdrawal Refund";
    }

    const amount =
      Number(t.amount) || 0;

    const prefix =
      amount >= 0
        ? "+"
        : "";

    const div =
      document.createElement(
        "div"
      );

    div.className =
      "tx";

    div.innerHTML = `
      <strong>
        ${prefix}${amount} Coins
      </strong>

      · ${escapeHtml(label)}

      <div class="muted">
        ${escapeHtml(
          formatDate(
            t.created_at
          )
        )}
      </div>
    `;

    box.appendChild(div);
  }
}


// ============================================================
// WITHDRAWAL HISTORY
// ============================================================

async function loadWithdrawals() {

  const box =
    $("withdrawals");

  if (
    !box ||
    !currentUser
  ) {
    return;
  }

  box.innerHTML = "";

  const {
    data,
    error
  } =
    await sb
      .from("withdrawals")
      .select(
        "id,amount,status,payment_method,created_at"
      )
      .eq(
        "user_id",
        currentUser.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(20);

  if (error) {

    console.error(
      "WITHDRAWALS ERROR:",
      error
    );

    box.textContent =
      "❌ " + error.message;

    return;
  }

  if (!data?.length) {

    box.innerHTML =
      '<p class="muted">No withdrawals yet.</p>';

    return;
  }

  for (const w of data) {

    const div =
      document.createElement(
        "div"
      );

    div.className =
      "tx";

    div.innerHTML = `
      <strong>
        Withdrawal #${escapeHtml(w.id)}
      </strong>

      · ${Number(w.amount) || 0} Coins

      <div class="muted">
        ${escapeHtml(
          w.payment_method
        )}
      </div>

      <span class="withdraw-status ${escapeHtml(w.status)}">
        ${escapeHtml(w.status)}
      </span>

      <div class="muted">
        ${escapeHtml(
          formatDate(
            w.created_at
          )
        )}
      </div>
    `;

    box.appendChild(div);
  }
}


// ============================================================
// WITHDRAW
// ============================================================

async function withdraw() {

  if (!currentUser) {

    setMessage(
      "withdrawMsg",
      "❌ Login ဝင်ပါ။"
    );

    return;
  }

  const amount =
    Number(
      $("withdrawAmount")?.value
    );

  const method =
    $("paymentMethod")?.value ||
    "";

  const account =
    $("paymentAccount")
      ?.value.trim() ||
    "";

  setMessage(
    "withdrawMsg",
    ""
  );

  if (
    !isValidPositiveInteger(
      amount
    )
  ) {

    setMessage(
      "withdrawMsg",
      "❌ Amount ကို မှန်မှန်ထည့်ပါ။"
    );

    return;
  }

  if (!method) {

    setMessage(
      "withdrawMsg",
      "❌ Payment method ရွေးပါ။"
    );

    return;
  }

  if (!account) {

    setMessage(
      "withdrawMsg",
      "❌ Demo account ဖြည့်ပါ။"
    );

    return;
  }

  const button =
    $("withdrawBtn");

  if (button) {
    button.disabled =
      true;
  }

  setMessage(
    "withdrawMsg",
    "🔄 Withdrawal request တင်နေပါတယ်..."
  );

  try {

    const {
      data,
      error
    } =
      await sb.rpc(
        "request_withdrawal",
        {
          p_amount:
            amount,

          p_payment_method:
            method,

          p_payment_account:
            account
        }
      );

    if (error) {

      console.error(
        "WITHDRAW ERROR:",
        error
      );

      setMessage(
        "withdrawMsg",
        "❌ " + error.message
      );

      return;
    }

    setMessage(
      "withdrawMsg",
      `✅ Withdrawal request #${data} submitted (pending).`
    );

    if ($("withdrawAmount")) {
      $("withdrawAmount").value =
        "";
    }

    if ($("paymentAccount")) {
      $("paymentAccount").value =
        "";
    }

    await Promise.all([
      loadProfile(),
      loadTransactions(),
      loadWithdrawals()
    ]);

  } catch (err) {

    console.error(
      "WITHDRAW ERROR:",
      err
    );

    setMessage(
      "withdrawMsg",
      "❌ " +
      (
        err?.message ||
        "Withdrawal failed."
      )
    );

  } finally {

    if (button) {
      button.disabled =
        false;
    }
  }
}


// ============================================================
// ADMIN TASKS
// ============================================================

async function loadAdminTasks() {

  const box =
    $("adminTasks");

  if (
    !box ||
    !currentUser ||
    !currentIsAdmin
  ) {
    return;
  }

  box.innerHTML = "";

  const {
    data,
    error
  } =
    await sb
      .from("tasks")
      .select(
        "id,title,reward_coins,video_url"
      )
      .order("id");

  if (error) {

    console.error(
      "ADMIN TASK ERROR:",
      error
    );

    box.textContent =
      "❌ " + error.message;

    return;
  }

  if (!data?.length) {

    box.innerHTML =
      '<p class="muted">No tasks yet.</p>';

    return;
  }

  for (const task of data) {

    const div =
      document.createElement(
        "div"
      );

    div.className =
      "tx";

    div.innerHTML = `
      <strong>
        #${escapeHtml(task.id)}
        · ${escapeHtml(task.title)}
      </strong>

      <div class="muted">
        Reward:
        ${Number(task.reward_coins) || 0}
        Coins
      </div>

      ${
        task.video_url
          ? `
            <div class="muted">
              🎥 Video task
            </div>
          `
          : ""
      }

      <button
        type="button"
        class="editTaskBtn"
      >
        ✏️ Edit
      </button>

      <button
        type="button"
        class="deleteTaskBtn"
      >
        🗑️ Delete
      </button>
    `;

    const editButton =
      div.querySelector(
        ".editTaskBtn"
      );

    const deleteButton =
      div.querySelector(
        ".deleteTaskBtn"
      );

    editButton.onclick =
      () =>
        editTask(
          task.id,
          task.title,
          task.reward_coins
        );

    deleteButton.onclick =
      () =>
        deleteTask(
          task.id
        );

    box.appendChild(div);
  }
}


// ============================================================
// EDIT TASK
// ============================================================

async function editTask(
  id,
  oldTitle,
  oldReward
) {

  if (!currentIsAdmin) {

    alert(
      "❌ Admin only."
    );

    return;
  }

  const title =
    prompt(
      "Task title:",
      oldTitle
    );

  if (title === null) {
    return;
  }

  const rewardInput =
    prompt(
      "Reward Coins:",
      oldReward
    );

  if (
    rewardInput === null
  ) {
    return;
  }

  const reward =
    Number(
      rewardInput
    );

  if (
    !title.trim() ||
    !isValidPositiveInteger(
      reward
    )
  ) {

    alert(
      "Task title နဲ့ Reward Coins မှန်မှန်ထည့်ပါ။"
    );

    return;
  }

  const {
    error
  } =
    await sb
      .from("tasks")
      .update({
        title:
          title.trim(),

        reward_coins:
          reward
      })
      .eq(
        "id",
        id
      );

  if (error) {

    console.error(
      "EDIT TASK ERROR:",
      error
    );

    alert(
      "❌ " + error.message
    );

    return;
  }

  alert(
    "✅ Task updated!"
  );

  await Promise.all([
    loadAdminTasks(),
    loadTasks()
  ]);
}


// ============================================================
// DELETE TASK
// ============================================================

async function deleteTask(
  id
) {

  if (!currentIsAdmin) {

    alert(
      "❌ Admin only."
    );

    return;
  }

  const confirmed =
    confirm(
      `Task #${id} ကို ဖျက်မလား?`
    );

  if (!confirmed) {
    return;
  }

  const {
    error
  } =
    await sb
      .from("tasks")
      .delete()
      .eq(
        "id",
        id
      );

  if (error) {

    console.error(
      "DELETE TASK ERROR:",
      error
    );

    alert(
      "❌ " + error.message
    );

    return;
  }

  alert(
    "🗑️ Task deleted!"
  );

  await Promise.all([
    loadAdminTasks(),
    loadTasks()
  ]);
}


// ============================================================
// ADD TASK
// ============================================================

async function addTask() {

  if (!currentIsAdmin) {

    setMessage(
      "taskMsg",
      "❌ Admin only."
    );

    return;
  }

  const title =
    $("taskTitle")
      ?.value.trim() ||
    "";

  const reward =
    Number(
      $("taskReward")?.value
    );

  if (
    !title ||
    !isValidPositiveInteger(
      reward
    )
  ) {

    setMessage(
      "taskMsg",
      "❌ Task title နဲ့ Reward Coins မှန်မှန်ဖြည့်ပါ။"
    );

    return;
  }

  setMessage(
    "taskMsg",
    "🔄 Task ထည့်နေပါတယ်..."
  );

  const {
    error
  } =
    await sb
      .from("tasks")
      .insert({
        title,
        reward_coins:
          reward
      });

  if (error) {

    console.error(
      "ADD TASK ERROR:",
      error
    );

    setMessage(
      "taskMsg",
      "❌ " + error.message
    );

    return;
  }

  setMessage(
    "taskMsg",
    "✅ Task added successfully!"
  );

  if ($("taskTitle")) {
    $("taskTitle").value =
      "";
  }

  if ($("taskReward")) {
    $("taskReward").value =
      "";
  }

  await Promise.all([
    loadTasks(),
    loadAdminTasks()
  ]);
}


// ============================================================
// ADMIN WITHDRAWALS
// ============================================================

async function loadAdminWithdrawals() {

  const box =
    $("adminWithdrawals");

  if (
    !box ||
    !currentUser ||
    !currentIsAdmin
  ) {
    return;
  }

  box.innerHTML = "";

  const {
    data,
    error
  } =
    await sb
      .from("withdrawals")
      .select(
        "id,user_id,amount,status,payment_method,payment_account,created_at"
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(50);

  if (error) {

    console.error(
      "ADMIN WITHDRAWALS ERROR:",
      error
    );

    box.textContent =
      "❌ " + error.message;

    return;
  }

  if (!data?.length) {

    box.innerHTML =
      '<p class="muted">No withdrawals yet.</p>';

    return;
  }

  for (const w of data) {

    const div =
      document.createElement(
        "div"
      );

    div.className =
      "tx";

    div.innerHTML = `
      <strong>
        Withdrawal #${escapeHtml(w.id)}
        · ${Number(w.amount) || 0} Coins
      </strong>

      <div class="muted">
        ${escapeHtml(w.payment_method)}
        · ${escapeHtml(w.status)}
      </div>

      <div class="muted">
        ${escapeHtml(w.payment_account)}
      </div>

      <div class="muted">
        ${escapeHtml(
          formatDate(
            w.created_at
          )
        )}
      </div>
    `;

    if (
      w.status ===
      "pending"
    ) {

      const approve =
        document.createElement(
          "button"
        );

      approve.type =
        "button";

      approve.textContent =
        "✅ Approve";

      approve.onclick =
        () =>
          updateWithdrawalStatus(
            w.id,
            "approved"
          );


      const reject =
        document.createElement(
          "button"
        );

      reject.type =
        "button";

      reject.textContent =
        "❌ Reject";

      reject.onclick =
        () =>
          updateWithdrawalStatus(
            w.id,
            "rejected"
          );

      div.appendChild(
        approve
      );

      div.appendChild(
        reject
      );
    }

    box.appendChild(div);
  }
}


// ============================================================
// UPDATE WITHDRAWAL STATUS
// ============================================================

async function updateWithdrawalStatus(
  id,
  status
) {

  if (!currentIsAdmin) {

    alert(
      "❌ Admin only."
    );

    return;
  }

  if (
    status !== "approved" &&
    status !== "rejected"
  ) {
    return;
  }

  const confirmed =
    confirm(
      `Withdrawal #${id} ကို ${status} လုပ်မလား?`
    );

  if (!confirmed) {
    return;
  }

  const {
    error
  } =
    await sb.rpc(
      "update_withdrawal_status",
      {
        p_withdrawal_id:
          id,

        p_status:
          status
      }
    );

  if (error) {

    console.error(
      "UPDATE WITHDRAWAL ERROR:",
      error
    );

    alert(
      "❌ " + error.message
    );

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


// ============================================================
// REFERRAL LINK
// ============================================================

async function setupReferral() {

  if (!currentUser) {
    return;
  }

  const linkBox =
    $("referralLink");

  const msg =
    $("referralMsg");

  if (!linkBox) {
    return;
  }

  linkBox.value =
    "Loading referral link...";

  const {
    data,
    error
  } =
    await sb
      .from("profiles")
      .select(
        "referral_code"
      )
      .eq(
        "id",
        currentUser.id
      )
      .single();

  if (error) {

    console.error(
      "REFERRAL ERROR:",
      error
    );

    if (msg) {

      msg.textContent =
        "❌ Referral error: " +
        error.message;
    }

    return;
  }

  let code =
    data?.referral_code;

  if (!code) {

    try {

      code =
        crypto
          .randomUUID()
          .replace(
            /-/g,
            ""
          )
          .slice(
            0,
            8
          )
          .toUpperCase();

    } catch (err) {

      code =
        Math.random()
          .toString(36)
          .substring(
            2,
            10
          )
          .toUpperCase();
    }

    const {
      error: updateError
    } =
      await sb
        .from("profiles")
        .update({
          referral_code:
            code
        })
        .eq(
          "id",
          currentUser.id
        );

    if (updateError) {

      console.error(
        "REFERRAL CODE UPDATE ERROR:",
        updateError
      );

      if (msg) {

        msg.textContent =
          "❌ " +
          updateError.message;
      }

      return;
    }
  }

  const referralLink =
    `${location.origin}${location.pathname}?ref=${encodeURIComponent(code)}`;

  linkBox.value =
    referralLink;

  if (msg) {

    msg.textContent =
      "✅ Your Invite Link is ready!";
  }

  await loadReferralBonusText();
}


// ============================================================
// REFERRAL BONUS TEXT
// ============================================================

async function loadReferralBonusText() {

  const box =
    $("referralBonusText");

  if (!box) {
    return;
  }

  const {
    data,
    error
  } =
    await sb
      .from("app_settings")
      .select("value")
      .eq(
        "key",
        "referral_bonus_coins"
      )
      .maybeSingle();

  if (error) {

    console.error(
      "REFERRAL BONUS LOAD ERROR:",
      error
    );

    return;
  }

  const bonus =
    Number(
      data?.value
    );

  if (
    Number.isInteger(
      bonus
    ) &&
    bonus >= 0
  ) {

    box.textContent =
      `သူငယ်ချင်းကို Invite လုပ်ပြီး ${bonus} Coins Referral Bonus ရယူပါ။`;

  } else {

    box.textContent =
      "သူငယ်ချင်းကို Invite လုပ်ပြီး Referral Bonus ရယူပါ။";
  }
}


// ============================================================
// ADMIN SETTINGS
// ============================================================

async function loadAdminSettings() {

  if (!currentIsAdmin) {
    return;
  }

  const input =
    $("adminReferralBonus");

  if (!input) {
    return;
  }

  const {
    data,
    error
  } =
    await sb
      .from("app_settings")
      .select("value")
      .eq(
        "key",
        "referral_bonus_coins"
      )
      .maybeSingle();

  if (error) {

    console.error(
      "ADMIN SETTINGS LOAD ERROR:",
      error
    );

    setMessage(
      "adminSettingsMsg",
      "❌ " + error.message
    );

    return;
  }

  const value =
    data?.value ?? 10;

  input.value =
    value;
}


// ============================================================
// SAVE ADMIN SETTINGS
// ============================================================

async function saveAdminSettings() {

  if (!currentIsAdmin) {

    setMessage(
      "adminSettingsMsg",
      "❌ Admin only."
    );

    return;
  }

  const input =
    $("adminReferralBonus");

  if (!input) {
    return;
  }

  const value =
    Number(input.value);

  if (
    !Number.isInteger(value) ||
    value < 0
  ) {

    setMessage(
      "adminSettingsMsg",
      "❌ Referral Bonus ကို 0 သို့မဟုတ် အထက်ထည့်ပါ။"
    );

    return;
  }

  setMessage(
    "adminSettingsMsg",
    "🔄 Saving..."
  );

  try {

    /*
      First try UPDATE.
      The row already exists in the current project.
    */

    const {
      data: updatedRows,
      error: updateError
    } =
      await sb
        .from("app_settings")
        .update({
          value
        })
        .eq(
          "key",
          "referral_bonus_coins"
        )
        .select("key");

    if (updateError) {

      console.error(
        "SETTINGS UPDATE ERROR:",
        updateError
      );

      setMessage(
        "adminSettingsMsg",
        "❌ " +
        updateError.message
      );

      return;
    }

    /*
      If no row was updated, create it.
    */

    if (
      !updatedRows ||
      updatedRows.length === 0
    ) {

      const {
        error: insertError
      } =
        await sb
          .from("app_settings")
          .insert({
            key:
              "referral_bonus_coins",

            value
          });

      if (insertError) {

        console.error(
          "SETTINGS INSERT ERROR:",
          insertError
        );

        setMessage(
          "adminSettingsMsg",
          "❌ " +
          insertError.message
        );

        return;
      }
    }

    setMessage(
      "adminSettingsMsg",
      `✅ Referral Bonus ${value} Coins အဖြစ်သိမ်းပြီးပါပြီ။`
    );

    await loadReferralBonusText();

  } catch (err) {

    console.error(
      "ADMIN SETTINGS SAVE ERROR:",
      err
    );

    setMessage(
      "adminSettingsMsg",
      "❌ " +
      (
        err?.message ||
        "Settings save failed."
      )
    );
  }
}


// ============================================================
// COPY REFERRAL LINK
// ============================================================

async function copyReferralLink() {

  const linkBox =
    $("referralLink");

  const msg =
    $("referralMsg");

  let referralLink =
    "";

  if (
    linkBox &&
    linkBox.value &&
    linkBox.value !==
      "Loading referral link..."
  ) {

    referralLink =
      linkBox.value;
  }

  if (!referralLink) {

    if (msg) {

      msg.textContent =
        "❌ Referral Link မတွေ့ပါ။";
    }

    return;
  }

  try {

    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {

      await navigator.clipboard.writeText(
        referralLink
      );

      if (msg) {

        msg.textContent =
          "✅ Invite Link copied!";
      }

      return;
    }

    if (linkBox) {

      linkBox.focus();
      linkBox.select();

      const copied =
        document.execCommand(
          "copy"
        );

      if (copied) {

        if (msg) {

          msg.textContent =
            "✅ Invite Link copied!";
        }

      } else {

        if (msg) {

          msg.textContent =
            "📋 Link ကို ဖိထားပြီး Copy လုပ်ပါ။";
        }
      }
    }

  } catch (err) {

    console.error(
      "COPY ERROR:",
      err
    );

    if (msg) {

      msg.textContent =
        "📋 Link ကို ဖိထားပြီး Copy လုပ်ပါ။";
    }
  }
}


// ============================================================
// LOGOUT
// ============================================================

async function logoutUser() {

  try {

    await sb.auth.signOut();

  } catch (err) {

    console.error(
      "LOGOUT ERROR:",
      err
    );
  }

  currentUser = null;
  currentIsAdmin = false;

  window.location.reload();
}


// ============================================================
// PASSWORD RECOVERY
// ============================================================

function showPasswordRecovery() {

  setHidden(
    "authCard",
    true
  );

  setHidden(
    "app",
    true
  );

  setHidden(
    "resetPasswordCard",
    false
  );
}


// ============================================================
// AUTH STATE
// ============================================================

sb.auth.onAuthStateChange(
  async (
    event,
    session
  ) => {

    console.log(
      "AUTH EVENT:",
      event
    );

    if (
      event ===
      "PASSWORD_RECOVERY"
    ) {

      showPasswordRecovery();

      return;
    }

    if (
      session?.user
    ) {

      currentUser =
        session.user;

      if (
        event !==
        "INITIAL_SESSION"
      ) {

        try {

          await showApp();

        } catch (err) {

          console.error(
            "AUTH SHOW APP ERROR:",
            err
          );
        }
      }

    } else if (
      event ===
      "SIGNED_OUT"
    ) {

      currentUser = null;
      currentIsAdmin = false;

      setHidden(
        "app",
        true
      );

      setHidden(
        "authCard",
        false
      );

      setHidden(
        "resetPasswordCard",
        true
      );
    }
  }
);


// ============================================================
// EVENTS
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const loginBtn =
      $("loginBtn");

    if (loginBtn) {
      loginBtn.onclick =
        login;
    }


    const signupBtn =
      $("signupBtn");

    if (signupBtn) {
      signupBtn.onclick =
        signup;
    }


    const forgotPasswordBtn =
      $("forgotPasswordBtn");

    if (forgotPasswordBtn) {
      forgotPasswordBtn.onclick =
        forgotPassword;
    }


    const updatePasswordBtn =
      $("updatePasswordBtn");

    if (updatePasswordBtn) {
      updatePasswordBtn.onclick =
        updatePassword;
    }


    const logoutBtn =
      $("logoutBtn");

    if (logoutBtn) {
      logoutBtn.onclick =
        logoutUser;
    }


    const withdrawBtn =
      $("withdrawBtn");

    if (withdrawBtn) {
      withdrawBtn.onclick =
        withdraw;
    }


    const adminSaveSettingsBtn =
      $("adminSaveSettingsBtn");

    if (adminSaveSettingsBtn) {

      adminSaveSettingsBtn.onclick =
        saveAdminSettings;
    }


    const copyReferralBtn =
      $("copyReferralBtn");

    if (copyReferralBtn) {

      copyReferralBtn.onclick =
        copyReferralLink;
    }


    const addTaskBtn =
      $("addTaskBtn");

    if (addTaskBtn) {

      addTaskBtn.onclick =
        addTask;
    }


    const passwordInput =
      $("password");

    if (passwordInput) {

      passwordInput.addEventListener(
        "keydown",
        (event) => {

          if (
            event.key ===
            "Enter"
          ) {

            login();
          }
        }
      );
    }


    const emailInput =
      $("email");

    if (emailInput) {

      emailInput.addEventListener(
        "keydown",
        (event) => {

          if (
            event.key ===
            "Enter"
          ) {

            login();
          }
        }
      );
    }

  }
);


// ============================================================
// AUTO LOGIN
// ============================================================

(async function autoLogin() {

  try {

    const {
      data,
      error
    } =
      await sb.auth.getSession();

    if (error) {

      console.error(
        "SESSION ERROR:",
        error
      );

      setMessage(
        "authMsg",
        "❌ " + error.message
      );

      return;
    }

    if (
      data?.session?.user
    ) {

      currentUser =
        data.session.user;

      await showApp();

    } else {

      setHidden(
        "app",
        true
      );

      setHidden(
        "authCard",
        false
      );

      setHidden(
        "resetPasswordCard",
        true
      );
    }

  } catch (err) {

    console.error(
      "AUTO LOGIN ERROR:",
      err
    );

    setMessage(
      "authMsg",
      "❌ " +
      (
        err?.message ||
        "Session error."
      )
    );
  }

})();
