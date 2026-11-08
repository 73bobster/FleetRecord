// Signed-out screens: sign in, create account (with invitation), reset password, join with a code.
import * as api from './api.js';
import { html, mount, on, plate, toast, logoImg, productLogo, wireLogos } from './ui.js';
import { applyBrand } from './shell.js';
import { CONFIG } from './config.js';
import { versionOf } from './versions.js';

const root = () => document.getElementById('app');

function frame(inner) {
  applyBrand(null);
  const org = CONFIG.brand?.name;
  mount(root(), html`
    <div class="auth auth-cp">
      <aside class="auth-side" aria-label="About FleetRecord">
        <div class="auth-side-inner">
          <p class="auth-eyebrow">Fleet compliance</p>
          <p class="auth-headline">Every MOT, licence and renewal, <span>under control.</span></p>
          <p class="auth-line">One secure place for vehicles, drivers, insurance and costs${org ? ` at ${org}` : ''}.</p>
          <ul class="auth-points">
            <li><strong>Your organisation only</strong><span>Database rules keep each organisation's records separate from every other.</span></li>
            <li><strong>The right access for each person</strong><span>Each user type decides who can see and change what, including drivers' licence details.</span></li>
            <li><strong>Every change recorded</strong><span>An audit log shows who changed what, and when.</span></li>
          </ul>
          <div class="auth-plates" aria-hidden="true">${plate('AB12 CDE')}${plate('FM26 MOT')}${plate('XY74 LIC')}</div>
        </div>
      </aside>
      <main class="auth-main" id="main"><div class="auth-card"><div class="brand-stack">${productLogo()}${logoImg(CONFIG.brand?.logoUrl, CONFIG.brand?.name || 'FleetRecord')}</div>${inner}
        <div class="auth-foot"><span class="auth-version">${versionOf('signin')}</span><span>Built by <a href="https://cobaltpinksoftware.com" target="_blank" rel="noopener noreferrer">Cobalt Pink Software</a></span></div>
      </div></main>
    </div>`);
  wireLogos(root());
}

// A "Show" button on each password box, so a typing mistake can be spotted. The password is never stored or logged here.
function wirePasswordToggles() {
  root().querySelectorAll('.pw').forEach((box) => {
    const input = box.querySelector('input');
    const btn = box.querySelector('.pw-toggle');
    if (!input || !btn) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', String(show));
    });
  });
}
const pwBox = (autocomplete, label = 'Password') => html`<div class="field"><label for="password">${label}</label><div class="pw"><input id="password" name="password" type="password" required minlength="8" autocomplete="${autocomplete}"><button class="pw-toggle" type="button" aria-pressed="false" aria-controls="password">Show</button></div>${autocomplete === 'new-password' ? html`<p class="hint">At least 8 characters.</p>` : ''}</div>`;

function wireForm(handler) {
  const form = root().querySelector('form');
  const err = root().querySelector('.form-error');
  form.onsubmit = async (e) => {
    e.preventDefault();
    err.hidden = true;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try { await handler(form); } catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
  };
  form.querySelector('input')?.focus();
  wirePasswordToggles();
}

const redirectUrl = (invite) => `${location.origin}${location.pathname}${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`;

export function showAuth({ mode = 'signin', invite = null, notice = '' } = {}) {
  const signup = mode === 'signup';
  const forgot = mode === 'forgot';
  frame(html`
    <h1>${forgot ? 'Reset your password' : signup ? 'Create your account' : 'Sign in'}</h1>
    ${invite && signup ? html`<p class="notice">You've been invited to join. Create your account with the email address the invitation was sent to.</p>` : ''}
    ${notice ? html`<p class="notice">${notice}</p>` : ''}
    <form class="stack">
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required autocomplete="username" inputmode="email"></div>
      ${forgot ? '' : pwBox(signup ? 'new-password' : 'current-password')}
      <p class="form-error" role="alert" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">${forgot ? 'Send reset link' : signup ? 'Create account' : 'Sign in'}</button>
    </form>
    <p class="auth-alt">${forgot
      ? html`<button class="link" data-action="signin">Back to sign in</button>`
      : signup
        ? html`Already have an account? <button class="link" data-action="signin">Sign in</button>`
        : html`<button class="link" data-action="forgot">Forgot your password?</button><br>New here? <button class="link" data-action="signup">Create an account</button>`}</p>`);
  on(root(), {
    signin: () => showAuth({ mode: 'signin', invite }),
    signup: () => showAuth({ mode: 'signup', invite }),
    forgot: () => showAuth({ mode: 'forgot', invite }),
  });
  wireForm(async (form) => {
    const email = form.elements.email.value.trim().toLowerCase();
    if (forgot) {
      await api.auth.resetPassword(email, redirectUrl(invite));
      showAuth({ mode: 'signin', invite, notice: 'If an account exists for that email, a reset link is on its way.' });
    } else if (signup) {
      const data = await api.auth.signUp(email, form.elements.password.value, redirectUrl(invite));
      if (!data.session) showCheckEmail(email, invite);
    } else {
      await api.auth.signIn(email, form.elements.password.value);
    }
  });
}

export function showCheckEmail(email, invite) {
  frame(html`
    <h1>Check your email</h1>
    <p>We sent a confirmation link to <strong>${email}</strong>. Open it to confirm your address, then sign in.</p>
    ${invite ? html`<p class="hint">Your invitation is saved. It will be applied when you sign in.</p>` : ''}
    <p class="auth-alt"><button class="link" data-action="signin">Back to sign in</button></p>`);
  on(root(), { signin: () => showAuth({ mode: 'signin', invite }) });
}

export function showRecovery(onDone) {
  frame(html`
    <h1>Choose a new password</h1>
    <form class="stack">
      ${pwBox('new-password', 'New password')}
      <p class="form-error" role="alert" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">Save password</button>
    </form>`);
  wireForm(async (form) => {
    await api.auth.updatePassword(form.elements.password.value);
    toast('Password updated.');
    await onDone();
  });
}

// Signed in, but not a member of any organisation yet.
export function showNoAccess({ email, onJoin, onSignOut, error = '' }) {
  frame(html`
    <h1>You're signed in, but not part of an organisation yet</h1>
    <p>You're signed in as <strong>${email}</strong>. Ask your administrator to invite this email address, then enter the invitation code you were given.</p>
    ${error ? html`<p class="form-error" role="alert">${error}</p>` : ''}
    <form class="stack">
      <div class="field"><label for="code">Invitation code</label><input id="code" name="code" type="text" required autocomplete="off" spellcheck="false" placeholder="Paste your invitation code"></div>
      <p class="form-error" role="alert" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">Join organisation</button>
    </form>
    <p class="auth-alt"><button class="link" data-action="signout">Sign out</button></p>`);
  on(root(), { signout: () => onSignOut() });
  wireForm(async (form) => { await onJoin(form.elements.code.value.trim()); });
}
