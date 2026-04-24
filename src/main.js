/**
 * @fileoverview CivicAI – Main Application Controller
 * Handles navigation, chat UI, registration flow, guide tabs,
 * fact-checking, quiz, language switching, voice/TTS, and profile.
 * @module main
 */

import './style.css';
import {
  getAIResponse, detectMisinformation,
  getTimeline, simulateScenario, getQuizQuestions, getReminders,
  getJourneyDetail, getUserContext, updateUserProfile,
  setLanguage, setEli10, getStateName, logActivity, initializeAIService,
  validateAadhaar, validateMobile, sendOTP, verifyOTP,
  performRegistration, getJourneyStatus, getStateData, getDistricts,
  findPollingBooth, assignBooth, getElectionDayChecklist, getCandidates
} from './ai-service.js';

// ─── State ───
let currentView = 'chat';
let eli10Enabled = false;
let currentLang = 'en';
let quizState = { current: 0, score: 0, answered: false };
let isProcessing = false;

/**
 * Bootstraps the entire CivicAI application.
 * Initializes all modules: navigation, chat, registration, guide,
 * verification, timeline, dashboard, booth finder, election day,
 * candidates, quiz, language, ELI10, voice, TTS, and animations.
 */
async function initializeApp() {
  try {
    initNavigation();
    initChat();
    initRegistration();
    initGuideTabs();
    initVerifyTabs();
    initTimeline();
    initDashboard();
    initBoothFinder();
    initElectionDay();
    initCandidates();
    initQuiz();
    initLanguage();
    initEli10();
    initVoice();
    initTTS();
    initHeroJourney();
    initScrollAnimations();

    await initializeAIService();
  } catch (err) {
    alert("Initialization Error: " + err.message + "\n\nStack: " + err.stack);
    console.error("Initialization Error:", err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// ═══════════════════ NAVIGATION ═══════════════════
function initNavigation() {
  window.navigateTo = navigateTo;
}

/**
 * Navigates to a specific view by ID.
 * Hides all other views, activates the nav button, and triggers
 * view-specific rendering (guide reminders, profile updates, etc.).
 * @param {string} viewId - The view identifier (chat|register|guide|verify|profile).
 */
function navigateTo(viewId) {
  document.querySelectorAll('.view-page').forEach(v => {
    v.classList.add('hidden');
    v.style.opacity = '0';
  });
  const target = document.getElementById(`view-${viewId}`);
  if (target) {
    target.classList.remove('hidden');
    requestAnimationFrame(() => { target.style.opacity = '1'; });
  }
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isActive = btn.dataset.nav === viewId;
    btn.classList.remove('nav-active');
    if (isActive) {
      btn.classList.add('nav-active');
      btn.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 1";
    } else {
      btn.classList.remove('nav-active');
      btn.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 0";
    }
  });
  currentView = viewId;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (viewId === 'guide') { renderReminders(); renderJourneyTracker(); }
  if (viewId === 'profile') { updateProfilePage(); }
  updateHeroStats();
  setTimeout(initScrollAnimations, 100);
}

// ═══════════════════ CHAT ═══════════════════
function initChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  addAIMessage("Hello! I'm your CivicAI assistant. I can help you find your polling place, understand ballot measures, check registration deadlines, or detect misinformation. How can I assist you today?",
    "I'm like a friendly helper who knows everything about voting! Ask me anything!", 99);
  sendBtn.addEventListener('click', () => sendMessage());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.querySelectorAll('.quick-prompt').forEach(btn => {
    btn.addEventListener('click', () => { input.value = btn.textContent.trim(); sendMessage(); });
  });
}

/**
 * Sends the user's chat message to the AI service and renders the response.
 * Prevents duplicate submissions via the `isProcessing` flag.
 */
async function sendMessage() {
  if (isProcessing) return;
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  isProcessing = true;
  input.value = '';
  addUserMessage(message);
  const typingEl = addTypingIndicator();
  try {
    const response = await getAIResponse(message);
    typingEl.remove();
    addAIMessage(response.text, response.eli10, response.confidence);
    updateHeroStats();
  } catch (err) {
    typingEl.remove();
    addAIMessage("I apologize, I encountered an error. Please try again.", null, 50);
  }
  isProcessing = false;
}

function addUserMessage(text) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'flex gap-3 max-w-[85%] ml-auto flex-row-reverse msg-enter';
  div.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-civic-accent flex-shrink-0 flex items-center justify-center">
      <span class="material-symbols-outlined text-white text-sm">person</span>
    </div>
    <div class="p-3 rounded-2xl rounded-br-sm bg-civic-blue text-white shadow-md text-sm leading-relaxed">${escapeHtml(text)}</div>
  `;
  container.appendChild(div);
  scrollChat();
}

function addAIMessage(text, eli10Text, confidence) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'flex gap-3 max-w-[90%] msg-enter';
  const formatted = formatMarkdown(text);
  const eli10Html = eli10Text ? `<div class="eli10-content ${eli10Enabled ? 'active' : ''} bg-amber-50/50 p-3 rounded-xl border border-amber-100 text-sm text-amber-900 italic">🧒 <strong>Simple explanation:</strong> ${escapeHtml(eli10Text)}</div>` : '';
  const cc = confidence >= 90 ? 'text-emerald-600 bg-emerald-50' : confidence >= 70 ? 'text-blue-600 bg-blue-50' : 'text-amber-600 bg-amber-50';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-civic-blue to-civic-accent flex-shrink-0 flex items-center justify-center pulse-ai">
      <span class="material-symbols-outlined text-white text-sm">smart_toy</span>
    </div>
    <div class="space-y-2 flex-1">
      <div class="p-3 rounded-2xl rounded-bl-sm bg-white border border-slate-100 text-slate-800 text-sm leading-relaxed shadow-sm">
        ${formatted}${eli10Html}
      </div>
      <div class="flex items-center gap-2">
        <span class="flex items-center text-[10px] ${cc} font-bold px-2 py-0.5 rounded">
          <span class="material-symbols-outlined text-[12px] mr-1">verified_user</span>CONFIDENCE: ${confidence}%
        </span>
        <span class="text-[10px] text-slate-400">${time}</span>
      </div>
    </div>
  `;
  container.appendChild(div);
  scrollChat();
}

function addTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'flex gap-3 max-w-[85%] msg-enter';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-civic-blue to-civic-accent flex-shrink-0 flex items-center justify-center pulse-ai">
      <span class="material-symbols-outlined text-white text-sm">smart_toy</span>
    </div>
    <div class="flex items-center gap-1 p-3 bg-white rounded-2xl border border-slate-100">
      <div class="flex gap-1.5 mr-3"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
      <span class="text-sm text-slate-500 font-medium italic">AI is analyzing...</span>
    </div>
  `;
  container.appendChild(div);
  scrollChat();
  return div;
}

function scrollChat() {
  const c = document.getElementById('chat-messages');
  requestAnimationFrame(() => { c.scrollTop = c.scrollHeight; });
}

// ═══════════════════ REGISTRATION ═══════════════════
function initRegistration() {
  const stateData = getStateData();
  // Populate districts on state change
  const regState = document.getElementById('reg-state');
  const regDistrict = document.getElementById('reg-district');
  regState.addEventListener('change', () => {
    const districts = getDistricts(regState.value);
    regDistrict.innerHTML = '<option value="">Select District</option>' + districts.map(d => `<option value="${d}">${d}</option>`).join('');
  });

  // Aadhaar formatting
  const aadhaarInput = document.getElementById('reg-aadhaar');
  aadhaarInput.addEventListener('input', () => {
    let v = aadhaarInput.value.replace(/\D/g, '').slice(0, 12);
    aadhaarInput.value = v.replace(/(\d{4})(?=\d)/g, '$1 ');
    const result = validateAadhaar(v);
    const fb = document.getElementById('aadhaar-feedback');
    if (v.length >= 12) {
      fb.classList.remove('hidden');
      fb.className = result.valid ? 'text-sm p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200';
      fb.textContent = result.valid ? `✅ Valid Aadhaar: ${result.masked}` : `❌ ${result.error}`;
      if (result.valid) document.getElementById('doc-id').textContent = 'check_circle';
    } else { fb.classList.add('hidden'); }
  });

  // Step 1 → 2
  document.getElementById('reg-next-1').addEventListener('click', () => {
    const name = document.getElementById('reg-name').value.trim();
    const dob = document.getElementById('reg-dob').value;
    const state = regState.value;
    const district = regDistrict.value;
    if (!name || !dob || !state || !district) { alert('Please fill all required fields.'); return; }
    updateUserProfile({ fullName: name, dob, state, district, firstTimeVoter: document.getElementById('reg-firsttime').checked });
    document.getElementById('doc-age').textContent = 'check_circle';
    showRegStep(2);
  });

  // Step 2 → 3
  document.getElementById('reg-next-2').addEventListener('click', () => {
    const aadhaar = document.getElementById('reg-aadhaar').value.replace(/\s/g, '');
    const mobile = document.getElementById('reg-mobile').value.trim();
    const address = document.getElementById('reg-address').value.trim();
    const av = validateAadhaar(aadhaar);
    const mv = validateMobile(mobile);
    if (!av.valid) { alert(av.error); return; }
    if (!mv.valid) { alert(mv.error); return; }
    if (!address) { alert('Please enter your address.'); return; }
    document.getElementById('doc-address').textContent = 'check_circle';
    document.getElementById('doc-mobile').textContent = 'check_circle';
    const otpResult = sendOTP(mobile);
    document.getElementById('otp-hint').textContent = otpResult.hint;
    showRegStep(3);
  });

  // Back buttons
  document.getElementById('reg-back-2').addEventListener('click', () => showRegStep(1));

  // OTP verify
  document.getElementById('reg-verify-otp').addEventListener('click', () => {
    const otp = document.getElementById('reg-otp').value.trim();
    const result = verifyOTP(otp);
    const fb = document.getElementById('otp-feedback');
    fb.classList.remove('hidden');
    if (result.success) {
      fb.className = 'text-sm p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200';
      fb.textContent = '✅ ' + result.message;
      setTimeout(() => completeRegistration(), 1000);
    } else {
      fb.className = 'text-sm p-3 rounded-lg bg-red-50 text-red-700 border border-red-200';
      fb.textContent = '❌ ' + result.message;
    }
  });

  document.getElementById('reg-resend-otp').addEventListener('click', () => {
    const mobile = document.getElementById('reg-mobile').value.trim();
    const otpResult = sendOTP(mobile);
    document.getElementById('otp-hint').textContent = otpResult.hint;
  });
}

function showRegStep(step) {
  document.querySelectorAll('.reg-step').forEach(s => s.classList.add('hidden'));
  document.getElementById(`reg-step-${step}`).classList.remove('hidden');
  // Update indicators
  for (let i = 1; i <= 4; i++) {
    const ind = document.getElementById(`reg-step-${i}-ind`);
    ind.classList.remove('active', 'done');
    if (i < step) ind.classList.add('done');
    else if (i === step) ind.classList.add('active');
  }
}

function completeRegistration() {
  const ctx = getUserContext();
  const result = performRegistration({
    fullName: ctx.fullName, dob: ctx.dob, age: ctx.age, state: ctx.state,
    district: ctx.district, firstTimeVoter: ctx.firstTimeVoter,
    aadhaar: document.getElementById('reg-aadhaar').value.replace(/\s/g, ''),
    mobile: document.getElementById('reg-mobile').value.trim(),
    address: document.getElementById('reg-address').value.trim()
  });
  showRegStep(4);
  const container = document.getElementById('reg-result-content');
  if (result.overallStatus === 'success') {
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span class="material-symbols-outlined text-civic-emerald text-3xl">check_circle</span>
        </div>
        <h2 class="text-heading text-civic-blue mb-2">Registration Successful! 🎉</h2>
        <p class="text-body text-civic-muted mb-4">Welcome, ${ctx.fullName}! Your voter registration is complete.</p>
        <div class="bg-civic-surface rounded-xl p-4 text-left space-y-2 mb-4">
          <p class="text-sm"><strong>Name:</strong> ${ctx.fullName}</p>
          <p class="text-sm"><strong>State:</strong> ${getStateName(ctx.state)}</p>
          <p class="text-sm"><strong>District:</strong> ${ctx.district}</p>
          <p class="text-sm"><strong>Status:</strong> <span class="text-civic-emerald font-bold">Verified ✅</span></p>
        </div>
        <div class="space-y-2">${result.nextSteps.map(s => `<p class="text-sm text-civic-muted">• ${s}</p>`).join('')}</div>
        <button onclick="navigateTo('guide')" class="mt-4 px-6 py-3 bg-civic-blue text-white font-semibold rounded-xl hover:bg-civic-accent transition-all active:scale-95 shadow-md">Go to Guide →</button>
      </div>`;
  } else {
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span class="material-symbols-outlined text-civic-warn text-3xl">warning</span>
        </div>
        <h2 class="text-heading text-civic-blue mb-2">Registration Incomplete</h2>
        <p class="text-body text-civic-muted mb-4">Some items need attention:</p>
        <div class="space-y-2 text-left">${result.nextSteps.map(s => `<p class="text-sm text-amber-700">⚠️ ${s}</p>`).join('')}</div>
      </div>`;
  }
  updateHeroStats();
  updateHeroJourney();
}

// ═══════════════════ GUIDE TABS ═══════════════════
function initGuideTabs() {
  document.querySelectorAll('.guide-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.guide-tab').forEach(b => {
        b.className = 'guide-tab px-4 py-2 rounded-full text-sm font-semibold bg-white text-civic-muted border border-slate-200 hover:border-civic-accent active:scale-95 transition-all';
      });
      btn.className = 'guide-tab px-4 py-2 rounded-full text-sm font-semibold bg-civic-blue text-white shadow-md active:scale-95 transition-all';
      document.querySelectorAll('.guide-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(`guide-${btn.dataset.guide}`).classList.remove('hidden');
    });
  });
}

// ═══════════════════ VERIFY TABS ═══════════════════
function initVerifyTabs() {
  document.querySelectorAll('.verify-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.verify-tab').forEach(b => {
        b.className = 'verify-tab px-4 py-2 rounded-full text-sm font-semibold bg-white text-civic-muted border border-slate-200 active:scale-95 transition-all';
      });
      btn.className = 'verify-tab px-4 py-2 rounded-full text-sm font-semibold bg-civic-blue text-white shadow-md active:scale-95 transition-all';
      document.querySelectorAll('.verify-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(`verify-${btn.dataset.verify}`).classList.remove('hidden');
    });
  });

  // Fact checker
  document.getElementById('verify-btn').addEventListener('click', runFactCheck);
  window.showJourneyDetail = showJourneyDetail;
}

/** Runs the misinformation detection flow and renders results. */
async function runFactCheck() {
  const input = document.getElementById('verify-input');
  const message = input.value.trim();
  if (!message) return;
  const panel = document.getElementById('misinfo-panel');
  panel.classList.add('is-scanning');
  document.getElementById('verify-results').classList.add('hidden');
  try {
    const result = await detectMisinformation(message);
    panel.classList.remove('is-scanning');
    document.getElementById('verify-results').classList.remove('hidden');
    // Verdict
    const vt = document.getElementById('verdict-text');
    const vc = document.getElementById('verdict-card');
    vt.textContent = result.verdict;
    const verdictColors = { 'False': 'border-red-300 bg-red-50', 'True': 'border-emerald-300 bg-emerald-50', 'Uncertain': 'border-amber-300 bg-amber-50' };
    vc.className = `p-3 rounded-xl border text-center ${verdictColors[result.verdict] || 'border-slate-200'}`;
    // Risk
    const rl = document.getElementById('risk-level');
    const rc = document.getElementById('risk-card');
    const riskColors = { 'Critical': 'text-red-700 border-red-300 bg-red-50', 'High': 'text-red-600 border-red-200 bg-red-50', 'Medium': 'text-amber-600 border-amber-200 bg-amber-50', 'Low': 'text-emerald-600 border-emerald-200 bg-emerald-50' };
    const rc2 = riskColors[result.risk] || riskColors['Low'];
    rl.textContent = result.risk + ' Risk';
    rc.className = `p-3 rounded-xl border text-center ${rc2}`;
    document.getElementById('confidence-score').textContent = `${result.confidence}%`;
    document.getElementById('source-reliability').textContent = result.reliability;
    document.getElementById('fact-check-text').textContent = result.fact;
    updateHeroStats();
  } catch (err) {
    panel.classList.remove('is-scanning');
    alert('Error running fact check.');
  }
}

function showJourneyDetail(step) {
  const detail = getJourneyDetail(step);
  if (!detail) return;
  alert(`${detail.title}\n\n${detail.text}`);
}

// ═══════════════════ TIMELINE ═══════════════════
function initTimeline() {
  renderTimeline('general');
  document.querySelectorAll('.tl-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tl-type-btn').forEach(b => {
        b.className = 'tl-type-btn px-4 py-2 rounded-full text-sm font-semibold bg-white text-civic-muted border border-slate-200 active:scale-95 transition-all';
      });
      btn.className = 'tl-type-btn px-4 py-2 rounded-full text-sm font-semibold bg-civic-blue text-white shadow-md active:scale-95 transition-all';
      renderTimeline(btn.dataset.tl);
    });
  });
  // Scenario buttons
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = simulateScenario(btn.textContent);
      const el = document.getElementById('scenario-result');
      el.classList.remove('hidden');
      el.innerHTML = `<div class="font-bold mb-2">${result.outcome}</div><ul class="space-y-1 mb-3">${result.alternatives.map(a => `<li class="text-sm">• ${a}</li>`).join('')}</ul><div class="text-amber-700 font-medium text-sm">${result.tip}</div>`;
    });
  });
}

function renderTimeline(type) {
  const data = getTimeline(type);
  const container = document.getElementById('timeline-content');
  container.innerHTML = '';
  data.forEach((item, i) => {
    const isComplete = item.status === 'complete';
    const isCurrent = item.status === 'current';
    const opacity = item.status === 'upcoming' ? 'opacity-60' : '';
    let dot;
    if (isComplete) dot = `<div class="absolute left-[-45px] top-1 w-7 h-7 rounded-full bg-civic-emerald flex items-center justify-center ring-4 ring-civic-navy shadow-md"><span class="material-symbols-outlined text-[14px] text-white" style="font-variation-settings:'FILL' 1">check</span></div>`;
    else if (isCurrent) dot = `<div class="absolute left-[-45px] top-1 w-7 h-7 rounded-full bg-white flex items-center justify-center ring-4 ring-civic-navy shadow-md"><div class="w-3 h-3 rounded-full bg-civic-emerald animate-pulse"></div></div>`;
    else dot = `<div class="absolute left-[-45px] top-1 w-7 h-7 rounded-full bg-civic-navy border-2 border-white/30 ring-4 ring-civic-navy"></div>`;
    const badge = isCurrent ? `<span class="bg-civic-emerald/30 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-black border border-civic-emerald/50 ml-2">CURRENT</span>` : '';
    const el = document.createElement('div');
    el.className = `relative ${opacity} fade-in-item`;
    el.style.animationDelay = `${i * 0.15}s`;
    el.innerHTML = `${dot}<div class="space-y-1"><div class="flex items-center"><span class="text-xs font-bold uppercase tracking-widest ${isCurrent ? 'text-white' : isComplete ? 'text-emerald-300' : 'text-slate-400'}">${item.date}</span>${badge}</div><h4 class="font-semibold text-lg ${isCurrent ? 'text-white' : ''}">${item.title}</h4><p class="text-slate-300 text-sm">${item.desc}</p></div>`;
    container.appendChild(el);
  });
}

// ═══════════════════ DASHBOARD ═══════════════════
function initDashboard() {
  renderVotingPlan();
  renderReminders();
  renderJourneyTracker();
}

function renderVotingPlan() {
  const steps = [
    { icon: 'how_to_reg', color: 'bg-emerald-100 text-civic-emerald', title: 'Step 1: Check Registration', desc: 'Verify your voter registration status at nvsp.in.', action: 'Verify Status →' },
    { icon: 'auto_stories', color: 'bg-blue-100 text-civic-accent', title: 'Step 2: Research & Prepare', desc: 'Gather your Voter ID or alternative photo ID.', action: 'Document Checklist →' },
    { icon: 'where_to_vote', color: 'bg-amber-100 text-civic-warn', title: 'Step 3: Plan Your Vote', desc: 'Find your polling station and plan your route.', action: 'Find Station →' }
  ];
  const container = document.getElementById('voting-plan-steps');
  container.innerHTML = '';
  steps.forEach((step, i) => {
    const el = document.createElement('div');
    el.className = 'flex gap-3 bg-civic-surface p-4 rounded-xl border border-slate-100 hover:border-civic-accent/30 transition-colors group animate-fadeIn';
    el.style.animationDelay = `${i * 0.1}s`;
    el.innerHTML = `<div class="flex-shrink-0 w-10 h-10 ${step.color} rounded-lg flex items-center justify-center"><span class="material-symbols-outlined text-lg">${step.icon}</span></div><div><h3 class="font-semibold text-sm text-civic-blue">${step.title}</h3><p class="text-xs text-civic-muted mt-0.5">${step.desc}</p></div>`;
    container.appendChild(el);
  });
}

function renderReminders() {
  const reminders = getReminders();
  const container = document.getElementById('reminders-list');
  if (!container) return;
  container.innerHTML = '';
  reminders.forEach(r => {
    const el = document.createElement('div');
    el.className = 'flex items-center justify-between p-3 bg-civic-surface rounded-lg';
    el.innerHTML = `<div class="flex items-center gap-3"><div class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-civic-blue shadow-sm"><span class="material-symbols-outlined text-lg">${r.icon}</span></div><div><p class="text-sm font-semibold text-civic-blue">${r.title}</p><p class="text-[10px] text-civic-muted">${r.subtitle}</p></div></div><label class="relative inline-flex items-center cursor-pointer"><input class="sr-only peer" type="checkbox" ${r.enabled ? 'checked' : ''}/><div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-civic-emerald"></div></label>`;
    container.appendChild(el);
  });
}

function renderJourneyTracker() {
  const journey = getJourneyStatus();
  const container = document.getElementById('journey-tracker');
  if (!container) return;
  container.innerHTML = '';
  journey.steps.forEach((step, i) => {
    const done = step.status === 'complete';
    const current = step.status === 'in_progress';
    const el = document.createElement('div');
    el.className = `relative ${!done && !current ? 'opacity-50' : ''}`;
    const dotColor = done ? 'bg-emerald-400' : current ? 'bg-white' : 'bg-slate-500';
    const inner = current ? '<div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>' : done ? '<span class="material-symbols-outlined text-[10px] text-white" style="font-variation-settings:\'FILL\' 1">check</span>' : '';
    el.innerHTML = `<div class="absolute -left-[25px] top-0.5 w-5 h-5 rounded-full ${dotColor} flex items-center justify-center ring-2 ring-white/20">${inner}</div><p class="text-sm font-medium ${current ? 'text-white' : 'text-slate-300'}">${step.label}</p>`;
    container.appendChild(el);
  });
}

// ═══════════════════ BOOTH FINDER ═══════════════════
function initBoothFinder() {
  const bs = document.getElementById('booth-state');
  const bd = document.getElementById('booth-district');
  bs.addEventListener('change', () => {
    const districts = getDistricts(bs.value);
    bd.innerHTML = '<option value="">Select District</option>' + districts.map(d => `<option value="${d}">${d}</option>`).join('');
  });
  document.getElementById('find-booth-btn').addEventListener('click', () => {
    if (!bs.value) { alert('Please select a state.'); return; }
    const booths = findPollingBooth(bs.value, bd.value);
    const container = document.getElementById('booth-results');
    container.innerHTML = '';
    booths.forEach(booth => {
      const card = document.createElement('div');
      card.className = 'booth-card bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 animate-fadeIn';
      card.innerHTML = `
        <div class="flex items-start justify-between mb-3"><h3 class="text-subheading text-civic-blue flex items-center gap-2"><span class="material-symbols-outlined text-civic-emerald">location_on</span>${booth.name}</h3><span class="text-caption text-civic-emerald bg-emerald-50 px-2 py-0.5 rounded-full">${booth.distance}</span></div>
        <p class="text-sm text-civic-muted mb-2">📫 ${booth.address}</p>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="text-xs text-civic-muted"><strong>Landmark:</strong> ${booth.landmark}</div>
          <div class="text-xs text-civic-muted"><strong>Crowd:</strong> ${booth.crowd}</div>
          <div class="text-xs text-civic-muted"><strong>Best Time:</strong> ${booth.bestTime}</div>
          <div class="text-xs text-civic-muted"><strong>ID:</strong> ${booth.id}</div>
        </div>
        <div class="bg-civic-surface rounded-lg p-3 text-xs text-civic-muted"><strong>🗺️ Directions:</strong> ${booth.directions}</div>
      `;
      container.appendChild(card);
    });
    if (booths.length > 0) { assignBooth(bs.value, bd.value); updateHeroJourney(); }
  });
}

// ═══════════════════ ELECTION DAY ═══════════════════
function initElectionDay() {
  const data = getElectionDayChecklist();
  // What to carry
  const cc = document.getElementById('carry-checklist');
  data.whatToCarry.forEach(item => {
    const el = document.createElement('div');
    el.className = 'flex items-center gap-3 p-3 bg-civic-surface rounded-xl';
    el.innerHTML = `<span class="material-symbols-outlined text-civic-blue">${item.icon}</span><div><p class="text-sm font-semibold">${item.item} ${item.required ? '<span class="text-red-500">*</span>' : ''}</p><p class="text-[11px] text-civic-muted">${item.note}</p></div>`;
    cc.appendChild(el);
  });
  // Voting process
  const vps = document.getElementById('voting-process-steps');
  data.votingProcess.forEach(step => {
    const el = document.createElement('div');
    el.className = 'flex gap-3 items-start';
    el.innerHTML = `<div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"><span class="text-sm font-bold text-emerald-300">${step.step}</span></div><div><h4 class="font-semibold text-sm">${step.title}</h4><p class="text-slate-300 text-xs mt-0.5">${step.desc}</p></div>`;
    vps.appendChild(el);
  });
  // Inside booth
  document.getElementById('inside-booth-text').textContent = data.insideBooth;
}

// ═══════════════════ CANDIDATES ═══════════════════
function initCandidates() {
  const cs = document.getElementById('candidate-state');
  document.getElementById('load-candidates-btn').addEventListener('click', () => {
    if (!cs.value) { alert('Please select a state.'); return; }
    const candidates = getCandidates(cs.value);
    const grid = document.getElementById('candidates-grid');
    grid.innerHTML = '';
    candidates.forEach(c => {
      const card = document.createElement('div');
      card.className = 'candidate-card bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 animate-fadeIn';
      card.innerHTML = `
        <div class="flex items-center gap-3 mb-3"><div class="w-12 h-12 rounded-xl bg-civic-surface flex items-center justify-center text-2xl">${c.symbol}</div><div><h3 class="font-semibold text-civic-blue">${c.name}</h3><p class="text-xs text-civic-muted">${c.party}</p></div></div>
        <div class="space-y-1 text-xs text-civic-muted">
          <p>🎂 Age: ${c.age} | 🎓 ${c.education}</p>
          <p>💼 ${c.profession}</p>
          <p>📋 ${c.experience}</p>
          <p>📍 ${c.constituency}</p>
        </div>`;
      grid.appendChild(card);
    });
    // Comparison table
    const section = document.getElementById('comparison-section');
    section.classList.remove('hidden');
    const table = document.getElementById('comparison-table');
    table.innerHTML = `<thead><tr class="border-b border-slate-200"><th class="p-2 text-left text-civic-blue">Attribute</th>${candidates.map(c => `<th class="p-2 text-left text-civic-blue">${c.name}</th>`).join('')}</tr></thead>
    <tbody>
      <tr class="border-b border-slate-100"><td class="p-2 font-medium">Party</td>${candidates.map(c => `<td class="p-2">${c.party} ${c.symbol}</td>`).join('')}</tr>
      <tr class="border-b border-slate-100"><td class="p-2 font-medium">Age</td>${candidates.map(c => `<td class="p-2">${c.age}</td>`).join('')}</tr>
      <tr class="border-b border-slate-100"><td class="p-2 font-medium">Education</td>${candidates.map(c => `<td class="p-2">${c.education}</td>`).join('')}</tr>
      <tr class="border-b border-slate-100"><td class="p-2 font-medium">Profession</td>${candidates.map(c => `<td class="p-2">${c.profession}</td>`).join('')}</tr>
      <tr><td class="p-2 font-medium">Experience</td>${candidates.map(c => `<td class="p-2">${c.experience}</td>`).join('')}</tr>
    </tbody>`;
  });
}

// ═══════════════════ QUIZ ═══════════════════
function initQuiz() {
  document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
  document.getElementById('quiz-next-btn').addEventListener('click', nextQuestion);
  window.closeQuiz = closeQuiz;
}

function startQuiz() {
  quizState = { current: 0, score: 0, answered: false };
  document.getElementById('quiz-modal').classList.remove('hidden');
  document.getElementById('quiz-complete').classList.add('hidden');
  document.getElementById('quiz-question').classList.remove('hidden');
  document.getElementById('quiz-options').classList.remove('hidden');
  logActivity('quiz', 'Started quiz');
  renderQuestion();
}

function renderQuestion() {
  const questions = getQuizQuestions();
  const q = questions[quizState.current];
  document.getElementById('quiz-current').textContent = quizState.current + 1;
  document.getElementById('quiz-total').textContent = questions.length;
  document.getElementById('quiz-progress').style.width = `${((quizState.current + 1) / questions.length) * 100}%`;
  document.getElementById('quiz-question').textContent = q.question;
  document.getElementById('quiz-feedback').classList.add('hidden');
  document.getElementById('quiz-next-btn').classList.add('hidden');
  document.getElementById('quiz-score-display').textContent = `Score: ${quizState.score}`;
  const opts = document.getElementById('quiz-options');
  opts.innerHTML = '';
  quizState.answered = false;
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option w-full text-left p-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:border-civic-accent transition-all';
    btn.textContent = opt;
    btn.addEventListener('click', () => answerQuestion(i));
    opts.appendChild(btn);
  });
}

function answerQuestion(index) {
  if (quizState.answered) return;
  quizState.answered = true;
  const questions = getQuizQuestions();
  const q = questions[quizState.current];
  document.querySelectorAll('.quiz-option').forEach((opt, i) => {
    opt.classList.add('disabled');
    if (i === q.correct) opt.classList.add('correct');
    if (i === index && i !== q.correct) opt.classList.add('incorrect');
  });
  const fb = document.getElementById('quiz-feedback');
  fb.classList.remove('hidden');
  if (index === q.correct) {
    quizState.score++;
    fb.className = 'p-3 rounded-xl text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 mb-4';
    fb.innerHTML = `✅ <strong>Correct!</strong> ${q.explanation}`;
  } else {
    fb.className = 'p-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-800 mb-4';
    fb.innerHTML = `❌ <strong>Incorrect.</strong> Answer: "${q.options[q.correct]}". ${q.explanation}`;
  }
  document.getElementById('quiz-score-display').textContent = `Score: ${quizState.score}`;
  if (quizState.current < questions.length - 1) {
    document.getElementById('quiz-next-btn').classList.remove('hidden');
  } else {
    setTimeout(() => {
      document.getElementById('quiz-question').classList.add('hidden');
      document.getElementById('quiz-options').classList.add('hidden');
      document.getElementById('quiz-feedback').classList.add('hidden');
      document.getElementById('quiz-next-btn').classList.add('hidden');
      document.getElementById('quiz-complete').classList.remove('hidden');
      document.getElementById('quiz-final-score').textContent = `You scored ${quizState.score} out of ${questions.length}!`;
      const ctx = getUserContext();
      ctx.quizScore = Math.max(ctx.quizScore, quizState.score);
      ctx.impactScore += quizState.score * 20;
      logActivity('quiz', `Completed quiz: ${quizState.score}/${questions.length}`);
      updateHeroStats();
    }, 1500);
  }
}

function nextQuestion() { quizState.current++; renderQuestion(); }
function closeQuiz() { document.getElementById('quiz-modal').classList.add('hidden'); }

// ═══════════════════ LANGUAGE ═══════════════════
function initLanguage() {
  const langBtn = document.getElementById('lang-btn');
  const dropdown = document.getElementById('lang-dropdown');
  langBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('hidden'); });
  document.addEventListener('click', () => dropdown.classList.add('hidden'));
  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.addEventListener('click', () => {
      currentLang = btn.dataset.lang;
      setLanguage(currentLang);
      document.documentElement.lang = currentLang;
      document.querySelectorAll('.lang-check').forEach(c => c.classList.add('hidden'));
      btn.querySelector('.lang-check').classList.remove('hidden');
      dropdown.classList.add('hidden');
      logActivity('settings', `Language: ${currentLang}`);
    });
  });
  document.querySelectorAll('.acc-lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.acc-lang-btn').forEach(b => {
        b.className = 'acc-lang-btn w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 font-medium text-sm text-slate-600 hover:border-civic-accent transition-all';
      });
      btn.className = 'acc-lang-btn w-full flex items-center justify-between p-3 rounded-xl border-2 border-civic-accent bg-blue-50 font-semibold text-sm';
      currentLang = btn.dataset.lang;
      setLanguage(currentLang);
      document.documentElement.lang = currentLang;
    });
  });
}

// ═══════════════════ ELI10 ═══════════════════
function initEli10() {
  document.getElementById('eli10-toggle').addEventListener('click', toggleEli10);
}

function toggleEli10() {
  eli10Enabled = !eli10Enabled;
  setEli10(eli10Enabled);
  document.querySelectorAll('.eli10-content').forEach(el => el.classList.toggle('active', eli10Enabled));
  const btn = document.getElementById('eli10-toggle');
  btn.className = eli10Enabled
    ? 'p-2 bg-amber-100 text-amber-700 transition-colors rounded-full active:scale-90'
    : 'p-2 hover:bg-amber-50 transition-colors rounded-full text-civic-muted active:scale-90';
  logActivity('settings', `ELI10 ${eli10Enabled ? 'ON' : 'OFF'}`);
}

// ═══════════════════ VOICE ═══════════════════
function initVoice() {
  const voiceBtn = document.getElementById('voice-btn');
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    voiceBtn.style.opacity = '0.4'; voiceBtn.title = 'Not supported'; return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();
  recognition.continuous = false; recognition.interimResults = false;
  recognition.onresult = (e) => { document.getElementById('chat-input').value = e.results[0][0].transcript; voiceBtn.classList.remove('voice-recording'); sendMessage(); };
  recognition.onend = () => voiceBtn.classList.remove('voice-recording');
  recognition.onerror = () => voiceBtn.classList.remove('voice-recording');
  voiceBtn.addEventListener('click', () => {
    if (voiceBtn.classList.contains('voice-recording')) { recognition.stop(); }
    else { recognition.lang = currentLang === 'hi' ? 'hi-IN' : currentLang === 'bn' ? 'bn-IN' : 'en-IN'; recognition.start(); voiceBtn.classList.add('voice-recording'); }
  });
}

// ═══════════════════ TTS ═══════════════════
function initTTS() {
  document.getElementById('tts-btn').addEventListener('click', () => {
    if (!('speechSynthesis' in window)) return;
    const msgs = document.querySelectorAll('#chat-messages .rounded-2xl.bg-white');
    if (msgs.length > 0) {
      const text = msgs[msgs.length - 1].textContent.trim();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = currentLang === 'hi' ? 'hi-IN' : currentLang === 'bn' ? 'bn-IN' : 'en-IN';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
  });
}

// ═══════════════════ HERO JOURNEY ═══════════════════
function initHeroJourney() { updateHeroJourney(); }

function updateHeroJourney() {
  const journey = getJourneyStatus();
  const container = document.getElementById('hero-journey');
  if (!container) return;
  container.innerHTML = '';
  journey.steps.slice(0, 5).forEach(step => {
    const done = step.status === 'complete';
    const current = step.status === 'in_progress';
    const icon = done ? 'check_circle' : current ? 'radio_button_checked' : 'radio_button_unchecked';
    const color = done ? 'text-civic-emerald' : current ? 'text-civic-accent' : 'text-slate-300';
    const el = document.createElement('div');
    el.className = 'flex items-center gap-2';
    el.innerHTML = `<span class="material-symbols-outlined ${color} text-lg" style="font-variation-settings:'FILL' ${done ? 1 : 0}">${icon}</span><span class="text-sm ${done ? 'text-civic-emerald font-medium' : current ? 'text-civic-blue font-semibold' : 'text-civic-muted'}">${step.label}</span>`;
    container.appendChild(el);
  });
  document.getElementById('hero-journey-bar').style.width = `${journey.progress}%`;
  document.getElementById('hero-journey-pct').textContent = `${journey.progress}%`;
}

function updateHeroStats() {
  const ctx = getUserContext();
  const sq = document.getElementById('stat-queries'); if (sq) sq.textContent = ctx.queriesCount;
  const sv = document.getElementById('stat-verified'); if (sv) sv.textContent = ctx.verifiedCount;
  const si = document.getElementById('stat-impact'); if (si) si.textContent = ctx.impactScore;
  const level = Math.min(10, Math.floor(ctx.impactScore / 100) + 1);
  const sl = document.getElementById('stat-level'); if (sl) sl.textContent = `Lv ${level}`;
}

// ═══════════════════ MINI JOURNEY (Verify sidebar) ═══════════════════
function renderMiniJourney() {
  const journey = getJourneyStatus();
  const container = document.getElementById('mini-journey');
  if (!container) return;
  container.innerHTML = '';
  journey.steps.forEach(step => {
    const done = step.status === 'complete';
    const current = step.status === 'in_progress';
    const icon = done ? 'check_circle' : current ? 'radio_button_checked' : 'circle';
    const color = done ? 'text-civic-emerald' : current ? 'text-civic-accent' : 'text-slate-300';
    const el = document.createElement('div');
    el.className = 'flex items-center gap-2 text-sm';
    el.innerHTML = `<span class="material-symbols-outlined ${color} text-[16px]" style="font-variation-settings:'FILL' ${done ? 1 : 0}">${icon}</span><span class="${current ? 'font-semibold text-civic-blue' : 'text-civic-muted'}">${step.label}</span>`;
    container.appendChild(el);
  });
}

// Mini journey is rendered via updateProfilePage() → renderMiniJourney()

// ═══════════════════ PROFILE ═══════════════════
function updateProfilePage() {
  const ctx = getUserContext();
  const pn = document.getElementById('profile-name'); if (pn) pn.textContent = ctx.fullName || 'Citizen';
  const pl = document.getElementById('profile-location'); if (pl) pl.textContent = ctx.state ? `${ctx.district || ''}, ${getStateName(ctx.state)}` : 'India';
  const pq = document.getElementById('p-queries'); if (pq) pq.textContent = ctx.queriesCount;
  const pv = document.getElementById('p-verified'); if (pv) pv.textContent = ctx.verifiedCount;
  const pi = document.getElementById('p-impact'); if (pi) pi.textContent = ctx.impactScore;
  const pqz = document.getElementById('p-quiz'); if (pqz) pqz.textContent = ctx.quizScore;
  // Registration badge
  const rb = document.getElementById('profile-reg-badge');
  if (rb) {
    if (ctx.registrationStatus === 'verified') { rb.textContent = 'Registered ✅'; rb.className = 'text-caption px-2 py-0.5 bg-emerald-100 text-civic-emerald rounded-full'; }
  }
  // First time badge
  const vb = document.getElementById('profile-voter-badge');
  if (vb && ctx.firstTimeVoter) { vb.classList.remove('hidden'); }
  // Avatar
  const av = document.getElementById('profile-avatar');
  if (av && ctx.fullName) { av.innerHTML = `<span class="text-2xl font-bold">${ctx.fullName.charAt(0).toUpperCase()}</span>`; }
  const ua = document.getElementById('user-avatar');
  if (ua && ctx.fullName) { ua.innerHTML = `<span class="text-xs font-bold">${ctx.fullName.charAt(0).toUpperCase()}</span>`; }
  // Activity log
  const al = document.getElementById('activity-log');
  if (al && ctx.activities.length > 0) {
    al.innerHTML = '';
    const icons = { chat: 'chat_bubble', verify: 'fact_check', quiz: 'quiz', plan: 'assignment', settings: 'settings', registration: 'how_to_reg', booth: 'location_on', journey: 'route' };
    ctx.activities.slice(0, 8).forEach(a => {
      const el = document.createElement('div');
      el.className = 'flex items-center gap-3 p-3 bg-civic-surface rounded-xl';
      el.innerHTML = `<span class="material-symbols-outlined text-civic-accent text-sm">${icons[a.type] || 'info'}</span><div class="flex-1"><p class="text-sm text-civic-blue font-medium">${a.detail}</p><p class="text-[10px] text-civic-muted">${a.time}</p></div>`;
      al.appendChild(el);
    });
  }
  renderMiniJourney();
}

// ═══════════════════ SCROLL ANIMATIONS ═══════════════════
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('animate-fadeIn'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in-item').forEach(el => observer.observe(el));
}

// ═══════════════════ UTILITIES ═══════════════════

/**
 * Escapes HTML entities in a string to prevent XSS.
 * @param {string} text - Raw text to escape.
 * @returns {string} HTML-safe string.
 */
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

/**
 * Converts basic markdown (bold, newlines, bullets) to HTML.
 * @param {string} text - Markdown-formatted text.
 * @returns {string} HTML string.
 */
function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/•/g, '&bull;');
}
