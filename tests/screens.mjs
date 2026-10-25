// Screens on and off, per user type: the rules in state.js, and the grid in Settings, Screens.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { makeFake } from '../fake-supabase.js';
const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>/g, ''), { url: 'https://app.test/', pretendToBeVisual: true });
const { window } = dom;
Object.assign(globalThis, { window, document: window.document, location: window.location, history: window.history, localStorage: window.localStorage });
const api = await import('../api.js');
const { state, screenOn, hiddenScreens, screenLocked, SWITCHABLE } = await import('../state.js');
const { settingsView } = await import('../settings.js');
let bad = 0; const ok = (c, m) => { if (!c) { console.error('FAIL:', m); bad++; } };
const ROLES = ['superuser', 'fleet_admin', 'fleet_manager', 'reviewer'];

// 1. The rules
const fresh = {};
ok(SWITCHABLE.every((id) => ROLES.every((r) => screenOn(id, r, fresh))), 'a new organisation (no settings) has everything on for every user type');
const legacy = { hidden_screens: ['costs', 'planner'] };
ok(ROLES.every((r) => !screenOn('costs', r, legacy) && !screenOn('planner', r, legacy) && screenOn('tasks', r, legacy)), 'the old single list still hides screens for everyone');
const by = { hidden_screens_by_type: { reviewer: ['costs', 'drivers', 'dashboard'], fleet_manager: ['planner'], superuser: ['settings', 'costs'] }, hidden_screens: ['tasks'] };
ok(!screenOn('costs', 'reviewer', by) && screenOn('costs', 'fleet_admin', by) && screenOn('costs', 'fleet_manager', by), 'costs is off for Management only');
ok(!screenOn('drivers', 'reviewer', by) && !screenOn('dashboard', 'reviewer', by), 'any screen can be switched off, including Drivers and the Dashboard');
ok(screenOn('tasks', 'reviewer', by), 'once the per-type setting exists the old list is ignored');
ok(screenOn('settings', 'superuser', by), 'the superuser always keeps Settings, even if it is in the stored list');
ok(!screenOn('costs', 'superuser', by), 'the superuser can switch other screens off for themselves');
ok(hiddenScreens('fleet_admin', by).length === 0, 'a user type missing from the setting has nothing hidden');
ok(hiddenScreens('reviewer', { hidden_screens_by_type: { reviewer: ['costs', 'nonsense', 7] } }).join() === 'costs', 'unknown entries are ignored');
ok(screenLocked('audit', 'fleet_manager') && screenLocked('audit', 'reviewer') && !screenLocked('audit', 'fleet_admin') && !screenLocked('audit', 'superuser'), 'audit log is locked for types that cannot use it');
ok(screenLocked('settings', 'fleet_admin') && !screenLocked('settings', 'superuser'), 'settings is locked for everyone but the superuser');

// 2. The grid in Settings, Screens
const ORG = 'o1';
api.init(makeFake({ memberships: [{ id: 'm1', organisation_id: ORG, user_id: 'u1', role: 'superuser', status: 'active' }], profiles: [{ id: 'u1', email: 'a@b.c' }], organisations: [{ id: ORG, name: 'T', settings: {} }] }));
Object.assign(state, { org: { id: ORG, name: 'T', settings: {} }, role: 'superuser', user: { id: 'u1' } });
const main = document.body.appendChild(document.createElement('main'));
await settingsView(main);
let form = main.querySelector('#screens-form');
const box = (id, role) => form.elements[`on.${id}.${role}`];
ok(box('dashboard', 'superuser')?.checked && box('drivers', 'reviewer')?.checked && box('costs', 'fleet_manager')?.checked, 'every screen is ticked for every user type to start with');
ok(!box('audit', 'fleet_manager') && !box('audit', 'reviewer') && box('audit', 'fleet_admin') && box('audit', 'superuser'), 'no tick box where the audit log is not available');
ok(!box('settings', 'superuser') && !box('settings', 'fleet_admin'), 'Settings has no switch for anyone');
ok(main.querySelector('#screens-form input[type="checkbox"][disabled]'), 'Settings shows as always on for the superuser');

box('costs', 'reviewer').checked = false; box('dashboard', 'fleet_manager').checked = false; box('drivers', 'reviewer').checked = false;
form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
await new Promise((r) => setTimeout(r, 50));
const saved = state.org.settings;
ok(saved.hidden_screens_by_type?.reviewer?.slice().sort().join() === 'costs,drivers', `Management has Costs and Drivers off (got ${saved.hidden_screens_by_type?.reviewer})`);
ok(saved.hidden_screens_by_type?.fleet_manager?.join() === 'dashboard', 'Fleet manager has the Dashboard off');
ok(saved.hidden_screens_by_type?.superuser?.length === 0 && saved.hidden_screens_by_type?.fleet_admin?.length === 0, 'Superuser and Admin have nothing off');
ok(Array.isArray(saved.hidden_screens) && saved.hidden_screens.length === 0, 'the old single list is cleared when the grid is saved');
ok(!screenOn('costs', 'reviewer') && screenOn('costs', 'fleet_admin') && !screenOn('dashboard', 'fleet_manager'), 'the saved setting applies per user type');

// 3. The old single list shows as ticked-off for every user type until saved
state.org.settings = { hidden_screens: ['planner'] };
await settingsView(main);
form = main.querySelector('#screens-form');
ok(ROLES.every((r) => !box('planner', r).checked) && box('tasks', 'reviewer').checked, 'the grid starts from the old list: Planner off for everyone');

// 4. Where someone lands when their usual first screen is off
const { firstScreenHref } = await import('../shell.js');
const all = SWITCHABLE.filter((id) => id !== 'settings');
Object.assign(state, { role: 'reviewer', org: { id: ORG, name: 'T', settings: { hidden_screens_by_type: { reviewer: ['dashboard'] } } } });
ok(firstScreenHref() === '#/tasks', `Dashboard off for Management: land on Tasks (got ${firstScreenHref()})`);
state.org.settings = { hidden_screens_by_type: { reviewer: all } };
ok(firstScreenHref() === '#/help', `every screen off: land on Help (got ${firstScreenHref()})`);
state.role = 'superuser'; state.org.settings = { hidden_screens_by_type: { superuser: all } };
ok(firstScreenHref() === '#/settings', `superuser with everything else off still lands on Settings (got ${firstScreenHref()})`);

console.log(bad ? `${bad} failed` : 'screens per user type: all passed'); process.exit(bad ? 1 : 0);
