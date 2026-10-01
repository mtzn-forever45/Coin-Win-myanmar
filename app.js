/* =========================================================
   Coin Win Myanmar
   Complete app.js
   Video reward flow:
   Watch -> Claim once -> Auto next video
   ========================================================= */

const SUPABASE_URL = "https://oymkceiqfchtvcxdltor.supabase.co";

// Public publishable/anon key used by the frontend.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95bWtjZWlxZmNodHZjeGRsdG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjA4MjcsImV4cCI6MjEwNDg5NjgyN30.KPwCk-8OKrHxzyt746hjccSzbUHKTA1AI3LNSjk4rPg";

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* =========================================================
   GLOBAL STATE
   ========================================================= */

let currentUser = null;
let currentIsAdmin = false;

let appShownForUserId = null;
let showAppPromise = null;
let showAppPromiseUserId = null;

let currentTasks = [];
let claimedTaskIds = new Set();

/*
  Prevent double-click / double-submit on the same task.
  Database RPC remains the final protection.
*/
const claimingTaskIds = new Set();

/*
  Used for video-watch timers.
*/
const videoTimers = new Map();

/*
  Used for the next-video auto flow.
*/
let autoNextVideoTaskId = null;

/* =========================================================
   HELPERS
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function show(el) {
  if (el) el.hidden = false;
}

function hide(el) {
  if (el) el.hidden = true;
}

function isVideoTask(task) {
  return !!(
    task &&
    typeof task.video_url === "string" &&
    task.video_url.trim()
  );
}

function getErrorMessage(error) {
  if (!error) return "Unknown error";

  if (typeof error === "string") {
    return error;
  }

  return (
    error.message ||
    error.error_description ||
    error.details ||
    error.hint ||
    "Something went wrong."
  );
}

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function formatType(type) {
  const map = {
    task_reward: "🎯 Task Reward",
    referral_bonus: "👥 Referral Bonus",
    withdrawal_approved: "💳 Withdrawal",
    withdrawal_rejected_refund: "↩️ Withdrawal Refund"
  };

  return map[type] || type || "-";
}

function normalizeVideoUrl(url) {
  if (!url) return "";

  let value = String(url).trim();

  /*
    Convert common YouTube forms to a clean URL.
  */
  try {
    const parsed = new URL(value);

    if (
      parsed.hostname === "youtu.be" ||
      parsed.hostname === "www.youtu.be"
    ) {
      const id = parsed.pathname.replace("/", "").trim();

      if (id) {
        return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
      }
    }

    if (
      parsed.hostname.includes("youtube.com") &&
      parsed.pathname === "/shorts/"
    ) {
      const id = parsed.pathname.split("/shorts/")[1].split("/")[0];

      if (id) {
        return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
      }
    }

    return value;
  } catch {
    return value;
  }
}

function getTaskById(taskId) {
  return currentTasks.find(
    task => Number(task.id) === Number(taskId)
  );
}

function getNextUnclaimedVideoTask(currentTaskId) {
  const sorted = [...currentTasks].sort(
    (a, b) => Number(a.id) - Number(b.id)
  );

  return (
    sorted.find(task => {
      if (!isVideoTask(task)) return false;
      if (Number(task.id) <= Number(currentTaskId)) return false;
      if (claimedTaskIds.has(Number(task.id))) return false;
      return true;
    }) || null
  );
}

/* =========================================================
   AUTH UI
   ========================================================= */

function showAuthScreen() {
  const authCard = $("authCard");
  const app = $("app");
  const resetCard = $("resetPasswordCard");

  if (authCard) authCard.hidden = false;
  if (app) app.hidden = true;
  if (resetCard) resetCard.hidden = true;

  currentIsAdmin = false;
}

function showPasswordRecovery() {
  const authCard = $("authCard");
  const app = $("app");
  const resetCard = $("resetPasswordCard");

  if (authCard) authCard.hidden = true;
  if (app) app.hidden = true;
  if (resetCard) resetCard.hidden = false;

  setText("resetPasswordMsg", "");
}

function clearAppState() {
  currentUser = null;
  currentIsAdmin = false;

  appShownForUserId = null;
  showAppPromise = null;
  showAppPromiseUserId = null;

  currentTasks = [];
  claimedTaskIds = new Set();
  claimingTaskIds.clear();

  for (const timer of videoTimers.values()) {
    clearTimeout(timer);
  }

  videoTimers.clear();
  autoNextVideoTaskId = null;
}

/* =========================================================
   REGISTER
   ========================================================= */

async function registerUser() {
  const email = $("email")?.value.trim();
  const password = $("password")?.value;

  if (!email || !password) {
    setText("authMsg", "Email and password are required.");
    return;
  }

  if (password.length < 6) {
    setText("authMsg", "Password must be at least 6 characters.");
    return;
  }

  const btn = $("signupBtn");

  if (btn) btn.disabled = true;

  setText("authMsg", "Creating account...");

  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password
    });

    if (error) throw error;

    /*
      Save referral code from URL/localStorage.
    */
    saveReferralFromUrl();

    if (data.session) {
      setText("authMsg", "Account created successfully.");
      await showApp(data.session.user);
    } else {
      setText(
        "authMsg",
        "Account created. Please confirm your email, then Login."
      );
    }
  } catch (error) {
    setText("authMsg", getErrorMessage(error));
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* =========================================================
   LOGIN
   ========================================================= */

async function loginUser() {
  const email = $("email")?.value.trim();
  const password = $("password")?.value;

  if (!email || !password) {
    setText("authMsg", "Email and password are required.");
    return;
  }

  const btn = $("loginBtn");

  if (btn) btn.disabled = true;

  setText("authMsg", "Logging in...");

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    currentUser = data.user;

    setText("authMsg", "");

    await showApp(data.user);
  } catch (error) {
    setText("authMsg", getErrorMessage(error));
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* =========================================================
   FORGOT PASSWORD
   ========================================================= */

async function forgotPassword() {
  const email = $("email")?.value.trim();

  if (!email) {
    setText(
      "authMsg",
      "Enter your email first, then press Forgot Password."
    );
    return;
  }

  const btn = $("forgotPasswordBtn");

  if (btn) btn.disabled = true;

  setText("authMsg", "Sending password reset email...");

  try {
    const redirectTo = window.location.origin + window.location.pathname;

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) throw error;

    setText(
      "authMsg",
      "Password reset email sent. Please check your email."
    );
  } catch (error) {
    setText("authMsg", getErrorMessage(error));
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* =========================================================
   UPDATE PASSWORD
   ========================================================= */

async function updatePassword() {
  const newPassword = $("newPassword")?.value || "";
  const confirmPassword = $("confirmPassword")?.value || "";

  if (!newPassword || !confirmPassword) {
    setText(
      "resetPasswordMsg",
      "Please enter the new password twice."
    );
    return;
  }

  if (newPassword.length < 6) {
    setText(
      "resetPasswordMsg",
      "Password must be at least 6 characters."
    );
    return;
  }

  if (newPassword !== confirmPassword) {
    setText(
      "resetPasswordMsg",
      "Passwords do not match."
    );
    return;
  }

  const btn = $("updatePasswordBtn");

  if (btn) btn.disabled = true;

  setText("resetPasswordMsg", "Updating password...");

  try {
    const { error } = await sb.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    setText(
      "resetPasswordMsg",
      "Password updated successfully. Please login again."
    );

    $("newPassword").value = "";
    $("confirmPassword").value = "";

    setTimeout(async () => {
      await sb.auth.signOut();
      window.location.reload();
    }, 1200);
  } catch (error) {
    setText(
      "resetPasswordMsg",
      getErrorMessage(error)
    );
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* =========================================================
   REFERRAL URL
   ========================================================= */

function saveReferralFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);

    const ref =
      params.get("ref") ||
      params.get("referral") ||
      params.get("referral_code");

    if (ref) {
      localStorage.setItem(
        "pending_referral",
        ref.trim()
      );
    }
  } catch (error) {
    console.warn("Referral URL error:", error);
  }
}

function getPendingReferral() {
  try {
    return localStorage.getItem("pending_referral");
  } catch {
    return null;
  }
}

function clearPendingReferral() {
  try {
    localStorage.removeItem("pending_referral");
  } catch {}
}

/* =========================================================
   ADMIN CHECK
   ========================================================= */

async function checkIsAdmin(userId) {
  if (!userId) return false;

  const { data, error } = await sb
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Admin check:", error);
    return false;
  }

  return !!data;
}

/* =========================================================
   APPLY REFERRAL
   ========================================================= */

async function applyPendingReferral() {
  const code = getPendingReferral();

  if (!code) return;

  try {
    const { data, error } = await sb.rpc(
      "apply_referral",
      {
        p_referral_code: code
      }
    );

    if (error) {
      const msg = getErrorMessage(error);

      console.warn("Referral:", msg);

      /*
        Permanent referral errors do not need to be retried
        forever on every login.
      */
      const lower = msg.toLowerCase();

      if (
        lower.includes("self") ||
        lower.includes("invalid") ||
        lower.includes("not found") ||
        lower.includes("already")
      ) {
        clearPendingReferral();
      }

      return;
    }

    /*
      0 means no referral was applied, for example
      already referred.
    */
    if (Number(data) >= 0) {
      clearPendingReferral();
    }
  } catch (error) {
    console.warn("Referral apply error:", error);
  }
}

/* =========================================================
   SHOW APP
   ========================================================= */

async function showApp(user = null) {
  if (!user) {
    const { data, error } = await sb.auth.getSession();

    if (error) throw error;

    user = data.session?.user || null;
  }

  if (!user) {
    showAuthScreen();
    return;
  }

  /*
    If another user logs in without a full page refresh,
    reset the old state.
  */
  if (
    appShownForUserId &&
    appShownForUserId !== user.id
  ) {
    appShownForUserId = null;
    currentIsAdmin = false;
    currentTasks = [];
    claimedTaskIds = new Set();
  }

  currentUser = user;

  if (appShownForUserId === user.id) {
    return;
  }

  if (
    showAppPromise &&
    showAppPromiseUserId === user.id
  ) {
    return showAppPromise;
  }

  showAppPromiseUserId = user.id;

  showAppPromise = (async () => {
    const authCard = $("authCard");
    const app = $("app");
    const resetCard = $("resetPasswordCard");

    if (authCard) authCard.hidden = true;
    if (resetCard) resetCard.hidden = true;
    if (app) app.hidden = false;

    setText(
      "userEmail",
      user.email || ""
    );

    /*
      Apply referral before loading balance.
    */
    await applyPendingReferral();

    /*
      Admin status.
    */
    currentIsAdmin = await checkIsAdmin(user.id);

    const adminCard = $("adminCard");

    if (adminCard) {
      adminCard.hidden = !currentIsAdmin;
    }

    /*
      Load main sections.
    */
    await Promise.all([
      loadProfile(),
      loadTasks(),
      loadTransactions(),
      loadWithdrawals(),
      setupReferral(),
      loadReferralBonusText()
    ]);

    /*
      Admin-only sections.
    */
    if (currentIsAdmin) {
      await Promise.all([
        loadAdminTasks(),
        loadAdminWithdrawals(),
        loadAdminReferralSettings()
      ]);
    }

    appShownForUserId = user.id;
  })()
    .catch(error => {
      console.error("showApp error:", error);

      setText(
        "authMsg",
        getErrorMessage(error)
      );
    })
    .finally(() => {
      showAppPromise = null;
      showAppPromiseUserId = null;
    });

  return showAppPromise;
}

/* =========================================================
   PROFILE / BALANCE
   ========================================================= */

async function loadProfile() {
  if (!currentUser) return;

  const { data, error } = await sb
    .from("profiles")
    .select("id, display_name, coin_balance, referral_code")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Profile error:", error);
    setText("balance", "0");
    return;
  }

  setText(
    "balance",
    Number(data?.coin_balance || 0)
  );
}

/* =========================================================
   TASKS
   ========================================================= */

async function loadTasks() {
  if (!currentUser) return;

  const tasksBox = $("tasks");

  if (!tasksBox) return;

  tasksBox.innerHTML = "<p>Loading tasks...</p>";

  const { data: tasks, error: tasksError } = await sb
    .from("tasks")
    .select("id, title, reward_coins, video_url")
    .order("id", { ascending: true });

  if (tasksError) {
    tasksBox.innerHTML =
      `<p class="msg">${escapeHtml(
        getErrorMessage(tasksError)
      )}</p>`;
    return;
  }

  currentTasks = tasks || [];

  const { data: claims, error: claimsError } = await sb
    .from("task_claims")
    .select("task_id")
    .eq("user_id", currentUser.id);

  if (claimsError) {
    console.warn("Task claims:", claimsError);
  }

  claimedTaskIds = new Set(
    (claims || []).map(row => Number(row.task_id))
  );

  tasksBox.innerHTML = "";

  if (!currentTasks.length) {
    tasksBox.innerHTML =
      "<p class=\"muted\">No tasks available.</p>";
    return;
  }

  currentTasks.forEach(task => {
    const box = document.createElement("div");

    renderTask(
      box,
      task,
      claimedTaskIds.has(Number(task.id))
    );

    tasksBox.appendChild(box);
  });
}

/* =========================================================
   RENDER TASK
   ========================================================= */

function renderTask(
  box,
  task,
  alreadyClaimed = false
) {
  const taskId = Number(task.id);
  const reward = Number(task.reward_coins || 0);
  const video = isVideoTask(task);

  box.className = "task-item";
  box.style.marginBottom = "14px";

  const title = escapeHtml(task.title || "Task");
  const videoUrl = normalizeVideoUrl(task.video_url);

  if (alreadyClaimed) {
    box.innerHTML = `
      <div style="padding:12px;border:1px solid #ddd;border-radius:10px;">
        <strong>${title}</strong>
        <div class="muted" style="margin-top:4px;">
          Reward: ${reward} Coins
        </div>
        <button
          type="button"
          disabled
          style="margin-top:8px;"
        >
          ✅ Already Claimed
        </button>
      </div>
    `;

    return;
  }

  if (!video) {
    box.innerHTML = `
      <div style="padding:12px;border:1px solid #ddd;border-radius:10px;">
        <strong>${title}</strong>
        <div class="muted" style="margin-top:4px;">
          Reward: ${reward} Coins
        </div>
        <button
          type="button"
          class="claim-task-btn"
          data-task-id="${taskId}"
          style="margin-top:8px;"
        >
          🎁 Claim Task
        </button>
      </div>
    `;

    const claimBtn = box.querySelector(
      ".claim-task-btn"
    );

    claimBtn?.addEventListener(
      "click",
      () => claimTask(taskId)
    );

    return;
  }

  /*
    Video task.
  */
  box.innerHTML = `
    <div
      style="
        padding:12px;
        border:1px solid #ddd;
        border-radius:10px;
      "
    >
      <strong>${title}</strong>

      <div class="muted" style="margin-top:4px;">
        Reward: ${reward} Coins
      </div>

      <div style="margin-top:8px;">
        <button
          type="button"
          class="watch-video-btn"
          data-task-id="${taskId}"
        >
          ▶️ Watch Video
        </button>

        <button
          type="button"
          class="claim-video-btn"
          data-task-id="${taskId}"
          disabled
          style="margin-left:6px;"
        >
          🔒 Claim after watching
        </button>
      </div>

      <p
        class="video-status muted"
        style="margin:8px 0 0;"
      >
        Watch the video first.
      </p>
    </div>
  `;

  const watchBtn = box.querySelector(
    ".watch-video-btn"
  );

  const claimBtn = box.querySelector(
    ".claim-video-btn"
  );

  const status = box.querySelector(
    ".video-status"
  );

  watchBtn?.addEventListener(
    "click",
    () => startVideoWatch(
      task,
      watchBtn,
      claimBtn,
      status
    )
  );

  claimBtn?.addEventListener(
    "click",
    () => claimVideoTask(
      task,
      claimBtn,
      status
    )
  );
}

/* =========================================================
   VIDEO WATCH
   ========================================================= */

function startVideoWatch(
  task,
  watchBtn,
  claimBtn,
  status
) {
  const taskId = Number(task.id);
  const videoUrl = normalizeVideoUrl(task.video_url);

  if (!videoUrl) {
    if (status) {
      status.textContent =
        "Video URL is missing.";
    }

    return;
  }

  /*
    Stop an old timer for this task.
  */
  if (videoTimers.has(taskId)) {
    clearTimeout(
      videoTimers.get(taskId)
    );
  }

  /*
    Five-second demo watch requirement.
  */
  const WATCH_SECONDS = 5;

  watchBtn.disabled = true;

  if (claimBtn) {
    claimBtn.disabled = true;
    claimBtn.textContent =
      `🔒 Watch ${WATCH_SECONDS}s first`;
  }

  if (status) {
    status.textContent =
      `Video opened. Wait ${WATCH_SECONDS} seconds, then return here.`;
  }

  /*
    Open video.
  */
  const opened = window.open(
    videoUrl,
    "_blank",
    "noopener,noreferrer"
  );

  /*
    If popup is blocked, give a direct fallback.
  */
  if (!opened) {
    if (status) {
      status.innerHTML =
        `Popup blocked. <a href="${escapeHtml(
          videoUrl
        )}" target="_blank" rel="noopener noreferrer">Open Video</a> then return here.`;
    }
  }

  /*
    Unlock claim after 5 seconds.
  */
  const timer = setTimeout(() => {
    videoTimers.delete(taskId);

    /*
      Do not unlock if task somehow became claimed.
    */
    if (claimedTaskIds.has(taskId)) {
      return;
    }

    if (claimBtn) {
      claimBtn.disabled = false;
      claimBtn.textContent =
        `🎁 Claim +${Number(task.reward_coins || 0)} Coins`;
    }

    if (status) {
      status.textContent =
        "✅ Watch step completed. You can claim your Coins.";
    }

    watchBtn.disabled = false;
  }, WATCH_SECONDS * 1000);

  videoTimers.set(taskId, timer);
}

/* =========================================================
   CLAIM NORMAL TASK
   ========================================================= */

async function claimTask(taskId) {
  if (!currentUser) return;

  taskId = Number(taskId);

  if (claimingTaskIds.has(taskId)) {
    return;
  }

  if (claimedTaskIds.has(taskId)) {
    return;
  }

  claimingTaskIds.add(taskId);

  try {
    const { data, error } = await sb.rpc(
      "claim_task",
      {
        p_task_id: taskId
      }
    );

    if (error) throw error;

    const coins = Number(data || 0);

    claimedTaskIds.add(taskId);

    alert(
      `Success! +${coins} Coins`
    );

    await loadProfile();
    await loadTasks();
    await loadTransactions();

    /*
      If this was a video task, auto-next.
    */
    const task = getTaskById(taskId);

    if (isVideoTask(task)) {
      await autoOpenNextVideo(taskId);
    }
  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  } finally {
    claimingTaskIds.delete(taskId);
  }
}

/* =========================================================
   CLAIM VIDEO TASK
   ========================================================= */

async function claimVideoTask(
  task,
  claimBtn,
  status
) {
  if (!currentUser) return;

  const taskId = Number(task.id);

  if (claimingTaskIds.has(taskId)) {
    return;
  }

  if (claimedTaskIds.has(taskId)) {
    return;
  }

  claimingTaskIds.add(taskId);

  if (claimBtn) {
    claimBtn.disabled = true;
    claimBtn.textContent = "⏳ Claiming...";
  }

  if (status) {
    status.textContent =
      "Checking reward...";
  }

  try {
    /*
      Server-side RPC is the final authority.
      This prevents duplicate rewards.
    */
    const { data, error } = await sb.rpc(
      "claim_task",
      {
        p_task_id: taskId
      }
    );

    if (error) throw error;

    const coins = Number(data || 0);

    /*
      Mark locally as claimed.
    */
    claimedTaskIds.add(taskId);

    /*
      Disable current task permanently in this session.
    */
    if (claimBtn) {
      claimBtn.disabled = true;
      claimBtn.textContent =
        "✅ Already Claimed";
    }

    if (status) {
      status.textContent =
        `✅ +${coins} Coins added.`;
    }

    alert(
      `Success! +${coins} Coins`
    );

    await loadProfile();
    await loadTasks();
    await loadTransactions();

    /*
      IMPORTANT:
      Auto-next happens ONLY after the current video
      has successfully received its one-time reward.
    */
    await autoOpenNextVideo(taskId);

  } catch (error) {
    const message = getErrorMessage(error);

    /*
      If database says already claimed,
      mark it locally too.
    */
    if (
      message.toLowerCase().includes("already claimed")
    ) {
      claimedTaskIds.add(taskId);

      if (claimBtn) {
        claimBtn.disabled = true;
        claimBtn.textContent =
          "✅ Already Claimed";
      }

      if (status) {
        status.textContent =
          "This video has already been claimed.";
      }
    } else {
      if (claimBtn) {
        claimBtn.disabled = false;
        claimBtn.textContent =
          `🎁 Claim +${Number(
            task.reward_coins || 0
          )} Coins`;
      }

      if (status) {
        status.textContent =
          "Claim failed. Please try again.";
      }

      alert(message);
    }
  } finally {
    claimingTaskIds.delete(taskId);
  }
}

/* =========================================================
   AUTO NEXT VIDEO
   ========================================================= */

async function autoOpenNextVideo(currentTaskId) {
  const nextTask =
    getNextUnclaimedVideoTask(currentTaskId);

  if (!nextTask) {
    autoNextVideoTaskId = null;

    alert(
      "🎉 You completed all available video tasks!"
    );

    return;
  }

  autoNextVideoTaskId = Number(nextTask.id);

  const nextUrl =
    normalizeVideoUrl(nextTask.video_url);

  if (!nextUrl) {
    return;
  }

  /*
    Small delay so the balance/task UI has time to refresh.
  */
  await new Promise(
    resolve => setTimeout(resolve, 700)
  );

  /*
    Try opening the next video automatically.
    Mobile browsers may block this because it is no longer
    directly inside the original tap event.
  */
  const opened = window.open(
    nextUrl,
    "_blank",
    "noopener,noreferrer"
  );

  if (opened) {
    /*
      Scroll to the next task in our page.
    */
    setTimeout(() => {
      const nextButton = document.querySelector(
        `.watch-video-btn[data-task-id="${Number(
          nextTask.id
        )}"]`
      );

      nextButton?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 300);

    return;
  }

  /*
    Popup was blocked.
    Show a clear fallback on the next task.
  */
  setTimeout(() => {
    const nextButton = document.querySelector(
      `.watch-video-btn[data-task-id="${Number(
        nextTask.id
      )}"]`
    );

    if (nextButton) {
      nextButton.textContent =
        "▶️ Continue to Next Video";

      nextButton.style.fontWeight = "bold";

      nextButton.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, 300);
}

/* =========================================================
   TRANSACTIONS
   ========================================================= */

async function loadTransactions() {
  if (!currentUser) return;

  const box = $("transactions");

  if (!box) return;

  box.innerHTML =
    "<p>Loading transactions...</p>";

  const { data, error } = await sb
    .from("coin_transactions")
    .select(
      "user_id, task_id, amount, type, created_at"
    )
    .eq("user_id", currentUser.id)
    .order("created_at", {
      ascending: false
    })
    .limit(100);

  if (error) {
    box.innerHTML =
      `<p class="msg">${escapeHtml(
        getErrorMessage(error)
      )}</p>`;
    return;
  }

  if (!data?.length) {
    box.innerHTML =
      "<p class=\"muted\">No transactions yet.</p>";
    return;
  }

  box.innerHTML = data.map(row => {
    const amount = Number(row.amount || 0);

    const sign =
      amount > 0 ? "+" : "";

    return `
      <div
        style="
          padding:10px 0;
          border-bottom:1px solid #ddd;
        "
      >
        <strong>
          ${escapeHtml(
            formatType(row.type)
          )}
        </strong>

        <div>
          <span>
            ${sign}${amount} Coins
          </span>
        </div>

        <small class="muted">
          ${escapeHtml(
            formatDate(row.created_at)
          )}
        </small>
      </div>
    `;
  }).join("");
}

/* =========================================================
   WITHDRAWAL
   ========================================================= */

async function requestWithdrawal() {
  if (!currentUser) return;

  const amount = Number(
    $("withdrawAmount")?.value
  );

  const paymentMethod =
    $("paymentMethod")?.value;

  const paymentAccount =
    $("paymentAccount")?.value.trim();

  if (!Number.isInteger(amount) || amount <= 0) {
    setText(
      "withdrawMsg",
      "Enter a valid coin amount."
    );
    return;
  }

  if (!paymentMethod) {
    setText(
      "withdrawMsg",
      "Select a payment method."
    );
    return;
  }

  if (!paymentAccount) {
    setText(
      "withdrawMsg",
      "Enter demo account / phone."
    );
    return;
  }

  const btn = $("withdrawBtn");

  if (btn) btn.disabled = true;

  setText(
    "withdrawMsg",
    "Submitting withdrawal..."
  );

  try {
    const { data, error } = await sb.rpc(
      "request_withdrawal",
      {
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_payment_account: paymentAccount
      }
    );

    if (error) throw error;

    setText(
      "withdrawMsg",
      `Withdrawal request created. Request #${data}`
    );

    if ($("withdrawAmount")) {
      $("withdrawAmount").value = "";
    }

    if ($("paymentAccount")) {
      $("paymentAccount").value = "";
    }

    await loadProfile();
    await loadWithdrawals();
    await loadTransactions();

  } catch (error) {
    setText(
      "withdrawMsg",
      getErrorMessage(error)
    );
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* =========================================================
   USER WITHDRAWAL HISTORY
   ========================================================= */

async function loadWithdrawals() {
  if (!currentUser) return;

  const box = $("withdrawals");

  if (!box) return;

  box.innerHTML =
    "<p>Loading withdrawals...</p>";

  const { data, error } = await sb
    .from("withdrawals")
    .select(
      "id, amount, status, created_at, payment_method, payment_account"
    )
    .eq("user_id", currentUser.id)
    .order("created_at", {
      ascending: false
    })
    .limit(50);

  if (error) {
    box.innerHTML =
      `<p class="msg">${escapeHtml(
        getErrorMessage(error)
      )}</p>`;
    return;
  }

  if (!data?.length) {
    box.innerHTML =
      "<p class=\"muted\">No withdrawal requests yet.</p>";
    return;
  }

  box.innerHTML = data.map(row => {
    return `
      <div
        style="
          padding:10px 0;
          border-bottom:1px solid #ddd;
        "
      >
        <strong>
          Request #${escapeHtml(row.id)}
        </strong>

        <div>
          ${Number(row.amount || 0)} Coins
        </div>

        <div>
          ${escapeHtml(
            row.payment_method || "-"
          )}
        </div>

        <div>
          Status:
          <strong>
            ${escapeHtml(
              row.status || "-"
            )}
          </strong>
        </div>

        <small class="muted">
          ${escapeHtml(
            formatDate(row.created_at)
          )}
        </small>
      </div>
    `;
  }).join("");
}

/* =========================================================
   REFERRAL
   ========================================================= */

async function setupReferral() {
  if (!currentUser) return;

  const input = $("referralLink");

  if (!input) return;

  input.value = "Loading referral link...";

  const { data, error } = await sb
    .from("profiles")
    .select("referral_code")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.warn(
      "Referral profile error:",
      error
    );

    input.value = "";

    return;
  }

  let code =
    data?.referral_code || "";

  /*
    If a referral code already exists,
    generate the share URL.
  */
  if (code) {
    const baseUrl =
      window.location.origin +
      window.location.pathname;

    input.value =
      `${baseUrl}?ref=${encodeURIComponent(
        code
      )}`;

    return;
  }

  /*
    Current database has RLS protecting profiles.
    Do not silently claim that a code was created
    if the backend rejected the update.
  */
  input.value = "";

  setText(
    "referralMsg",
    "Referral code is not available yet."
  );
}

/* =========================================================
   REFERRAL BONUS TEXT
   ========================================================= */

async function loadReferralBonusText() {
  const text = $("referralBonusText");

  if (!text) return;

  const { data, error } = await sb
    .from("app_settings")
    .select("key, value")
    .eq("key", "referral_bonus_coins")
    .maybeSingle();

  if (error) {
    console.warn(
      "Referral bonus setting:",
      error
    );

    text.textContent =
      "သူငယ်ချင်းကို Invite လုပ်ပြီး Referral Bonus ရယူပါ။";

    return;
  }

  const bonus = Number(
    data?.value ?? 10
  );

  text.textContent =
    `သူငယ်ချင်းကို Invite လုပ်ပြီး ${bonus} Coins Referral Bonus ရယူပါ။`;
}

/* =========================================================
   COPY REFERRAL
   ========================================================= */

async function copyReferralLink() {
  const input = $("referralLink");

  if (!input?.value) {
    setText(
      "referralMsg",
      "Referral link is not available."
    );
    return;
  }

  try {
    await navigator.clipboard.writeText(
      input.value
    );

    setText(
      "referralMsg",
      "Invite Link copied!"
    );
  } catch {
    /*
      Fallback for older mobile browsers.
    */
    input.focus();
    input.select();

    try {
      document.execCommand("copy");

      setText(
        "referralMsg",
        "Invite Link copied!"
      );
    } catch {
      setText(
        "referralMsg",
        "Copy failed. Please copy the link manually."
      );
    }
  }
}

/* =========================================================
   ADMIN TASKS
   ========================================================= */

async function loadAdminTasks() {
  if (!currentIsAdmin) return;

  const box = $("adminTasks");

  if (!box) return;

  box.innerHTML =
    "<p>Loading tasks...</p>";

  const { data, error } = await sb
    .from("tasks")
    .select(
      "id, title, reward_coins, video_url"
    )
    .order("id", {
      ascending: true
    });

  if (error) {
    box.innerHTML =
      `<p class="msg">${escapeHtml(
        getErrorMessage(error)
      )}</p>`;
    return;
  }

  if (!data?.length) {
    box.innerHTML =
      "<p class=\"muted\">No tasks.</p>";
    return;
  }

  box.innerHTML = data.map(task => {
    return `
      <div
        style="
          border:1px solid #ddd;
          border-radius:10px;
          padding:10px;
          margin-bottom:10px;
        "
      >
        <strong>
          #${Number(task.id)}
        </strong>

        <input
          class="admin-task-title"
          data-task-id="${Number(task.id)}"
          value="${escapeHtml(task.title || "")}"
          type="text"
          placeholder="Task title"
        >

        <input
          class="admin-task-reward"
          data-task-id="${Number(task.id)}"
          value="${Number(task.reward_coins || 0)}"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          placeholder="Reward"
        >

        <input
          class="admin-task-video"
          data-task-id="${Number(task.id)}"
          value="${escapeHtml(task.video_url || "")}"
          type="text"
          placeholder="Video URL"
        >

        <div style="margin-top:8px;">
          <button
            type="button"
            class="admin-update-task"
            data-task-id="${Number(task.id)}"
          >
            💾 Save
          </button>

          <button
            type="button"
            class="admin-delete-task secondary"
            data-task-id="${Number(task.id)}"
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    `;
  }).join("");

  box
    .querySelectorAll(".admin-update-task")
    .forEach(btn => {
      btn.addEventListener(
        "click",
        () => updateAdminTask(
          Number(btn.dataset.taskId)
        )
      );
    });

  box
    .querySelectorAll(".admin-delete-task")
    .forEach(btn => {
      btn.addEventListener(
        "click",
        () => deleteAdminTask(
          Number(btn.dataset.taskId)
        )
      );
    });
}

/* =========================================================
   ADMIN UPDATE TASK
   ========================================================= */

async function updateAdminTask(taskId) {
  if (!currentIsAdmin) return;

  const titleInput = document.querySelector(
    `.admin-task-title[data-task-id="${taskId}"]`
  );

  const rewardInput = document.querySelector(
    `.admin-task-reward[data-task-id="${taskId}"]`
  );

  const videoInput = document.querySelector(
    `.admin-task-video[data-task-id="${taskId}"]`
  );

  const title =
    titleInput?.value.trim() || "";

  const reward =
    Number(rewardInput?.value);

  const videoUrl =
    videoInput?.value.trim() || null;

  if (!title) {
    alert("Task title is required.");
    return;
  }

  if (!Number.isInteger(reward) || reward < 0) {
    alert("Reward must be a valid number.");
    return;
  }

  try {
    const { error } = await sb
      .from("tasks")
      .update({
        title,
        reward_coins: reward,
        video_url: videoUrl
      })
      .eq("id", taskId);

    if (error) throw error;

    alert("Task updated successfully.");

    await loadAdminTasks();
    await loadTasks();

  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}

/* =========================================================
   ADMIN DELETE TASK
   ========================================================= */

async function deleteAdminTask(taskId) {
  if (!currentIsAdmin) return;

  const confirmed = confirm(
    `Delete task #${taskId}?`
  );

  if (!confirmed) return;

  try {
    const { error } = await sb
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) throw error;

    alert("Task deleted.");

    await loadAdminTasks();
    await loadTasks();

  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}

/* =========================================================
   ADMIN ADD TASK
   ========================================================= */

async function addAdminTask() {
  if (!currentIsAdmin) return;

  const title =
    $("taskTitle")?.value.trim() || "";

  const reward =
    Number($("taskReward")?.value);

  if (!title) {
    setText(
      "taskMsg",
      "Task title is required."
    );
    return;
  }

  if (
    !Number.isInteger(reward) ||
    reward < 0
  ) {
    setText(
      "taskMsg",
      "Enter a valid reward."
    );
    return;
  }

  const btn = $("addTaskBtn");

  if (btn) btn.disabled = true;

  setText(
    "taskMsg",
    "Adding task..."
  );

  try {
    const { error } = await sb
      .from("tasks")
      .insert({
        title,
        reward_coins: reward,
        video_url: null
      });

    if (error) throw error;

    setText(
      "taskMsg",
      "Task added successfully."
    );

    if ($("taskTitle")) {
      $("taskTitle").value = "";
    }

    if ($("taskReward")) {
      $("taskReward").value = "";
    }

    await loadAdminTasks();
    await loadTasks();

  } catch (error) {
    setText(
      "taskMsg",
      getErrorMessage(error)
    );
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* =========================================================
   ADMIN WITHDRAWALS
   ========================================================= */

async function loadAdminWithdrawals() {
  if (!currentIsAdmin) return;

  const box = $("adminWithdrawals");

  if (!box) return;

  box.innerHTML =
    "<p>Loading withdrawal requests...</p>";

  const { data, error } = await sb
    .from("withdrawals")
    .select(
      "id, user_id, amount, status, created_at, payment_method, payment_account"
    )
    .order("created_at", {
      ascending: false
    })
    .limit(100);

  if (error) {
    box.innerHTML =
      `<p class="msg">${escapeHtml(
        getErrorMessage(error)
      )}</p>`;
    return;
  }

  if (!data?.length) {
    box.innerHTML =
      "<p class=\"muted\">No withdrawal requests.</p>";
    return;
  }

  box.innerHTML = data.map(row => {
    const pending =
      String(row.status) === "pending";

    return `
      <div
        style="
          border:1px solid #ddd;
          border-radius:10px;
          padding:10px;
          margin-bottom:10px;
        "
      >
        <strong>
          Request #${escapeHtml(row.id)}
        </strong>

        <div>
          User:
          <small>
            ${escapeHtml(row.user_id || "-")}
          </small>
        </div>

        <div>
          Amount:
          ${Number(row.amount || 0)} Coins
        </div>

        <div>
          Method:
          ${escapeHtml(
            row.payment_method || "-"
          )}
        </div>

        <div>
          Account:
          ${escapeHtml(
            row.payment_account || "-"
          )}
        </div>

        <div>
          Status:
          <strong>
            ${escapeHtml(row.status || "-")}
          </strong>
        </div>

        <small class="muted">
          ${escapeHtml(
            formatDate(row.created_at)
          )}
        </small>

        ${
          pending
            ? `
              <div style="margin-top:8px;">
                <button
                  type="button"
                  class="approve-withdrawal"
                  data-id="${Number(row.id)}"
                >
                  ✅ Approve
                </button>

                <button
                  type="button"
                  class="reject-withdrawal secondary"
                  data-id="${Number(row.id)}"
                >
                  ❌ Reject
                </button>
              </div>
            `
            : ""
        }
      </div>
    `;
  }).join("");

  box
    .querySelectorAll(".approve-withdrawal")
    .forEach(btn => {
      btn.addEventListener(
        "click",
        () => updateWithdrawalStatus(
          Number(btn.dataset.id),
          "approved"
        )
      );
    });

  box
    .querySelectorAll(".reject-withdrawal")
    .forEach(btn => {
      btn.addEventListener(
        "click",
        () => updateWithdrawalStatus(
          Number(btn.dataset.id),
          "rejected"
        )
      );
    });
}

/* =========================================================
   ADMIN APPROVE / REJECT WITHDRAWAL
   ========================================================= */

async function updateWithdrawalStatus(
  withdrawalId,
  status
) {
  if (!currentIsAdmin) return;

  const action =
    status === "approved"
      ? "approve"
      : "reject";

  const confirmed = confirm(
    `Are you sure you want to ${action} withdrawal #${withdrawalId}?`
  );

  if (!confirmed) return;

  try {
    const { error } = await sb.rpc(
      "update_withdrawal_status",
      {
        p_withdrawal_id: withdrawalId,
        p_status: status
      }
    );

    if (error) throw error;

    alert(
      `Withdrawal #${withdrawalId} ${status}.`
    );

    await loadAdminWithdrawals();

  } catch (error) {
    alert(
      getErrorMessage(error)
    );
  }
}

/* =========================================================
   ADMIN REFERRAL SETTINGS
   ========================================================= */

async function loadAdminReferralSettings() {
  if (!currentIsAdmin) return;

  const input =
    $("adminReferralBonus");

  if (!input) return;

  const { data, error } = await sb
    .from("app_settings")
    .select("key, value")
    .eq("key", "referral_bonus_coins")
    .maybeSingle();

  if (error) {
    setText(
      "adminSettingsMsg",
      getErrorMessage(error)
    );
    return;
  }

  if (data) {
    input.value =
      Number(data.value || 0);
  }
}

/* =========================================================
   SAVE ADMIN REFERRAL SETTINGS
   ========================================================= */

async function saveAdminReferralSettings() {
  if (!currentIsAdmin) return;

  const input =
    $("adminReferralBonus");

  const value =
    Number(input?.value);

  if (
    !Number.isInteger(value) ||
    value < 0
  ) {
    setText(
      "adminSettingsMsg",
      "Enter a valid referral bonus."
    );
    return;
  }

  const btn =
    $("adminSaveSettingsBtn");

  if (btn) btn.disabled = true;

  setText(
    "adminSettingsMsg",
    "Saving settings..."
  );

  try {
    /*
      Existing row should normally be present.
    */
    const { data, error } = await sb
      .from("app_settings")
      .update({
        value
      })
      .eq("key", "referral_bonus_coins")
      .select("key")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      /*
        Try insert only if the row does not exist.
        RLS may reject this, which is expected if INSERT
        is intentionally disabled.
      */
      const { error: insertError } =
        await sb
          .from("app_settings")
          .insert({
            key: "referral_bonus_coins",
            value
          });

      if (insertError) {
        throw insertError;
      }
    }

    setText(
      "adminSettingsMsg",
      "Referral bonus saved successfully."
    );

    await loadReferralBonusText();

  } catch (error) {
    setText(
      "adminSettingsMsg",
      getErrorMessage(error)
    );
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutUser() {
  const btn = $("logoutBtn");

  if (btn) btn.disabled = true;

  try {
    await sb.auth.signOut();
  } catch (error) {
    console.warn(
      "Logout:",
      error
    );
  }

  clearAppState();

  /*
    Full reload clears all old UI state.
  */
  window.location.reload();
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEventListeners() {
  $("loginBtn")?.addEventListener(
    "click",
    loginUser
  );

  $("signupBtn")?.addEventListener(
    "click",
    registerUser
  );

  $("forgotPasswordBtn")?.addEventListener(
    "click",
    forgotPassword
  );

  $("updatePasswordBtn")?.addEventListener(
    "click",
    updatePassword
  );

  $("logoutBtn")?.addEventListener(
    "click",
    logoutUser
  );

  $("withdrawBtn")?.addEventListener(
    "click",
    requestWithdrawal
  );

  $("copyReferralBtn")?.addEventListener(
    "click",
    copyReferralLink
  );

  $("addTaskBtn")?.addEventListener(
    "click",
    addAdminTask
  );

  $("adminSaveSettingsBtn")?.addEventListener(
    "click",
    saveAdminReferralSettings
  );

  /*
    Enter key login.
  */
  $("password")?.addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        loginUser();
      }
    }
  );

  $("confirmPassword")?.addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        updatePassword();
      }
    }
  );
}

/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

function setupAuthListener() {
  sb.auth.onAuthStateChange(
    (event, session) => {
      /*
        INITIAL_SESSION is handled by autoLogin().
      */
      if (event === "INITIAL_SESSION") {
        return;
      }

      if (event === "PASSWORD_RECOVERY") {
        showPasswordRecovery();
        return;
      }

      if (!session?.user) {
        clearAppState();
        showAuthScreen();
        return;
      }

      currentUser = session.user;

      /*
        Do not await Supabase queries directly inside the
        auth callback. Defer app loading.
      */
      setTimeout(() => {
        showApp(session.user).catch(error => {
          console.error(
            "Auth showApp:",
            error
          );
        });
      }, 0);
    }
  );
}

/* =========================================================
   RECOVERY LINK DETECTION
   ========================================================= */

function isPasswordRecoveryLink() {
  try {
    const searchParams =
      new URLSearchParams(
        window.location.search
      );

    if (
      searchParams.get("type") ===
      "recovery"
    ) {
      return true;
    }

    const hash =
      window.location.hash || "";

    return /(?:^|[&#])type=recovery(?:&|$)/i.test(
      hash
    );
  } catch {
    return false;
  }
}

/* =========================================================
   AUTO LOGIN
   ========================================================= */

async function autoLogin() {
  try {
    saveReferralFromUrl();

    /*
      Do not show the normal app before Supabase
      processes a password-recovery link.
    */
    if (isPasswordRecoveryLink()) {
      return;
    }

    const { data, error } =
      await sb.auth.getSession();

    if (error) throw error;

    if (data.session?.user) {
      currentUser =
        data.session.user;

      await showApp(
        data.session.user
      );
    } else {
      showAuthScreen();
    }
  } catch (error) {
    console.error(
      "Auto login:",
      error
    );

    showAuthScreen();
  }
}

/* =========================================================
   SERVICE WORKER
   ========================================================= */

function registerServiceWorker() {
  if (
    "serviceWorker" in navigator &&
    window.location.protocol === "https:"
  ) {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => {
        console.log(
          "Service worker registered."
        );
      })
      .catch(error => {
        console.warn(
          "Service worker registration failed:",
          error
        );
      });
  }
}

/* =========================================================
   START APP
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    setupEventListeners();
    setupAuthListener();

    /*
      Save referral before auth loads.
    */
    saveReferralFromUrl();

    /*
      Service worker is kept so the existing website
      functionality is not unnecessarily removed.
    */
    registerServiceWorker();

    await autoLogin();
  }
);
