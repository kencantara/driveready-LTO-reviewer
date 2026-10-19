// ============================================================
// DriveReady
// Supabase login code is the same as before. Only the screen
// switching (states), loader, and dashboard views were added.
// ============================================================

const SUPABASE_URL = "https://wqqopuanyrspfzqxqtmu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_CO3bYZWfGxqbWVR44dTPuw_IpiEWH53";

const byId = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

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
  logout: byId("logoutButton")
};

let mode = "login";
let supabaseClient = null;
let busy = false;
let currentUser = null;
let loggingOut = false;
let authListenerSet = false;

// ------------------------------------------------------------
// Supabase (unchanged)
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Screen states: boot -> login | loading -> app
// The CSS hides everything that does not belong to the state,
// so the login can never show behind the dashboard.
// ------------------------------------------------------------
function setState(state) {
  document.body.dataset.state = state;
  if (state === "login") document.title = "DriveReady | Sign in";
  if (state === "app") document.title = "DriveReady | Dashboard";
}

function setLoaderText(text) {
  byId("loaderText").textContent = text;
}

// Called ONLY after Supabase has confirmed a real session.
async function enterApp(session, quick) {
  currentUser = session.user;
  setLoaderText(quick ? "Welcome back…" : "Login confirmed. Preparing your dashboard…");
  setState("loading");

  const year = byId("dashboardYear");
  if (year) year.textContent = new Date().getFullYear();

  const who = byId("welcomeUser");
  if (who && currentUser && currentUser.email) {
    who.textContent = "Signed in as " + currentUser.email + ". Learn the rules of the road, practice, and get ready for your LTO exam.";
  }

  await wait(reduceMotion ? 200 : quick ? 700 : 1500);

  quiz = { stage: "start", i: 0, answers: [] };
  setState("app");
  showView("home", { push: false });
  history.replaceState({ view: "home" }, "", "#home");
}

function goToLogin(message, type) {
  currentUser = null;
  quiz = { stage: "start", i: 0, answers: [] };
  setState("login");
  setMode("login");
  ui.password.value = "";
  history.replaceState(null, "", window.location.pathname);
  window.scrollTo(0, 0);
  if (message) showNotice(message, type || "info");
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
        await enterApp(data.session, false);
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

      if (data.session) {
        await enterApp(data.session, false);
      } else {
        showNotice("Login succeeded, but no session was returned. Please try again.", "error");
      }
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
  loggingOut = true;

  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;

    goToLogin();
  } catch (error) {
    alert(error.message || "Could not log out. Please try again.");
  } finally {
    loggingOut = false;
    ui.logout.disabled = false;
  }
});

// ------------------------------------------------------------
// Saved progress (stored on this device, separately for each account)
// ------------------------------------------------------------
function storeKey() {
  return currentUser ? "driveready:progress:" + currentUser.id : null;
}

function loadProgress() {
  const empty = { tests: [], reviewed: [] };
  const key = storeKey();
  if (!key) return empty;
  try {
    const data = JSON.parse(localStorage.getItem(key));
    if (data && Array.isArray(data.tests) && Array.isArray(data.reviewed)) return data;
  } catch (e) { /* ignore */ }
  return empty;
}

function saveProgress(data) {
  const key = storeKey();
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------
// Content data (placeholders until your real reviewer material is added)
// ------------------------------------------------------------
const REVIEWER_TOPICS = [
  { id: "traffic-rules", title: "Traffic Rules and Regulations" },
  { id: "road-signs-markings", title: "Road Signs and Markings" },
  { id: "safe-driving", title: "Safe Driving Practices" }
];

const SIGN_CATEGORIES = ["Regulatory", "Warning", "Guide"];

const SIGNS = [
  {
    id: "stop", category: "Regulatory", name: "Stop",
    meaning: "Come to a complete stop.",
    explanation: "Stop fully at the line or before the intersection, look both ways, and go only when it is safe.",
    svg: '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30" fill="#d62839" stroke="#fff" stroke-width="4"/><text x="50" y="60" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="25" fill="#fff">STOP</text></svg>'
  },
  {
    id: "give-way", category: "Regulatory", name: "Give Way",
    meaning: "Slow down and let other traffic go first.",
    explanation: "Be ready to stop if needed. Enter the road only when there is a safe gap.",
    svg: '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="10,16 90,16 50,88" fill="#fff" stroke="#d62839" stroke-width="10" stroke-linejoin="round"/></svg>'
  },
  {
    id: "no-entry", category: "Regulatory", name: "No Entry",
    meaning: "Vehicles may not enter this road.",
    explanation: "Do not drive into the road beyond this sign. It is usually placed at the exit of one-way roads.",
    svg: '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#d62839" stroke="#fff" stroke-width="4"/><rect x="22" y="43" width="56" height="14" rx="2" fill="#fff"/></svg>'
  },
  {
    id: "general-warning", category: "Warning", name: "General Warning",
    meaning: "A hazard may be ahead.",
    explanation: "Slow down, stay alert, and watch for the hazard described by the sign or its plate.",
    svg: '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,6 94,50 50,94 6,50" fill="#ffc933" stroke="#222" stroke-width="5" stroke-linejoin="round"/><text x="50" y="66" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="46" fill="#222">!</text></svg>'
  }
];

const VIDEOS = [
  { id: "v1", title: "Video lesson 1", category: "Placeholder", description: "Your first recorded lesson will go here.", src: null },
  { id: "v2", title: "Video lesson 2", category: "Placeholder", description: "Your second recorded lesson will go here.", src: null },
  { id: "v3", title: "Video lesson 3", category: "Placeholder", description: "Your third recorded lesson will go here.", src: null }
];

const QUESTIONS = [
  {
    q: "What does a red, eight-sided (octagon) road sign mean?",
    options: ["Slow down", "Stop completely", "Road work ahead", "Parking allowed"],
    answer: 1,
    explanation: "An octagon sign is the STOP sign. Come to a full stop and go only when it is safe."
  },
  {
    q: "What should you do at a Give Way sign?",
    options: [
      "Speed up so you pass first",
      "Slow down and let traffic on the road you are entering go first",
      "Always stop for ten seconds",
      "Sound your horn and go"
    ],
    answer: 1,
    explanation: "A Give Way sign means other traffic goes first. Slow down and stop if you need to."
  },
  {
    q: "Pedestrians are crossing at a pedestrian lane. What should you do?",
    options: ["Honk so they hurry", "Overtake them", "Slow down and let them cross", "Drive faster"],
    answer: 2,
    explanation: "Pedestrians on a crossing should be allowed to cross safely. Slow down and be ready to stop."
  },
  {
    q: "Why should you wear a seat belt?",
    options: [
      "Only to avoid a fine",
      "It lowers the risk of serious injury in a crash",
      "It is only needed on long trips",
      "It makes the car go faster"
    ],
    answer: 1,
    explanation: "Seat belts hold you in place in a crash and lower the risk of serious injury."
  },
  {
    q: "Is it safe to drive after drinking alcohol?",
    options: [
      "Yes, after one drink",
      "Yes, if you drive slowly",
      "No, alcohol slows your reactions and judgment",
      "Yes, on short trips"
    ],
    answer: 2,
    explanation: "Alcohol slows your reactions and hurts your judgment. Do not drink and drive."
  }
];

// ------------------------------------------------------------
// Navigation between dashboard views
// ------------------------------------------------------------
const VIEWS = ["home", "reviewer", "signs", "quiz", "videos", "progress"];
let currentView = "home";
let selectedTopic = null;
let signFilter = "All";
let selectedSign = null;
let selectedVideo = null;
let quiz = { stage: "start", i: 0, answers: [] };

function showView(name, options) {
  const push = !options || options.push !== false;
  if (!VIEWS.includes(name)) name = "home";
  currentView = name;

  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== name;
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  if (name === "reviewer") renderReviewer();
  if (name === "signs") renderSigns();
  if (name === "quiz") renderQuiz();
  if (name === "videos") renderVideos();
  if (name === "progress") renderProgress();

  if (push && location.hash !== "#" + name) history.pushState({ view: name }, "", "#" + name);

  window.scrollTo(0, 0);
  observeReveals();
}

document.addEventListener("click", (event) => {
  if (document.body.dataset.state !== "app") return;
  const target = event.target.closest("[data-view]");
  if (target) showView(target.dataset.view);
});

window.addEventListener("popstate", () => {
  if (document.body.dataset.state !== "app") return;
  showView(location.hash.replace("#", "") || "home", { push: false });
});

// ------------------------------------------------------------
// Reviewer
// ------------------------------------------------------------
function renderReviewer() {
  const progress = loadProgress();
  const box = byId("reviewerBody");

  const list = REVIEWER_TOPICS.map((t) => {
    const done = progress.reviewed.includes(t.id);
    return '<button type="button" class="topic-btn' + (selectedTopic === t.id ? " active" : "") + '" data-topic="' + esc(t.id) + '">' +
      "<span>" + esc(t.title) + "</span><small>" + (done ? "✓ Reviewed" : "Open") + "</small></button>";
  }).join("");

  let reader;
  const topic = REVIEWER_TOPICS.find((t) => t.id === selectedTopic);
  if (topic) {
    reader = '<span class="badge">PLACEHOLDER TOPIC</span><h3>' + esc(topic.title) + "</h3>" +
      "<p>The study material for this topic has not been added yet. Your standardized LTO reviewer content will be placed here.</p>";
  } else {
    reader = '<div class="empty">Choose a topic on the left to start reading.</div>';
  }

  box.innerHTML = '<div class="split"><div class="topic-list">' + list + '</div><div class="panel reader">' + reader + "</div></div>";
}

byId("reviewerBody").addEventListener("click", (event) => {
  const button = event.target.closest("[data-topic]");
  if (!button) return;
  selectedTopic = button.dataset.topic;
  const progress = loadProgress();
  if (!progress.reviewed.includes(selectedTopic)) {
    progress.reviewed.push(selectedTopic);
    saveProgress(progress);
  }
  renderReviewer();
});

// ------------------------------------------------------------
// Road signs
// ------------------------------------------------------------
function renderSigns() {
  const box = byId("signsBody");

  const chips = ["All"].concat(SIGN_CATEGORIES).map((c) =>
    '<button type="button" class="chip' + (signFilter === c ? " active" : "") + '" data-filter="' + esc(c) + '">' + esc(c) + "</button>"
  ).join("");

  const shown = SIGNS.filter((s) => signFilter === "All" || s.category === signFilter);

  const cards = shown.length
    ? '<div class="sign-grid">' + shown.map((s) =>
        '<button type="button" class="sign-card reveal' + (selectedSign === s.id ? " active" : "") + '" data-sign="' + esc(s.id) + '">' +
        s.svg + esc(s.name) + "<small>" + esc(s.category) + "</small></button>"
      ).join("") + "</div>"
    : '<div class="empty">No signs have been added to this category yet.</div>';

  const sign = SIGNS.find((s) => s.id === selectedSign);
  const detail = sign
    ? '<div class="panel sign-detail">' + sign.svg + "<dl>" +
      "<dt>NAME</dt><dd>" + esc(sign.name) + "</dd>" +
      "<dt>CATEGORY</dt><dd>" + esc(sign.category) + "</dd>" +
      "<dt>MEANING</dt><dd>" + esc(sign.meaning) + "</dd>" +
      "<dt>EXPLANATION</dt><dd>" + esc(sign.explanation) + "</dd></dl></div>"
    : "";

  box.innerHTML = '<span class="badge">TEMPORARY SAMPLE SIGNS · NOT FROM YOUR REVIEWER</span>' +
    '<div class="chips">' + chips + "</div>" + detail + cards;
  observeReveals();
}

byId("signsBody").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-filter]");
  if (chip) {
    signFilter = chip.dataset.filter;
    renderSigns();
    return;
  }
  const card = event.target.closest("[data-sign]");
  if (card) {
    selectedSign = card.dataset.sign;
    renderSigns();
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }
});

// ------------------------------------------------------------
// Mock test
// ------------------------------------------------------------
function quizScore() {
  return quiz.answers.reduce((total, a, i) => total + (a === QUESTIONS[i].answer ? 1 : 0), 0);
}

function renderQuiz() {
  const box = byId("quizBody");

  if (quiz.stage === "start") {
    box.innerHTML = '<div class="panel"><span class="badge">TEMPORARY SAMPLE QUESTIONS · NOT FROM YOUR REVIEWER</span>' +
      "<h3>Practice test</h3>" +
      '<p class="sub">' + QUESTIONS.length + " multiple-choice questions. Your reviewer questions will replace these later.</p>" +
      '<button type="button" class="primary-btn" data-quiz="start">Start test</button></div>';
    return;
  }

  if (quiz.stage === "done") {
    const score = quizScore();
    const total = QUESTIONS.length;
    const percent = Math.round((score / total) * 100);
    const rows = QUESTIONS.map((q, i) => {
      const ok = quiz.answers[i] === q.answer;
      return "<li>" + (ok ? '<span class="ok">✓</span> ' : '<span class="no">✗</span> ') + esc(q.q) +
        (ok ? "" : "<br>Correct answer: <b>" + esc(q.options[q.answer]) + "</b>") + "</li>";
    }).join("");
    box.innerHTML = '<div class="panel"><p class="eyebrow-c">RESULTS</p>' +
      '<div class="score-big">' + score + " / " + total + "</div>" +
      '<p class="sub">You scored ' + percent + "%.</p>" +
      '<ul class="review-list">' + rows + "</ul>" +
      '<div class="q-nav"><button type="button" class="ghost-btn" data-view="home">Dashboard</button>' +
      '<button type="button" class="primary-btn" data-quiz="retake">Retake test</button></div></div>';
    return;
  }

  const q = QUESTIONS[quiz.i];
  const chosen = quiz.answers[quiz.i];
  const answered = chosen !== undefined;
  const last = quiz.i === QUESTIONS.length - 1;

  const options = q.options.map((text, idx) => {
    let cls = "opt";
    if (answered && idx === q.answer) cls += " correct";
    else if (answered && idx === chosen) cls += " wrong";
    return '<button type="button" class="' + cls + '" data-quiz="opt" data-idx="' + idx + '"' + (answered ? " disabled" : "") + ">" +
      String.fromCharCode(65 + idx) + ". " + esc(text) + "</button>";
  }).join("");

  const explain = answered
    ? '<div class="explain"><b>' + (chosen === q.answer ? "Correct." : "Not quite.") + "</b> " + esc(q.explanation) + "</div>"
    : "";

  box.innerHTML = '<div class="panel">' +
    '<div class="q-top"><span>Question ' + (quiz.i + 1) + " of " + QUESTIONS.length + '</span><span class="badge" style="margin:0">SAMPLE</span></div>' +
    '<div class="q-bar"><span style="width:' + ((quiz.i + (answered ? 1 : 0)) / QUESTIONS.length) * 100 + '%"></span></div>' +
    '<p class="q-text">' + esc(q.q) + "</p>" +
    '<div class="opts">' + options + "</div>" + explain +
    '<div class="q-nav"><button type="button" class="ghost-btn" data-quiz="prev"' + (quiz.i === 0 ? " disabled" : "") + ">← Previous</button>" +
    '<button type="button" class="primary-btn" data-quiz="next"' + (answered ? "" : " disabled") + ">" + (last ? "Finish" : "Next →") + "</button></div></div>";
}

byId("quizBody").addEventListener("click", (event) => {
  const button = event.target.closest("[data-quiz]");
  if (!button) return;
  const action = button.dataset.quiz;

  if (action === "start" || action === "retake") {
    quiz = { stage: "run", i: 0, answers: [] };
  } else if (action === "opt") {
    if (quiz.answers[quiz.i] !== undefined) return;
    quiz.answers[quiz.i] = Number(button.dataset.idx);
  } else if (action === "prev") {
    if (quiz.i > 0) quiz.i -= 1;
  } else if (action === "next") {
    if (quiz.answers[quiz.i] === undefined) return;
    if (quiz.i < QUESTIONS.length - 1) {
      quiz.i += 1;
    } else {
      quiz.stage = "done";
      const progress = loadProgress();
      progress.tests.push({ score: quizScore(), total: QUESTIONS.length, at: Date.now() });
      saveProgress(progress);
    }
  }
  renderQuiz();
});

// ------------------------------------------------------------
// Video lessons
// ------------------------------------------------------------
function renderVideos() {
  const box = byId("videoBody");
  const video = VIDEOS.find((v) => v.id === selectedVideo);

  let player = "";
  if (video) {
    const screen = video.src
      ? '<video class="player" controls playsinline src="' + esc(video.src) + '"></video>'
      : '<div class="player">No video has been uploaded for this lesson yet.</div>';
    player = '<div class="panel" style="margin-bottom:14px">' + screen +
      '<span class="cat">' + esc(video.category.toUpperCase()) + "</span><h3>" + esc(video.title) + "</h3>" +
      '<p class="sub" style="margin:0">' + esc(video.description) + "</p></div>";
  }

  const cards = VIDEOS.map((v) =>
    '<button type="button" class="video-card reveal" data-video="' + esc(v.id) + '">' +
    '<div class="thumb">▶</div><div class="meta"><span class="cat">' + esc(v.category.toUpperCase()) + "</span>" +
    "<strong>" + esc(v.title) + "</strong><p>" + esc(v.description) + "</p></div></button>"
  ).join("");

  box.innerHTML = '<span class="badge">PLACEHOLDERS · NO VIDEOS UPLOADED YET</span>' + player + '<div class="video-grid">' + cards + "</div>";
  observeReveals();
}

byId("videoBody").addEventListener("click", (event) => {
  const card = event.target.closest("[data-video]");
  if (!card) return;
  selectedVideo = card.dataset.video;
  renderVideos();
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
});

// ------------------------------------------------------------
// My progress
// ------------------------------------------------------------
function renderProgress() {
  const progress = loadProgress();
  const tests = progress.tests;
  const count = tests.length;
  const latest = count ? tests[count - 1] : null;
  const best = count ? tests.reduce((b, t) => (t.score / t.total > b.score / b.total ? t : b), tests[0]) : null;
  const reviewed = progress.reviewed.filter((id) => REVIEWER_TOPICS.some((t) => t.id === id)).length;
  const topicTotal = REVIEWER_TOPICS.length;

  const stat = (value, label) => '<div class="stat"><b>' + esc(value) + "</b><span>" + esc(label) + "</span></div>";

  const attempts = count
    ? '<ul class="attempts">' + tests.slice().reverse().slice(0, 8).map((t) =>
        "<li><span>" + esc(new Date(t.at).toLocaleDateString()) + "</span><b>" + t.score + " / " + t.total + "</b></li>"
      ).join("") + "</ul>"
    : '<div class="empty">No tests taken yet. Take a mock test and your results will appear here.</div>';

  byId("progressBody").innerHTML = '<div class="stats">' +
    stat(String(count), "Tests completed") +
    stat(latest ? latest.score + " / " + latest.total : "—", "Latest score") +
    stat(best ? best.score + " / " + best.total : "—", "Best score") +
    stat(reviewed + " / " + topicTotal, "Topics reviewed") +
    "</div>" +
    '<div class="panel"><h3>Recent tests</h3>' + attempts +
    '<p class="sub" style="margin:14px 0 0;font-size:12px">Saved on this device for your account. Syncing to your online account comes later.</p></div>';
}

// ------------------------------------------------------------
// 3D effects: scroll reveal, scroll parallax, mouse tilt
// ------------------------------------------------------------
let revealObserver = null;

function observeReveals() {
  const items = document.querySelectorAll("[data-view-panel]:not([hidden]) .reveal:not(.in)");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
  }
  items.forEach((el, i) => {
    el.style.setProperty("--d", (i % 6) * 0.06 + "s");
    revealObserver.observe(el);
  });
}

let scrollTicking = false;
window.addEventListener("scroll", () => {
  if (reduceMotion || scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    document.documentElement.style.setProperty("--scroll", String(window.scrollY));
    scrollTicking = false;
  });
}, { passive: true });

if (!reduceMotion) {
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const card = event.target.closest && event.target.closest(".card3d");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width - 0.5;
    const y = (event.clientY - r.top) / r.height - 0.5;
    card.style.setProperty("--ry", (x * 10).toFixed(1) + "deg");
    card.style.setProperty("--rx", (-y * 10).toFixed(1) + "deg");
  });
  document.addEventListener("pointerout", (event) => {
    const card = event.target.closest && event.target.closest(".card3d");
    if (!card) return;
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
}

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------
async function startApp() {
  setMode("login");
  byId("year").textContent = new Date().getFullYear();

  const client = initializeSupabase();
  if (!client) {
    setState("login");
    return;
  }

  if (!authListenerSet) {
    authListenerSet = true;
    client.auth.onAuthStateChange((event) => {
      // Session ended on its own (expired or signed out elsewhere)
      if (event === "SIGNED_OUT" && document.body.dataset.state === "app" && !loggingOut) {
        goToLogin("Your session ended. Please sign in again.", "info");
      }
    });
  }

  try {
    const { data, error } = await client.auth.getSession();
    if (!error && data.session) {
      await enterApp(data.session, true);
    } else {
      setState("login");
    }
  } catch (error) {
    setState("login");
  }
}

startApp();
