// The sign-in screens: each one draws, has the fields it needs, and the Show/Hide password button works.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>/g, ''), { url: 'https://app.test/', pretendToBeVisual: true });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document, location: window.location, history: window.history, localStorage: window.localStorage });
const A = await import('../auth.js');
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FAIL:', m); bad++; } };
const app = () => document.getElementById('app');
const has = (sel) => !!app().querySelector(sel);

A.showAuth({});
ok(has('.auth-cp') && has('h1') && app().querySelector('h1').textContent === 'Sign in', 'sign in draws');
ok(has('input[name=email][type=email]') && has('input[name=password][type=password][autocomplete=current-password]'), 'sign in has email and password');
ok(has('button[type=submit]') && has('[data-action=forgot]') && has('[data-action=signup]'), 'sign in has submit, forgot and create-account links');
const btn = app().querySelector('.pw-toggle'); const pw = app().querySelector('#password');
btn.click(); ok(pw.type === 'text' && btn.textContent === 'Hide' && btn.getAttribute('aria-pressed') === 'true', 'Show reveals the password');
btn.click(); ok(pw.type === 'password' && btn.textContent === 'Show', 'Hide covers it again');
ok(has('a[href="https://cobaltpinksoftware.com"][rel~=noopener]'), 'credit link is safe');

A.showAuth({ mode: 'signup', invite: 'abc' });
ok(app().querySelector('h1').textContent === 'Create your account' && has('input[autocomplete=new-password]') && has('.notice') && has('.hint'), 'create account shows the invitation note and password rule');

A.showAuth({ mode: 'forgot' });
ok(app().querySelector('h1').textContent === 'Reset your password' && has('input[name=email]') && !has('input[type=password]') && !has('.pw-toggle'), 'reset asks for email only');

A.showAuth({ mode: 'signin', notice: 'If an account exists for that email, a reset link is on its way.' });
ok(has('.notice'), 'a notice is shown after a reset request');

A.showCheckEmail('someone@example.test', 'abc');
ok(app().textContent.includes('someone@example.test') && has('[data-action=signin]'), 'check-your-email shows the address and a way back');

A.showRecovery(async () => {});
ok(app().querySelector('h1').textContent === 'Choose a new password' && has('input[autocomplete=new-password]') && has('.pw-toggle'), 'new password screen draws');

A.showNoAccess({ email: 'someone@example.test', onJoin: async () => {}, onSignOut() {}, error: '' });
ok(has('input[name=code]') && has('[data-action=signout]') && app().textContent.includes('someone@example.test'), 'no-access screen asks for the invitation code');

ok(!/undefined|\[object/.test(app().textContent), 'no stray "undefined" in the text');
console.log(bad ? `${bad} auth screen check(s) failed` : 'auth screens: all checks passed');
process.exit(bad ? 1 : 0);
