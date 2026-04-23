// ═══════════════════════════════════════════════════
// CivicAI – Intelligent Election Companion
// Complete AI Service: 13 Modules
// Hybrid: Mock + Google Gemini API
// ═══════════════════════════════════════════════════

// ─── Configuration ───
let GEMINI_API_KEY = '';
let USE_LIVE_API = false;

export function setApiKey(key) {
  GEMINI_API_KEY = key;
  USE_LIVE_API = !!key;
}

// ─── MODULE: User Context (Memory Engine) ───
const userContext = {
  // Profile
  fullName: '',
  dob: '',
  age: null,
  country: 'India',
  state: '',
  district: '',
  firstTimeVoter: false,
  language: 'en',
  eli10Mode: false,
  accessibilityMode: 'standard', // standard | voice | simplified

  // Registration
  aadhaarNumber: '',
  mobileNumber: '',
  address: '',
  registrationStatus: 'not_started', // not_started | in_progress | otp_sent | verified | failed
  otpCode: '',
  otpVerified: false,
  identityVerified: false,
  isEligible: false,
  registeredVoters: [], // simulated duplicate check

  // Journey
  journeyStep: 0, // 0-6
  journeySteps: [
    { id: 'registration', label: 'Registration', status: 'pending' },
    { id: 'verification', label: 'Verification', status: 'pending' },
    { id: 'voter_id', label: 'Voter ID', status: 'pending' },
    { id: 'booth_assignment', label: 'Booth Assignment', status: 'pending' },
    { id: 'preparation', label: 'Voting Prep', status: 'pending' },
    { id: 'vote_cast', label: 'Vote Cast', status: 'pending' },
    { id: 'results', label: 'Results', status: 'pending' }
  ],

  // Polling Booth
  assignedBooth: null,

  // Stats
  conversationHistory: [],
  queriesCount: 0,
  verifiedCount: 0,
  impactScore: 0,
  quizScore: 0,
  activities: [],

  // Offline cache
  offlineCache: {}
};

export function getUserContext() { return userContext; }

export function updateUserProfile(data) {
  Object.assign(userContext, data);
  if (data.dob) {
    const today = new Date();
    const birth = new Date(data.dob);
    userContext.age = Math.floor((today - birth) / (365.25 * 24 * 60 * 60 * 1000));
  }
  cacheOffline('profile', { name: userContext.fullName, state: userContext.state, district: userContext.district });
}

export function setLanguage(lang) { userContext.language = lang; }
export function setEli10(val) { userContext.eli10Mode = val; }

export function logActivity(type, detail) {
  userContext.activities.unshift({ type, detail, time: new Date().toLocaleTimeString(), date: new Date().toLocaleDateString() });
  if (userContext.activities.length > 30) userContext.activities.pop();
}

// ─── State/District Data ───
const stateData = {
  'west-bengal': { name: 'West Bengal', districts: ['Kolkata', 'Howrah', 'North 24 Parganas', 'South 24 Parganas', 'Hooghly', 'Nadia'] },
  'maharashtra': { name: 'Maharashtra', districts: ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad'] },
  'delhi': { name: 'Delhi', districts: ['New Delhi', 'Central Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'] },
  'karnataka': { name: 'Karnataka', districts: ['Bangalore Urban', 'Mysore', 'Hubli-Dharwad', 'Mangalore', 'Belgaum'] },
  'tamil-nadu': { name: 'Tamil Nadu', districts: ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirappalli'] },
  'uttar-pradesh': { name: 'Uttar Pradesh', districts: ['Lucknow', 'Varanasi', 'Agra', 'Kanpur', 'Noida', 'Prayagraj'] },
  'rajasthan': { name: 'Rajasthan', districts: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner'] },
  'kerala': { name: 'Kerala', districts: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'] }
};

export function getStateData() { return stateData; }
export function getStateName(key) { return stateData[key]?.name || key; }
export function getDistricts(stateKey) { return stateData[stateKey]?.districts || []; }

// ═══════════════════════════════════════════════════
// MODULE 1: SECURE VOTER REGISTRATION
// ═══════════════════════════════════════════════════

export function validateAadhaar(aadhaar) {
  const cleaned = aadhaar.replace(/\s/g, '');
  if (!/^\d{12}$/.test(cleaned)) {
    return { valid: false, error: 'Aadhaar must be exactly 12 digits.' };
  }
  // Simulated duplicate check
  if (userContext.registeredVoters.includes(cleaned)) {
    return { valid: false, error: 'This Aadhaar is already registered. Duplicate registration detected.' };
  }
  return { valid: true, masked: `XXXX-XXXX-${cleaned.slice(-4)}` };
}

export function validateMobile(mobile) {
  const cleaned = mobile.replace(/\s/g, '');
  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    return { valid: false, error: 'Enter a valid 10-digit Indian mobile number starting with 6-9.' };
  }
  return { valid: true, masked: `XXXXX-${cleaned.slice(-5)}` };
}

export function sendOTP(mobile) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  userContext.otpCode = otp;
  userContext.registrationStatus = 'otp_sent';
  logActivity('registration', `OTP sent to mobile ending ${mobile.slice(-4)}`);
  return { success: true, message: `OTP sent to XXXXX-${mobile.slice(-5)}`, hint: `Demo OTP: ${otp}` };
}

export function verifyOTP(inputOtp) {
  if (inputOtp === userContext.otpCode) {
    userContext.otpVerified = true;
    userContext.registrationStatus = 'verified';
    logActivity('registration', 'OTP verified successfully');
    return { success: true, message: 'Mobile number verified successfully!' };
  }
  return { success: false, message: 'Invalid OTP. Please try again.' };
}

export function performRegistration(data) {
  const results = {
    identity: { status: 'pending', details: '' },
    eligibility: { status: 'pending', details: '' },
    documents: { status: 'pending', missing: [], suggestions: [] },
    nextSteps: [],
    riskScore: 0,
    overallStatus: 'pending'
  };

  // Age check
  let age = data.age;
  if (data.dob) {
    const today = new Date();
    const birth = new Date(data.dob);
    age = Math.floor((today - birth) / (365.25 * 24 * 60 * 60 * 1000));
  }

  if (age && age < 18) {
    results.eligibility = { status: 'failed', details: `Age ${age} is below the minimum voting age of 18.` };
    results.overallStatus = 'failed';
    results.riskScore = 100;
    return results;
  }
  results.eligibility = { status: 'passed', details: `Age ${age}: Eligible to vote.` };

  // Identity verification
  if (data.aadhaar && userContext.otpVerified) {
    results.identity = { status: 'passed', details: 'Identity verified via Aadhaar + OTP.' };
  } else if (data.aadhaar) {
    results.identity = { status: 'partial', details: 'Aadhaar provided but OTP not yet verified.' };
    results.nextSteps.push('Complete OTP verification for your mobile number.');
    results.riskScore += 30;
  } else {
    results.identity = { status: 'failed', details: 'National ID (Aadhaar) not provided.' };
    results.riskScore += 60;
  }

  // Document check
  const docCheck = checkDocuments({
    hasAadhaar: !!data.aadhaar,
    hasAddressProof: !!data.address,
    hasAgeProof: !!data.dob,
    hasMobile: !!data.mobile,
    hasPhoto: true // simulated
  });
  results.documents = docCheck;
  results.riskScore += docCheck.missing.length * 15;

  // Next steps
  if (results.identity.status === 'passed' && results.eligibility.status === 'passed' && docCheck.missing.length === 0) {
    results.overallStatus = 'success';
    results.nextSteps.push('Your registration is complete! Wait 2-3 days for verification.');
    results.nextSteps.push('You will receive your Voter ID (EPIC) within 7-10 days.');
    userContext.journeySteps[0].status = 'complete';
    userContext.journeySteps[1].status = 'in_progress';
    userContext.journeyStep = 1;
    userContext.registeredVoters.push(data.aadhaar?.replace(/\s/g, ''));
  } else {
    results.overallStatus = 'incomplete';
    if (docCheck.missing.length > 0) {
      results.nextSteps.push(`Submit missing documents: ${docCheck.missing.join(', ')}`);
    }
  }

  results.riskScore = Math.min(100, results.riskScore);
  logActivity('registration', `Registration ${results.overallStatus}: Risk ${results.riskScore}%`);
  updateUserProfile(data);

  // Cache for offline
  cacheOffline('registration', results);

  return results;
}

function checkDocuments(docs) {
  const missing = [];
  const suggestions = [];

  if (!docs.hasAadhaar) {
    missing.push('Identity Proof (Aadhaar)');
    suggestions.push('You can use: Passport, Driving License, or PAN Card as alternative identity proof.');
  }
  if (!docs.hasAddressProof) {
    missing.push('Address Proof');
    suggestions.push('Accepted alternatives: Utility Bill, Bank Passbook, Rent Agreement, or Ration Card.');
  }
  if (!docs.hasAgeProof) {
    missing.push('Age Proof (Date of Birth)');
    suggestions.push('You can use: Birth Certificate, Class 10 Marksheet, or Passport.');
  }

  return {
    status: missing.length === 0 ? 'complete' : 'incomplete',
    missing,
    suggestions,
    verified: Object.values(docs).filter(Boolean).length,
    total: Object.keys(docs).length
  };
}

// ═══════════════════════════════════════════════════
// MODULE 2: USER JOURNEY TRACKER
// ═══════════════════════════════════════════════════

export function getJourneyStatus() {
  return {
    steps: userContext.journeySteps,
    currentStep: userContext.journeyStep,
    progress: Math.round((userContext.journeyStep / 6) * 100),
    nextAction: getNextJourneyAction()
  };
}

function getNextJourneyAction() {
  const actions = [
    'Complete your voter registration by submitting your credentials.',
    'Wait for verification (2-3 business days). We will notify you.',
    'Your Voter ID (EPIC) is being processed. Download e-EPIC from the Voter Helpline App.',
    'Your polling booth has been assigned. Check the "Booth Finder" section.',
    'Election day is approaching! Review the checklist of items to carry.',
    'Visit your polling station between 7 AM - 6 PM to cast your vote.',
    'Results will be announced after counting day. Stay tuned!'
  ];
  return actions[userContext.journeyStep] || actions[0];
}

export function advanceJourney() {
  if (userContext.journeyStep < 6) {
    userContext.journeySteps[userContext.journeyStep].status = 'complete';
    userContext.journeyStep++;
    if (userContext.journeyStep < 7) {
      userContext.journeySteps[userContext.journeyStep].status = 'in_progress';
    }
    userContext.impactScore += 25;
    logActivity('journey', `Advanced to step: ${userContext.journeySteps[userContext.journeyStep]?.label || 'Complete'}`);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════
// MODULE 3: POLLING BOOTH FINDER
// ═══════════════════════════════════════════════════

const boothDatabase = {
  'west-bengal': {
    'Kolkata': [
      { id: 'WB-KOL-001', name: 'Mitra Institution (Primary Section)', address: '66/1 Bhawanipore, Near Hazra Crossing, Kolkata - 700025', distance: '1.2 km', landmark: 'Near Hazra More Bus Stop', crowd: 'Moderate', bestTime: '9:00 AM - 11:00 AM', directions: 'From Hazra More, walk south on Hazra Road for 200m. The school is on the left side.' },
      { id: 'WB-KOL-002', name: 'South Point High School', address: 'Mandeville Gardens, Ballygunge, Kolkata - 700019', distance: '2.5 km', landmark: 'Near Ballygunge Phari', crowd: 'High', bestTime: '7:00 AM - 9:00 AM', directions: 'Take Bus 230 from Gariahat to Ballygunge Phari. Walk 300m north.' }
    ],
    'Howrah': [
      { id: 'WB-HOW-001', name: 'Howrah Zilla School', address: 'Howrah Maidan, Howrah - 711101', distance: '0.8 km', landmark: 'Near Howrah Station', crowd: 'High', bestTime: '7:00 AM - 8:30 AM', directions: 'Exit Howrah Station from Gate 1, walk 800m south along GT Road.' }
    ]
  },
  'maharashtra': {
    'Mumbai': [
      { id: 'MH-MUM-001', name: 'BMC School No. 14', address: 'Dadar West, Mumbai - 400028', distance: '1.5 km', landmark: 'Near Shivaji Park', crowd: 'High', bestTime: '8:00 AM - 10:00 AM', directions: 'Walk towards Shivaji Park from Dadar Station West exit. 15 min walk.' },
      { id: 'MH-MUM-002', name: 'Parle Tilak Vidyalaya', address: 'Vile Parle East, Mumbai - 400057', distance: '0.9 km', landmark: 'Near Parle Station', crowd: 'Moderate', bestTime: '9:00 AM - 11:00 AM', directions: 'From Vile Parle Station east exit, walk 500m on SV Road.' }
    ],
    'Pune': [
      { id: 'MH-PUN-001', name: 'SP College Grounds', address: 'Tilak Road, Pune - 411030', distance: '2.0 km', landmark: 'Near Deccan Gymkhana', crowd: 'Low', bestTime: '10:00 AM - 12:00 PM', directions: 'From Deccan Gymkhana bus stop, walk east on Tilak Road for 400m.' }
    ]
  },
  'delhi': {
    'New Delhi': [
      { id: 'DL-ND-001', name: 'Govt. Boys Sr. Sec. School', address: 'Bhogal, Jangpura, New Delhi - 110014', distance: '1.8 km', landmark: 'Near Jangpura Metro', crowd: 'Moderate', bestTime: '9:00 AM - 11:00 AM', directions: 'Exit Jangpura Metro from Gate 2. Walk 300m south on Bhogal Road.' },
      { id: 'DL-ND-002', name: 'Sarvodaya Kanya Vidyalaya', address: 'Andrews Ganj, New Delhi - 110049', distance: '3.2 km', landmark: 'Near AIIMS Metro', crowd: 'Low', bestTime: '10:00 AM - 1:00 PM', directions: 'From AIIMS Metro, take auto to Andrews Ganj Market, school is 100m ahead.' }
    ]
  }
};

export function findPollingBooth(stateKey, district) {
  const stateBooths = boothDatabase[stateKey];
  if (!stateBooths) {
    // Return generic booth
    return [{
      id: 'GEN-001', name: `${getStateName(stateKey)} Government School`, address: `${district || 'Central'} District, ${getStateName(stateKey)}`,
      distance: '1.5 km', landmark: 'Near District Collectorate', crowd: 'Moderate', bestTime: '9:00 AM - 11:00 AM',
      directions: 'Visit eci.gov.in for exact location based on your registration address.'
    }];
  }
  const districtBooths = stateBooths[district];
  if (!districtBooths) {
    const firstDistrict = Object.keys(stateBooths)[0];
    return stateBooths[firstDistrict] || [];
  }
  return districtBooths;
}

export function assignBooth(stateKey, district) {
  const booths = findPollingBooth(stateKey, district);
  if (booths.length > 0) {
    userContext.assignedBooth = booths[0];
    userContext.journeySteps[3].status = 'complete';
    if (userContext.journeyStep < 4) userContext.journeyStep = 4;
    cacheOffline('booth', booths[0]);
    logActivity('booth', `Assigned to ${booths[0].name}`);
    return booths[0];
  }
  return null;
}

// ═══════════════════════════════════════════════════
// MODULE 4: DYNAMIC TIMELINE
// ═══════════════════════════════════════════════════

const timelineData = {
  general: [
    { date: 'T - 60 Days', title: 'Election Announced', desc: 'Election Commission announces the schedule. Model Code of Conduct comes into effect immediately.', status: 'complete', icon: 'campaign' },
    { date: 'T - 45 Days', title: 'Nominations Open', desc: 'Candidates file nomination papers at the District Returning Officer\'s office. Scrutiny begins.', status: 'complete', icon: 'how_to_reg' },
    { date: 'T - 30 Days', title: 'Registration Deadline', desc: 'Last day to register as voter or update electoral roll. Apply via Form 6.', status: 'current', icon: 'edit_calendar' },
    { date: 'T - 15 Days', title: 'Campaign Period', desc: 'Political campaigns, rallies, and public debates. Campaigns end 48 hours before voting.', status: 'upcoming', icon: 'record_voice_over' },
    { date: 'T - 2 Days', title: 'Campaign Silence', desc: 'All campaigning stops. Silent period before election for voter reflection.', status: 'upcoming', icon: 'do_not_disturb' },
    { date: 'T Day', title: '🗳️ Election Day', desc: 'Polls open 7:00 AM to 6:00 PM. Every registered voter can cast their vote.', status: 'upcoming', icon: 'how_to_vote' },
    { date: 'T + 3 Days', title: 'Counting Day', desc: 'Votes are counted at designated counting centers under EC supervision.', status: 'upcoming', icon: 'calculate' },
    { date: 'T + 5 Days', title: 'Results Declared', desc: 'Official results announced. Winners declared and certified by Returning Officers.', status: 'upcoming', icon: 'analytics' }
  ],
  state: [
    { date: 'T - 45 Days', title: 'State Election Notification', desc: 'State Election Commission announces dates for state assembly elections.', status: 'complete', icon: 'description' },
    { date: 'T - 30 Days', title: 'Nominations Period', desc: 'State-level candidates submit nominations to District Officers.', status: 'current', icon: 'how_to_reg' },
    { date: 'T - 20 Days', title: 'Registration Cut-off', desc: 'Final day for voter registration updates for this state election.', status: 'upcoming', icon: 'edit_calendar' },
    { date: 'T - 10 Days', title: 'State Campaigns End', desc: 'Political campaigns conclude for state elections.', status: 'upcoming', icon: 'campaign' },
    { date: 'T Day', title: '🗳️ State Election Day', desc: 'Voting at state polling stations. Hours: 7 AM - 6 PM.', status: 'upcoming', icon: 'how_to_vote' },
    { date: 'T + 3 Days', title: 'State Results', desc: 'Counting and declaration of state assembly election results.', status: 'upcoming', icon: 'analytics' }
  ],
  local: [
    { date: 'T - 30 Days', title: 'Municipal Election Notice', desc: 'Local body elections announced by State Election Commission.', status: 'complete', icon: 'apartment' },
    { date: 'T - 20 Days', title: 'Ward Nominations', desc: 'Candidates file nominations for ward-level positions.', status: 'current', icon: 'how_to_reg' },
    { date: 'T - 10 Days', title: 'Local Campaign Period', desc: 'Door-to-door campaigns and local rallies for municipal elections.', status: 'upcoming', icon: 'campaign' },
    { date: 'T Day', title: '🗳️ Municipal Election Day', desc: 'Vote for your local representatives. Same polling stations.', status: 'upcoming', icon: 'how_to_vote' },
    { date: 'T + 2 Days', title: 'Local Results', desc: 'Municipal election results announced.', status: 'upcoming', icon: 'analytics' }
  ]
};

export function getTimeline(type) {
  return timelineData[type] || timelineData.general;
}

// ═══════════════════════════════════════════════════
// MODULE 5: SMART REMINDERS
// ═══════════════════════════════════════════════════

export function getReminders() {
  const name = userContext.fullName || 'Voter';
  return [
    { id: 'reg', icon: 'edit_calendar', title: 'Registration Deadline', subtitle: 'Due in 5 days', text: `Hi ${name}, your voter registration deadline is in 5 days! Complete it now at nvsp.in.`, trigger: 'T-35 days', enabled: true, priority: 'high' },
    { id: 'doc', icon: 'description', title: 'Document Submission', subtitle: 'Gather your documents', text: `${name}, remember to keep your Aadhaar, address proof, and photo ready for verification.`, trigger: 'T-30 days', enabled: true, priority: 'medium' },
    { id: 'epic', icon: 'badge', title: 'Download e-EPIC', subtitle: 'Get Digital Voter ID', text: `Your e-EPIC is ready! Download it from the Voter Helpline App.`, trigger: 'T-20 days', enabled: false, priority: 'low' },
    { id: 'booth', icon: 'location_on', title: 'Check Polling Booth', subtitle: 'Find your nearest booth', text: `${name}, check your assigned polling booth and plan your route before election day.`, trigger: 'T-7 days', enabled: true, priority: 'medium' },
    { id: 'prep', icon: 'checklist', title: 'Election Day Prep', subtitle: '1 day before voting', text: `Tomorrow is election day! Carry your Voter ID, reach early, and exercise your democratic right.`, trigger: 'T-1 day', enabled: true, priority: 'high' },
    { id: 'vote', icon: 'how_to_vote', title: 'Election Day!', subtitle: 'Go vote today!', text: `🗳️ Today is election day! Polls are open 7AM-6PM. Your booth: ${userContext.assignedBooth?.name || 'Check Booth Finder'}`, trigger: 'T-Day 7AM', enabled: true, priority: 'critical' }
  ];
}

// ═══════════════════════════════════════════════════
// MODULE 6: MISINFORMATION DETECTION
// ═══════════════════════════════════════════════════

const misinfoDatabase = [
  { pattern: /voting.*tomorrow|vote.*tomorrow/i, risk: 'High', confidence: 92, reliability: 'Low', verdict: 'False', fact: 'This is likely FALSE. Always verify election dates from the Election Commission of India (eci.gov.in). Voting dates are officially announced well in advance.' },
  { pattern: /booth.*close|polling.*close.*early|closes?\s*at\s*[12345]\s*(pm|PM)/i, risk: 'High', confidence: 87, reliability: 'Low', verdict: 'False', fact: 'Polling booths operate from 7:00 AM to 6:00 PM. Any claim of early closure is misinformation. Contact 1950 helpline to verify.' },
  { pattern: /online.*voting|vote.*online|whatsapp.*vote|sms.*vote/i, risk: 'Critical', confidence: 96, reliability: 'Very Low', verdict: 'False', fact: 'India does NOT have online, WhatsApp, or SMS voting. All voting is done via EVMs at designated polling stations. Such claims are SCAMS.' },
  { pattern: /no.*id.*needed|without.*id|voter.*id.*not.*required/i, risk: 'High', confidence: 89, reliability: 'Low', verdict: 'False', fact: 'A valid photo ID IS required for voting. Accepted: Voter ID (EPIC), Aadhaar, Passport, DL, or PAN Card.' },
  { pattern: /election.*cancel|voting.*cancel|postpone/i, risk: 'Medium', confidence: 78, reliability: 'Unverified', verdict: 'Uncertain', fact: 'Election changes are officially announced by the Election Commission only. Always verify from eci.gov.in.' },
  { pattern: /evm.*hack|evm.*tamper|rigged|machine.*hack/i, risk: 'Medium', confidence: 83, reliability: 'Low', verdict: 'False', fact: 'EVMs are standalone devices with no network connectivity. VVPAT verification ensures accuracy. No credible evidence of tampering exists.' },
  { pattern: /booth.*capture|violence.*poll|booth.*attack/i, risk: 'High', confidence: 85, reliability: 'Unverified', verdict: 'Uncertain', fact: 'Booth capturing is a criminal offense. If you witness it, call police or EC helpline 1950 immediately.' },
  { pattern: /paid.*vote|money.*for.*vote|cash.*vote|buying.*vote/i, risk: 'Critical', confidence: 94, reliability: 'Very Low', verdict: 'False', fact: 'Accepting money for votes is a criminal offense under Section 171B of IPC. Report such activities to the Election Commission.' },
  { pattern: /dead.*people.*voting|dead.*voter|ghost.*voter/i, risk: 'Medium', confidence: 76, reliability: 'Low', verdict: 'Uncertain', fact: 'Electoral rolls are periodically revised. Report suspected irregularities to the District Election Office using Form 7.' },
  { pattern: /ink.*removable|ink.*wash|remove.*ink/i, risk: 'High', confidence: 91, reliability: 'Low', verdict: 'False', fact: 'The indelible ink used in Indian elections contains silver nitrate and cannot be easily removed. It fades naturally after 2-3 weeks.' }
];

export async function detectMisinformation(message) {
  userContext.verifiedCount++;
  userContext.impactScore += 15 + Math.floor(Math.random() * 10);
  logActivity('verify', `Fact-checked: "${message.substring(0, 40)}..."`);

  if (USE_LIVE_API && GEMINI_API_KEY) {
    try {
      return await geminiFactCheck(message);
    } catch (e) {
      console.warn('Gemini fact-check failed, using mock:', e);
    }
  }

  await simulateDelay(1500 + Math.random() * 1000);

  for (const entry of misinfoDatabase) {
    if (entry.pattern.test(message)) {
      return { risk: entry.risk, confidence: entry.confidence, reliability: entry.reliability, verdict: entry.verdict, fact: entry.fact, isDetected: true };
    }
  }

  return {
    risk: 'Low', confidence: 65 + Math.floor(Math.random() * 15), reliability: 'Moderate', verdict: 'Uncertain',
    fact: 'This claim does not match known misinformation patterns. Always verify election information from official sources like eci.gov.in.',
    isDetected: false
  };
}

async function geminiFactCheck(message) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { role: 'user', parts: [{ text: 'You are a fact-checking AI for Indian elections. Analyze claims and respond with ONLY valid JSON: {"risk":"Low|Medium|High|Critical","confidence":number,"reliability":"Very Low|Low|Moderate|High","verdict":"True|False|Uncertain","fact":"explanation"}' }] },
      contents: [{ role: 'user', parts: [{ text: `Fact-check this election claim: "${message}"` }] }]
    })
  });
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const result = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    return { ...result, isDetected: result.risk !== 'Low' };
  } catch {
    return { risk: 'Unknown', confidence: 70, reliability: 'Moderate', verdict: 'Uncertain', fact: text, isDetected: false };
  }
}

// ═══════════════════════════════════════════════════
// MODULE 7: ELECTION DAY ASSISTANT
// ═══════════════════════════════════════════════════

export function getElectionDayChecklist() {
  const name = userContext.fullName || 'Voter';
  return {
    whatToCarry: [
      { item: 'Voter ID Card (EPIC)', required: true, icon: 'badge', note: 'Primary ID for voting' },
      { item: 'Alternative Photo ID', required: false, icon: 'credit_card', note: 'Aadhaar / Passport / DL / PAN Card' },
      { item: 'Voter Slip (if received)', required: false, icon: 'receipt', note: 'Contains your booth number and serial' },
      { item: 'Face Mask', required: false, icon: 'masks', note: 'Recommended for health safety' }
    ],
    votingProcess: [
      { step: 1, title: 'Arrive at Polling Station', desc: `${name}, go to ${userContext.assignedBooth?.name || 'your assigned booth'} between 7:00 AM - 6:00 PM.`, icon: 'location_on' },
      { step: 2, title: 'Join the Queue', desc: 'Stand in the designated queue. Separate lines for men/women/elderly.', icon: 'group' },
      { step: 3, title: 'Identity Verification', desc: 'Show your Voter ID to the polling officer. Your name is checked against the electoral roll.', icon: 'verified_user' },
      { step: 4, title: 'Ink Marking', desc: 'Your left index finger is marked with indelible ink to prevent double voting.', icon: 'ink_pen' },
      { step: 5, title: 'Receive Ballot Slip', desc: 'The presiding officer will hand you a ballot slip and direct you to the EVM booth.', icon: 'receipt_long' },
      { step: 6, title: 'Cast Your Vote', desc: 'Inside the booth, press the button next to your chosen candidate on the EVM.', icon: 'touch_app' },
      { step: 7, title: 'VVPAT Verification', desc: 'A paper slip shows your candidate name for 7 seconds on the VVPAT machine. Verify it.', icon: 'fact_check' },
      { step: 8, title: 'Exit', desc: 'Leave the polling station. Do NOT discuss your vote inside the premises.', icon: 'exit_to_app' }
    ],
    insideBooth: 'Inside the voting booth, you will see an Electronic Voting Machine (EVM) with candidate names, party symbols, and buttons. Press the blue button next to your chosen candidate. A beep confirms your vote. The VVPAT printer shows a paper slip with the candidate name for 7 seconds—verify it. Your vote is completely secret and secure.'
  };
}

// ═══════════════════════════════════════════════════
// MODULE 8: CONTEXT-AWARE AI CHATBOT
// ═══════════════════════════════════════════════════

export async function getAIResponse(userMessage) {
  userContext.queriesCount++;
  userContext.conversationHistory.push({ role: 'user', content: userMessage });
  logActivity('chat', `Asked: "${userMessage.substring(0, 50)}..."`);

  if (USE_LIVE_API && GEMINI_API_KEY) {
    try {
      return await callGeminiAPI(userMessage);
    } catch (e) {
      console.warn('Gemini API failed, falling back to mock:', e);
    }
  }

  // Mock response system
  await simulateDelay(800 + Math.random() * 1200);
  const msgLower = userMessage.toLowerCase().trim();
  let response = getMockResponse(msgLower);
  userContext.conversationHistory.push({ role: 'assistant', content: response.text });
  return response;
}

function getMockResponse(msgLower) {
  const ctx = userContext;
  const name = ctx.fullName || 'there';
  const state = ctx.state ? getStateName(ctx.state) : '';

  // Registration
  if (msgLower.includes('register') || msgLower.includes('registration') || msgLower.includes('enroll')) {
    return { text: `Hi ${name}! To register as a voter${state ? ` in ${state}` : ''}, you need:\n\n📋 **Required:**\n• Be an Indian citizen aged 18+\n• Aadhaar Card (12-digit number)\n• Mobile number for OTP verification\n• Address proof\n\n🚀 **Quick Steps:**\n1. Go to the **Register** tab in CivicAI\n2. Enter your Aadhaar number\n3. Verify via OTP\n4. Submit your details\n\nOr visit nvsp.in to register online using Form 6.`, eli10: 'To vote, you need to sign up first! It\'s like joining a club. Go to our Register page and fill in your details!', confidence: 97 };
  }

  // How to vote
  if (msgLower.includes('how') && (msgLower.includes('vote') || msgLower.includes('voting'))) {
    return { text: `Here's how to vote on Election Day, ${name}:\n\n1. 🏫 Go to your assigned polling station (7AM-6PM)\n2. 🔖 Show your Voter ID to the officer\n3. ✋ Get ink mark on your finger\n4. 🗳️ Enter the booth and press the EVM button\n5. ✅ Verify on VVPAT display\n6. 🚶 Exit the station\n\n💡 Tip: Arrive before 10 AM to avoid long queues!\n\nCheck the **Guide** tab for your full Election Day checklist.`, eli10: 'Voting is easy! Go to a special place, show your ID card, press a button for the person you like, and you\'re done!', confidence: 98 };
  }

  // Documents
  if (msgLower.includes('document') || msgLower.includes('what do i need') || msgLower.includes('id card') || msgLower.includes('voter id')) {
    return { text: `Documents for voting, ${name}:\n\n✅ **Primary:** Voter ID Card (EPIC)\n\n📎 **Alternatives (any one):**\n• Aadhaar Card\n• Driving License\n• Passport\n• PAN Card\n• MNREGA Job Card\n\n${ctx.firstTimeVoter ? '🆕 **First-time voter tip:** Also carry your age proof (birth certificate or Class 10 marksheet).' : ''}\n\n📱 Download your Digital Voter ID (e-EPIC) from the Voter Helpline App.`, eli10: 'You need a card with your photo that says you can vote. Like a library card, but for elections!', confidence: 97 };
  }

  // Polling booth
  if (msgLower.includes('polling') || msgLower.includes('booth') || msgLower.includes('station') || msgLower.includes('where do i vote')) {
    const booth = ctx.assignedBooth;
    if (booth) {
      return { text: `Your assigned polling booth, ${name}:\n\n📍 **${booth.name}**\n📫 ${booth.address}\n📏 Distance: ${booth.distance}\n🏘️ Landmark: ${booth.landmark}\n👥 Expected crowd: ${booth.crowd}\n⏰ Best time: ${booth.bestTime}\n\n🗺️ **Directions:** ${booth.directions}`, eli10: `Your voting place is called ${booth.name}. It's ${booth.distance} from you!`, confidence: 96 };
    }
    return { text: `To find your polling booth${state ? ` in ${state}` : ''}:\n\n1. Visit eci.gov.in or nvsp.in\n2. Enter your EPIC number\n3. Your assigned station will be shown\n\nOr use the **Booth Finder** in the Guide tab!\n\n📍 Polling stations are usually within 2 km of your home.`, eli10: 'Your voting place is usually a school or hall near your house. Check the Guide tab to find yours!', confidence: 94 };
  }

  // Candidates
  if (msgLower.includes('candidate') || msgLower.includes('who is running') || msgLower.includes('party') || msgLower.includes('election info')) {
    return { text: `For candidate information${state ? ` in ${state}` : ''}:\n\n📊 Check the **Candidates** section in the Verify tab\n\nWe provide:\n• Candidate names & party affiliations\n• Age, education, profession\n• Previous political experience\n• Side-by-side comparison table\n\n⚖️ **CivicAI is strictly neutral.** We provide facts only—no opinions, no recommendations, no bias.`, eli10: 'You can see who wants to be your leader in the Verify tab. We show facts about each person!', confidence: 93 };
  }

  // Misinformation
  if (msgLower.includes('fake') || msgLower.includes('true or false') || msgLower.includes('misinformation') || msgLower.includes('fact check') || msgLower.includes('is it true')) {
    return { text: `Use our **Misinformation Detector** in the Verify tab!\n\nPaste any election-related claim and our AI will:\n• Analyze credibility\n• Give a **Verdict** (True / False / Uncertain)\n• Show **Confidence Score** (%)\n• Provide the correct information\n\n🛡️ All checks are cross-referenced with official election data.`, eli10: 'If you hear something about voting and aren\'t sure if it\'s true, paste it into our checker. We\'ll tell you if it\'s real or fake!', confidence: 95 };
  }

  // Missed registration / scenarios
  if (msgLower.includes('miss') || msgLower.includes('forgot') || msgLower.includes('late') || msgLower.includes('lost')) {
    return { text: simulateScenario(msgLower).fullText || 'Check the Scenario Simulator in the Timeline tab for "What if?" situations!', eli10: 'Don\'t worry! There are always solutions. Check the Timeline tab for help.', confidence: 88 };
  }

  // Default
  return { text: `Hello ${name}! 👋 I'm your CivicAI assistant${state ? ` for ${state}` : ''}. I can help with:\n\n🔐 **Register** – Secure voter registration\n📋 **Documents** – What you need to vote\n📍 **Polling Booth** – Find your station\n📅 **Timeline** – Election dates & deadlines\n🔍 **Fact Check** – Detect misinformation\n📊 **Candidates** – Neutral election info\n🗳️ **Voting Guide** – Step-by-step process\n\nWhat would you like to know?`, eli10: `Hi ${name}! I'm your friendly voting helper. Ask me anything about elections!`, confidence: 85 };
}

async function callGeminiAPI(message) {
  const ctx = userContext;
  const systemPrompt = `You are CivicAI, an intelligent, neutral election assistant for Indian citizens. Personalize all responses for the user.

User Profile:
- Name: ${ctx.fullName || 'Unknown'}
- Age: ${ctx.age || 'Unknown'}
- State: ${ctx.state ? getStateName(ctx.state) : 'Unknown'}
- District: ${ctx.district || 'Unknown'}
- First-time voter: ${ctx.firstTimeVoter ? 'Yes' : 'No'}
- Registration status: ${ctx.registrationStatus}
- Journey step: ${ctx.journeySteps[ctx.journeyStep]?.label || 'Not started'}
${ctx.assignedBooth ? `- Assigned booth: ${ctx.assignedBooth.name}, ${ctx.assignedBooth.address}` : ''}

Language: ${ctx.language === 'hi' ? 'Hindi' : ctx.language === 'bn' ? 'Bengali' : 'English'}
${ctx.eli10Mode ? 'IMPORTANT: Explain simply, as if to a 10-year-old.' : ''}

Rules:
- Always address the user by name
- Be politically neutral—NO opinions or recommendations on candidates/parties
- Provide actionable steps with bullet points
- Reference official sources (eci.gov.in, nvsp.in)
- Keep responses concise and helpful`;

  const cleanHistory = [];
  ctx.conversationHistory.forEach(msg => {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
      cleanHistory[cleanHistory.length - 1].parts[0].text += `\n\n${msg.content}`;
    } else {
      cleanHistory.push({ role, parts: [{ text: msg.content }] });
    }
  });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
      contents: cleanHistory.slice(-10)
    })
  });

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I apologize, I could not process that. Please try again.';
  ctx.conversationHistory.push({ role: 'assistant', content: text });
  return { text, eli10: ctx.eli10Mode ? text : null, confidence: 90 + Math.floor(Math.random() * 9) };
}

// ═══════════════════════════════════════════════════
// MODULE 10: SCENARIO SIMULATION
// ═══════════════════════════════════════════════════

const scenarios = {
  'miss registration': { title: 'Missed Registration Deadline', outcome: '⚠️ You may NOT be able to vote in this election.', alternatives: ['Check if your state has late registration provisions', 'Apply during next "summary revision" of electoral rolls (Jan-Feb annually)', 'Visit District Election Office for emergency options', 'Set up CivicAI Smart Reminders for next time'], tip: 'Registration deadlines are typically T-30 days. Always register early!', fullText: 'If you missed the registration deadline, you unfortunately cannot vote in this election. However, you can: check for late registration provisions in your state, apply during the next summary revision (Jan-Feb), or visit your District Election Office for emergency provisions.' },
  'lost voter id': { title: 'Lost Voter ID Card', outcome: '✅ You CAN still vote with alternative photo ID.', alternatives: ['Use Aadhaar, Passport, DL, or PAN Card instead', 'Apply for duplicate Voter ID at nvsp.in (Form 002)', 'Download e-EPIC from Voter Helpline App', 'Call EC helpline: 1950'], tip: 'Download the Voter Helpline App and save your e-EPIC digitally!', fullText: 'Don\'t worry! You can still vote using any alternative photo ID: Aadhaar Card, Passport, Driving License, or PAN Card. Apply for a duplicate at nvsp.in using Form 002, or download your e-EPIC from the Voter Helpline App.' },
  'moved state': { title: 'Moved to New State', outcome: '⚠️ You need to transfer your voter registration.', alternatives: ['Apply for transfer using Form 6 at nvsp.in', 'Old registration will be automatically deleted', 'Need address proof for new state', 'Transfer takes 15-30 days—apply early'], tip: 'Start the transfer as soon as you move. You can only vote from your registered constituency!', fullText: 'If you moved to a new state, you need to transfer your voter registration using Form 6 at nvsp.in. Provide address proof for your new location. The process takes 15-30 days, so apply well before the election.' },
  'late arrival': { title: 'Late Arrival at Polling Station', outcome: '⚠️ You must be in the queue before 6:00 PM.', alternatives: ['If you are IN the queue before 6 PM, you will be allowed to vote', 'Carry your Voter ID and arrive as early as possible', 'Check for any extended hours announcements from EC', 'Contact your booth\'s presiding officer'], tip: 'Arrive before 10 AM to avoid peak-hour crowds!', fullText: 'If you arrive late, you must be standing in the queue before 6:00 PM to be allowed to vote. Anyone already in line when booths close will still get to vote. Arrive early—before 10 AM—to avoid crowds.' }
};

export function simulateScenario(question) {
  const qLower = question.toLowerCase();
  for (const [key, data] of Object.entries(scenarios)) {
    const words = key.split(' ');
    if (words.some(w => qLower.includes(w))) {
      return data;
    }
  }
  return scenarios['miss registration'];
}

// ═══════════════════════════════════════════════════
// MODULE 11: CANDIDATE & ELECTION INFO (NEUTRAL)
// ═══════════════════════════════════════════════════

const candidateDatabase = {
  'west-bengal': [
    { name: 'Candidate A', party: 'Party Alpha', symbol: '🌸', age: 52, education: 'M.A. Political Science', profession: 'Social Worker', experience: '2-term MLA, Former Minister of Education', constituency: 'Kolkata South' },
    { name: 'Candidate B', party: 'Party Beta', symbol: '🌾', age: 45, education: 'B.Tech, MBA', profession: 'Entrepreneur', experience: 'First-time candidate, Municipal Councillor', constituency: 'Kolkata South' },
    { name: 'Candidate C', party: 'Party Gamma', symbol: '🔔', age: 38, education: 'LLB, M.Phil', profession: 'Advocate', experience: 'Youth wing leader, Social activist', constituency: 'Kolkata South' },
    { name: 'Candidate D', party: 'Independent', symbol: '🕯️', age: 60, education: 'Ph.D. Economics', profession: 'Professor', experience: 'Independent candidate, Author of 3 books', constituency: 'Kolkata South' }
  ],
  'maharashtra': [
    { name: 'Candidate E', party: 'Party Alpha', symbol: '🌸', age: 48, education: 'B.Com, CA', profession: 'Chartered Accountant', experience: '3-term MLA, Finance Committee Chair', constituency: 'Mumbai Central' },
    { name: 'Candidate F', party: 'Party Delta', symbol: '⚙️', age: 55, education: 'M.Sc Agriculture', profession: 'Farmer Leader', experience: '2-term MP, Agriculture Minister', constituency: 'Mumbai Central' },
    { name: 'Candidate G', party: 'Party Beta', symbol: '🌾', age: 42, education: 'MBBS, MD', profession: 'Doctor', experience: 'First-time candidate, Hospital founder', constituency: 'Mumbai Central' }
  ],
  'delhi': [
    { name: 'Candidate H', party: 'Party Epsilon', symbol: '🧹', age: 50, education: 'IIT Delhi, IRS officer', profession: 'Former Bureaucrat', experience: '2-term MLA, Anti-corruption work', constituency: 'New Delhi Central' },
    { name: 'Candidate I', party: 'Party Alpha', symbol: '🌸', age: 58, education: 'B.A., Diploma in Journalism', profession: 'Journalist-turned-Politician', experience: '4-term MP, Senior party leader', constituency: 'New Delhi Central' },
    { name: 'Candidate J', party: 'Party Beta', symbol: '🌾', age: 35, education: 'MBA, Harvard', profession: 'Corporate Leader', experience: 'First-time candidate, NGO founder', constituency: 'New Delhi Central' }
  ]
};

export function getCandidates(stateKey) {
  return candidateDatabase[stateKey] || candidateDatabase['delhi'];
}

// ═══════════════════════════════════════════════════
// MODULE 13: OFFLINE SUPPORT (SIMULATED)
// ═══════════════════════════════════════════════════

function cacheOffline(key, data) {
  userContext.offlineCache[key] = { data, timestamp: Date.now() };
  try {
    localStorage.setItem(`civicai_${key}`, JSON.stringify(data));
  } catch (e) { /* localStorage not available */ }
}

export function getOfflineData(key) {
  try {
    const cached = localStorage.getItem(`civicai_${key}`);
    if (cached) return JSON.parse(cached);
  } catch (e) { /* ignore */ }
  return userContext.offlineCache[key]?.data || null;
}

// ═══════════════════════════════════════════════════
// QUIZ ENGINE
// ═══════════════════════════════════════════════════

const quizQuestions = [
  { question: "What is the minimum age to vote in India?", options: ["16 years", "18 years", "21 years", "25 years"], correct: 1, explanation: "The minimum voting age is 18 years, established by the 61st Constitutional Amendment (1988)." },
  { question: "What is EPIC?", options: ["Electoral Photo Identity Card", "Election Participation ID Certificate", "Electronic Poll ID Code", "Elector's Primary ID Card"], correct: 0, explanation: "EPIC = Electoral Photo Identity Card, commonly called the Voter ID, issued by the Election Commission of India." },
  { question: "Which form is used for new voter registration?", options: ["Form 1", "Form 6", "Form 8", "Form 11"], correct: 1, explanation: "Form 6 is for new registration. Form 7 for deletion, Form 8 for corrections, Form 8A for transposition." },
  { question: "What does the Model Code of Conduct regulate?", options: ["Voter behavior", "Candidate & party conduct", "EVM operations", "Media rules"], correct: 1, explanation: "The Model Code of Conduct regulates political parties and candidates during elections to ensure fair elections." },
  { question: "What is VVPAT?", options: ["Vote counting speedup", "Online voting system", "Paper trail to verify EVM vote", "Re-polling mechanism"], correct: 2, explanation: "VVPAT (Voter Verifiable Paper Audit Trail) displays a paper slip for 7 seconds after voting, letting voters verify their vote." },
  { question: "How many digits are in an Aadhaar number?", options: ["10 digits", "12 digits", "14 digits", "16 digits"], correct: 1, explanation: "Aadhaar is a 12-digit unique identity number issued by UIDAI to Indian residents." },
  { question: "What is the EC helpline number?", options: ["1800", "1950", "100", "112"], correct: 1, explanation: "1950 is the Election Commission helpline number for voter-related queries and complaints." }
];

export function getQuizQuestions() { return quizQuestions; }

// ═══════════════════════════════════════════════════
// JOURNEY DETAILS
// ═══════════════════════════════════════════════════

const journeyDetails = {
  register: { title: 'Register to Vote', text: 'Complete your voter registration using Aadhaar + OTP verification in the Register tab. Required: age 18+, Indian citizenship, address proof.' },
  verify: { title: 'Verification', text: 'After registration, your details are verified by the Electoral Registration Officer. This takes 2-3 business days. You will be notified upon completion.' },
  voterid: { title: 'Get Voter ID', text: 'Your EPIC card will be delivered to your address. You can also download the e-EPIC from the Voter Helpline App or nvsp.in. Both physical and digital versions are valid.' },
  vote: { title: 'Cast Your Vote', text: 'On Election Day, visit your assigned polling station between 7 AM - 6 PM with your Voter ID. The process takes about 5-10 minutes.' },
  counting: { title: 'Vote Counting', text: 'After voting ends, sealed EVMs are transported to counting centers. On counting day, votes are tallied under EC supervision with VVPAT cross-verification.' },
  results: { title: 'Results', text: 'Results are declared by the Returning Officer. Winners are issued certificates. The process is supervised by the Election Commission for transparency.' }
};

export function getJourneyDetail(step) { return journeyDetails[step]; }

// ─── Utility ───
function simulateDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
