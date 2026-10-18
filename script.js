
const SUPABASE_URL = "https://wqqopuanyrspfzqxqtmu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_CO3bYZWfGxqbWVR44dTPuw_IpiEWH53";

const byId = (id) => document.getElementById(id);

const ui = {
  form: byId("authForm"),
  email: byId("email"),
  password: byId("password"),
  loginTab: byId("loginTab"),
  registerTab: byId("registerTab"),
  forgot: byId("forgotButton"),
  submit: byId("submitButton"),
  submitLabel: byId("submitLabel"),
  title: byId("formTitle"),
  subtitle: byId("formSubtitle"),
  eyebrow: byId("formEyebrow"),
  prompt: byId("switchPrompt"),
  notice: byId("notice"),
  toggle: byId("togglePassword"),
  passwordHint: byId("passwordHint"),
  dashboard: byId("dashboard"),
  logout: byId("logoutButton"),
  dashboardContent: byId("dashboardContent"),
  contentTitle: byId("dashboardContentTitle"),
  contentDescription: byId("dashboardContentDescription")
};

let mode = "login";
let supabaseClient = null;
let busy = false;

function initializeSupabase() {
  if (!window.supabase) {
    showNotice("Supabase did not load. Check your internet and reload.", "error");
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  return supabaseClient;
}

function showNotice(message, type = "info") {
  ui.notice.textContent = message;
  ui.notice.className = `notice ${type}`;
  ui.notice.hidden = false;
}

function clearNotice() {
  ui.notice.hidden = true;
  ui.notice.textContent = "";
  ui.notice.className = "notice";
}

function setMode(nextMode) {
  mode = nextMode;
  clearNotice();

  const registering = mode === "register";

  ui.loginTab.classList.toggle("active", !registering);
  ui.registerTab.classList.toggle("active", registering);
  ui.loginTab.setAttribute("aria-selected", String(!registering));
  ui.registerTab.setAttribute("aria-selected", String(registering));

  ui.title.textContent = registering
    ? "Start your journey."
    : "Good to see you.";

  ui.eyebrow.textContent = registering
    ? "CREATE YOUR ACCOUNT"
    : "WELCOME BACK";

  ui.subtitle.textContent = registering
    ? "Create an account and get ready for the road ahead."
    : "Sign in to continue your learning journey.";

  ui.submitLabel.textContent = registering
    ? "Create my account"
    : "Sign in to DriveReady";

  ui.prompt.innerHTML = registering
    ? 'Already have an account? <button type="button" class="inline-link" id="switchMode">Sign in</button>'
    : 'New to DriveReady? <button type="button" class="inline-link" id="switchMode">Create an account</button>';

  byId("switchMode").addEventListener("click", () => {
    setMode(registering ? "login" : "register");
  });

  ui.password.autocomplete = registering
    ? "new-password"
    : "current-password";

  ui.passwordHint.hidden = !registering;
  ui.forgot.hidden = registering;
}

function setBusy(value, label) {
  busy = value;
  ui.submit.disabled = value;
  ui.submitLabel.textContent = label || (
    mode === "register"
      ? "Create my account"
      : "Sign in to DriveReady"
  );
}

function showDashboard() {
  document.querySelector(".main-grid").hidden = true;
  ui.dashboard.hidden = false;
  document.title = "DriveReady | Dashboard";

  const year = byId("dashboardYear");
  if (year) year.textContent = new Date().getFullYear();

  showDashboardHome();
}

function showLogin() {
  ui.dashboard.hidden = true;
  document.querySelector(".main-grid").hidden = false;
  document.title = "DriveReady | Sign in";
}

function showDashboardHome() {
  ui.dashboardContent.hidden = true;
  ui.dashboard.querySelector(".dashboard-grid").hidden = false;
  ui.dashboard.querySelector(".dashboard-welcome").hidden = false;
}

const pages = {
  reviewer: {
    title: "LTO Reviewer",
    description: "Your driving lessons and road-sign reviewer will appear here. We'll add the study materials next."
  },
  quiz: {
    title: "Quiz & Mock Exam",
    description: "Your multiple-choice practice questions, scores, and explanations will appear here. We'll build the quiz next."
  },
  videos: {
    title: "Video Lessons",
    description: "Driving and traffic-rule videos will appear here. We'll add the video lessons next."
  },
  progress: {
    title: "My Progress",
    description: "Your quiz results and learning progress will appear here once we connect the quiz system."
  }
};

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => {
    const page = pages[button.dataset.page];
    if (!page) return;

    ui.dashboard.querySelector(".dashboard-grid").hidden = true;
    ui.dashboard.querySelector(".dashboard-welcome").hidden = true;
    ui.dashboardContent.hidden = false;

    ui.contentTitle.textContent = page.title;
    ui.contentDescription.textContent = page.description;
  });
});

byId("backToDashboard").addEventListener("click", showDashboardHome);

ui.loginTab.addEventListener("click", () => setMode("login"));
ui.registerTab.addEventListener("click", () => setMode("register"));

ui.toggle.addEventListener("click", () => {
  const showing = ui.password.type === "text";
  ui.password.type = showing ? "password" : "text";
  ui.toggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  ui.toggle.title = showing ? "Show password" : "Hide password";
});

ui.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  clearNotice();

  const email = ui.email.value.trim();
  const password = ui.password.value;

  if (!email || !ui.email.checkValidity()) {
    showNotice("Enter a valid email address.", "error");
    ui.email.focus();
    return;
  }

  if (!password || password.length < 6) {
    showNotice("Your password must contain at least 6 characters.", "error");
    ui.password.focus();
    return;
  }

  const client = initializeSupabase();
  if (!client) return;

  try {
    setBusy(true, mode === "register" ? "Creating account…" : "Signing in…");

    if (mode === "register") {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) throw error;

      if (data.session) {
        showDashboard();
      } else {
        showNotice(
          "Account created! Check your email to confirm your account before signing in.",
          "success"
        );
      }
    } else {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      if (data.session) showDashboard();
    }
  } catch (error) {
    const message = error.message || "Something went wrong. Please try again.";

    if (/invalid login credentials/i.test(message)) {
      showNotice("Your email or password is incorrect.", "error");
    } else if (/email not confirmed/i.test(message)) {
      showNotice("Please confirm your email before signing in.", "error");
    } else if (/user already registered/i.test(message)) {
      showNotice("This account already exists. Try signing in.", "error");
    } else {
      showNotice(message, "error");
    }
  } finally {
    setBusy(false);
  }
});

ui.forgot.addEventListener("click", async () => {
  clearNotice();

  const email = ui.email.value.trim();

  if (!email || !ui.email.checkValidity()) {
    showNotice("Enter your account email first.", "info");
    ui.email.focus();
    return;
  }

  const client = initializeSupabase();
  if (!client) return;

  try {
    ui.forgot.disabled = true;
    ui.forgot.textContent = "Sending…";

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    if (error) throw error;

    showNotice("Check your email for a password-reset link.", "success");
  } catch (error) {
    showNotice(error.message || "Could not send the reset email.", "error");
  } finally {
    ui.forgot.disabled = false;
    ui.forgot.textContent = "Forgot password?";
  }
});

ui.logout.addEventListener("click", async () => {
  const client = initializeSupabase();
  if (!client) return;

  ui.logout.disabled = true;

  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;

    showLogin();
    setMode("login");
    ui.password.value = "";
  } catch (error) {
    alert(error.message || "Could not log out. Please try again.");
  } finally {
    ui.logout.disabled = false;
  }
});

async function startApp() {
  setMode("login");
  byId("year").textContent = new Date().getFullYear();

  const client = initializeSupabase();
  if (!client) return;

  const { data, error } = await client.auth.getSession();

  if (!error && data.session) {
    showDashboard();
  } else {
    showLogin();
  }
}

startApp();
