(function(){
'use strict';
// ---------- WHOOP history (built in) ----------
const RAW = JSON.parse(document.getElementById('whoop').textContent);
const COLS = RAW.cols;
const pack = rows => rows.map(r => Object.fromEntries(COLS.map((c, i) => [c, r[i]])));
const BUILTIN = {rows: pack(RAW.rows), sessions: RAW.sessions.map(([date, strain, minutes]) => ({date, strain, minutes}))};
const avg = (arr, k) => { const v = arr.map(x => x[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

// ---------- dates ----------
const iso = d => d.toISOString().slice(0, 10);
const pD = s => new Date(s + 'T00:00:00Z');
const addDays = (s, n) => { const d = pD(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const localToday = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const TODAY = localToday();
// Imported sources replace or extend the built-in export.
const IMPORT = {whoop: null, apple: null};
let WD, BYDATE, SESS, DAYS, FIRST, LASTW, INS, APPLE = {days: {}, workouts: []}, REF = null;
function buildData(){
  const byDate = {}; BUILTIN.rows.forEach(r => byDate[r.date] = {...r});
  let sessions = BUILTIN.sessions.slice();
  if (IMPORT.whoop) {
    IMPORT.whoop.rows.forEach(r => byDate[r.date] = {...r});
    const dates = new Set(IMPORT.whoop.sessions.map(s => s.date)), from = IMPORT.whoop.from;
    sessions = sessions.filter(s => s.date < from && !dates.has(s.date)).concat(IMPORT.whoop.sessions);
  }
  WD = Object.values(byDate).sort((a, b) => a.date < b.date ? -1 : 1);
  WD.forEach((r, i) => {
    const p30 = WD.slice(Math.max(0, i - 30), i), l7 = WD.slice(Math.max(0, i - 6), i + 1);
    r.hrv30 = avg(p30, 'hrv'); r.rhr30 = avg(p30, 'rhr'); r.temp30 = avg(p30, 'temp'); r.resp30 = avg(p30, 'resp'); r.rec30 = avg(p30, 'recovery'); r.hrv7 = avg(l7, 'hrv');
    const sdv = (k, m) => { const v = p30.map(x => x[k]).filter(x => x != null); if (v.length < 5 || m == null) return null; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || null; };
    r.hrvSd = sdv('hrv', r.hrv30); r.rhrSd = sdv('rhr', r.rhr30); r.respSd = sdv('resp', r.resp30);
    r.prevStrain = i > 0 ? WD[i - 1].strain : null;
  });
  BYDATE = Object.fromEntries(WD.map(r => [r.date, r]));
  SESS = sessions;
  APPLE = IMPORT.apple || {days: {}, workouts: []};
  LASTW = WD[WD.length - 1].date;
  const appleDates = Object.keys(APPLE.days).sort();
  FIRST = appleDates.length && appleDates[0] < WD[0].date ? appleDates[0] : WD[0].date;
  let last = TODAY > LASTW ? TODAY : LASTW; if (appleDates.length && appleDates[appleDates.length - 1] > last) last = appleDates[appleDates.length - 1];
  DAYS = []; for (let d = FIRST; d <= last; d = addDays(d, 1)) DAYS.push(d);
  const mean = g => g.length ? g.reduce((s, r) => s + r.recovery, 0) / g.length : null;
  INS = {
    n: WD.length,
    lateRec: mean(WD.filter(r => r.bed != null && r.bed >= 2)), earlyRec: mean(WD.filter(r => r.bed != null && r.bed < 1)),
    shortRec: mean(WD.filter(r => r.asleep != null && r.asleep < 360)), okRec: mean(WD.filter(r => r.asleep != null && r.asleep >= 420)),
    hardRec: mean(WD.filter(r => r.prevStrain != null && r.prevStrain > 14)), easyRec: mean(WD.filter(r => r.prevStrain != null && r.prevStrain <= 10))
  };
  const alcY = WD.filter(r => r.alcohol === true), alcN = WD.filter(r => r.alcohol === false);
  INS.alcHrv = alcY.length && alcN.length ? avg(alcY, 'hrv') - avg(alcN, 'hrv') : null;
  INS.alcRhr = alcY.length && alcN.length ? avg(alcY, 'rhr') - avg(alcN, 'rhr') : null;
  INS.alcN = alcY.length;
  REF = null;
}
buildData();
const fmtDay = s => pD(s).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC'});
const fmtShort = s => pD(s).toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});

// ---------- helpers ----------
const $ = id => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sgn = (x, d) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x).toFixed(d);
const hm = m => Math.floor(m / 60) + 'h ' + String(Math.round(m % 60)).padStart(2, '0') + 'm';
const clock = h => { const hh = ((h % 24) + 24) % 24; let H = Math.floor(hh), M = Math.round((hh - H) * 60); if (M === 60) { H = (H + 1) % 24; M = 0; } return ((H % 12) || 12) + ':' + String(M).padStart(2, '0') + (H < 12 ? ' am' : ' pm'); };
const hhmmToH = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); const x = h + m / 60; return x >= 12 ? x - 24 : x; };
const pct = v => v == null ? '—' : Math.round(v) + '%';
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const zone = v => v == null ? null : v >= 67 ? 'high' : v >= 34 ? 'mid' : 'low';
const zoneColor = v => v >= 67 ? 'var(--ok)' : v >= 34 ? 'var(--warn)' : 'var(--bad)';
const stColor = s => s === 'ok' ? 'var(--ok)' : s === 'warn' ? 'var(--warn)' : 'var(--bad)';

// ---------- state ----------
const S = {
  sel: LASTW, range: 90, muscle: 'lowerback', tab: 'food',
  layout: null, editing: false,
  logs: {food: [], workouts: [], sleep: []},
  draft: [], vid: null, marks: [], rested: null,
  saving: false, db: null, base: null, prefsRef: null, assets: null
};

// ---------- Supabase backend (the Vercel build) ----------
/* Inside Claude the page saves through Claude. The Vercel build sets window.RD_CONFIG
   and loads supabase-js; then the same calls go to one Supabase table, rd_docs, keyed by
   (user_id, path), with row-level security so each person only sees their own rows.
   Set videos go to a private Storage bucket, read back through short-lived signed links. */
const SB_CFG = window.RD_CONFIG && window.RD_CONFIG.supabaseUrl && !(window.claude && window.claude.use) ? window.RD_CONFIG : null;
let SB = null;
function sbClient(){ if (!SB && SB_CFG && window.supabase) SB = window.supabase.createClient(SB_CFG.supabaseUrl, SB_CFG.supabaseKey); return SB; }
function sbStore(uid){
  const T = () => SB.from('rd_docs'), listeners = new Map();
  const strip = p => p.replace(/^data\/users\/[^/]+\/?/, '');
  const parent = p => p.slice(0, p.lastIndexOf('/'));
  const notify = p => (listeners.get(parent(p)) || new Set()).forEach(f => f());
  const ref = p => ({
    collection: n => col((p ? p + '/' : '') + n),
    get: async () => { const {data, error} = await T().select('data').eq('user_id', uid).eq('path', p).maybeSingle(); if (error) throw error; return {exists: !!data, data: () => data ? data.data : undefined}; },
    set: async d => { const {error} = await T().upsert({user_id: uid, path: p, data: d, updated_at: new Date().toISOString()}); if (error) throw error; notify(p); },
    delete: async () => { const {error} = await T().delete().eq('user_id', uid).eq('path', p); if (error) throw error; notify(p); }
  });
  const col = c => ({
    doc: id => ref(c + '/' + id),
    add: async d => { const id = crypto.randomUUID(); await ref(c + '/' + id).set(d); return {id}; },
    get: async () => {
      const {data, error} = await T().select('path,data').eq('user_id', uid).like('path', c + '/%'); if (error) throw error;
      const docs = data.filter(r => !r.path.slice(c.length + 1).includes('/')).map(r => ({id: r.path.slice(c.length + 1), data: () => r.data}));
      return {empty: !docs.length, docs};
    },
    onSnapshot: (cb, err) => { const run = () => col(c).get().then(cb, err); if (!listeners.has(c)) listeners.set(c, new Set()); listeners.get(c).add(run); run(); return () => listeners.get(c).delete(run); }
  });
  return {doc: p => ref(strip(p))};
}
const sbAssets = uid => ({upload: async blob => {
  const ext = ((blob.type || '').split('/')[1] || 'mp4').split(';')[0], id = uid + '/' + crypto.randomUUID() + '.' + ext;
  const {error} = await SB.storage.from('videos').upload(id, blob, {contentType: blob.type || 'video/mp4'}); if (error) throw error;
  return {id, url: null, sizeBytes: blob.size, contentType: blob.type};
}});
function setVideoSrc(vd, id){
  if (!SB_CFG) { vd.src = '/_blob/' + id; return; }
  if (SB) SB.storage.from('videos').createSignedUrl(id, 3600).then(({data}) => { if (data) vd.src = data.signedUrl; });
}
function sbSignIn(){ const c = sbClient(); if (c) c.auth.signInWithOAuth({provider: 'google', options: {redirectTo: location.origin + location.pathname}}); }
function sbAcct(signedIn){
  const b = $('acct'); if (!SB_CFG) { b.hidden = true; return; }
  b.hidden = false; b.textContent = signedIn ? 'Sign out' : 'Sign in with Google';
  b.onclick = signedIn ? async () => { await SB.auth.signOut(); location.reload(); } : sbSignIn;
}
function sbNeedSignIn(){
  setStatus('off', 'Not saving'); sbAcct(false);
  const bn = $('banner'); bn.hidden = false; bn.replaceChildren(document.createTextNode('Sign in with Google to save your logs, imports and layout. Anything you add before then resets when you reload. '));
  const btn = el('button', 'pill', 'Sign in with Google'); btn.type = 'button'; btn.onclick = sbSignIn; bn.appendChild(btn);
}

// ---------- persistence ----------
function setStatus(kind, text){ const s = $('status'); s.className = 'status ' + kind; $('statusText').textContent = text; }
function offline(msg){
  setStatus('off', 'Not saving');
  const b = $('banner'); b.hidden = false; b.textContent = msg;
}
async function connect(){
  let db, uid;
  if (SB_CFG) {
    const c = sbClient(); if (!c) { offline('Couldn’t load the save service, so entries reset when you reload.'); return; }
    const {data} = await c.auth.getSession(); uid = data && data.session ? data.session.user.id : null;
    if (!uid) { sbNeedSignIn(); return; }
    db = sbStore(uid); S.assets = sbAssets(uid); sbAcct(true);
  } else {
  if (!window.claude || !window.claude.use) { calAutoLoad(); offline('Saving isn’t available in this view. You can still try logging, but entries reset when you reload.'); return; }
  const [cdb, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  if (!cdb || !user) { offline('Sign in to claude.ai to save your logs. Until then, entries reset when you reload.'); return; }
  db = cdb; try { uid = await user.id(); } catch (e) { uid = null; }
  if (!uid) { offline('Couldn’t identify your account, so logs won’t save in this view.'); return; }
  }
  S.db = db;
  const root = db.doc('data/users/' + uid + '/logs');
  S.base = {food: root.collection('food'), workouts: root.collection('workouts'), sleep: root.collection('sleep')};
  S.prefsRef = db.doc('data/users/' + uid + '/prefs');
  setStatus('on', 'Saved to your account');
  Object.entries(S.base).forEach(([k, col]) => {
    col.onSnapshot(snap => { S.logs[k] = snap.docs.map(d => ({id: d.id, ...d.data()})); renderAll(); },
      e => { setStatus('off', 'Lost connection to your log'); });
  });
  try { const p = await S.prefsRef.get(); if (S.prefsDirty) { S.prefsDirty = false; savePrefs(); } else if (p.exists) { const pd = p.data(); if (pd.goals) { S.goals = pd.goals; renderLog(); } if (pd.modes) { Object.keys(S.modes).forEach(k => { if (pd.modes[k] === 'import' || pd.modes[k] === 'connect') S.modes[k] = pd.modes[k]; }); syncModes(); CAL.ver++; CAL.memo.clear(); renderAll(); renderConnections(); } if (pd.layout) { S.layout = normLayout(pd.layout); applyLayout(); renderWidgets(); renderWhy(); scheduleCharts(); } } } catch (e) {}
  if (!SB_CFG) claude.use('assets').then(a => { S.assets = a; });
  const src = db.doc('data/users/' + uid + '/sources');
  S.srcCols = {whoop: src.collection('whoop'), apple: src.collection('apple'), calendar: src.collection('calendar')};
  try {
    const [ws, as] = await Promise.all([S.srcCols.whoop.get(), S.srcCols.apple.get()]);
    if (!ws.empty && !IMPORT.whoop) IMPORT.whoop = joinMonths(ws.docs.map(d => d.data()), 'whoop');
    if (!as.empty && !IMPORT.apple) IMPORT.apple = joinMonths(as.docs.map(d => d.data()), 'apple');
    if (IMPORT.whoop || IMPORT.apple) dataChanged();
  } catch (e) {}
  try { const cs = await S.srcCols.calendar.get(); if (!cs.empty && !CAL.imported) { CAL.imported = calJoin(cs.docs.map(d => d.data())); CAL.ver++; CAL.memo.clear(); renderAll(); renderConnections(); } } catch (e) {}
  calAutoLoad();
}
/* Opening the page never asks for anything. If this page already has permission to save,
   it connects quietly; otherwise it runs locally and asks the first time something needs
   saving (a log entry, an import, a layout change). */
let connecting = null;
function ensureDb(){
  if (S.base) return Promise.resolve(true);
  if (!S.lazy) return Promise.resolve(false);
  if (SB_CFG && S.lazy) { sbNeedSignIn(); return Promise.resolve(false); }   // saving here needs a Google sign-in first
  if (!connecting) connecting = connect().then(() => { S.lazy = false; return !!S.base; }, () => { S.lazy = false; return false; });
  return connecting;
}
async function boot(){
  if (SB_CFG) {
    /* signed in already: connect quietly. Otherwise run locally and offer sign-in, never forcing it */
    const c = sbClient(); const sess = c ? (await c.auth.getSession()).data.session : null;
    if (sess) return connect();
    S.lazy = true; setStatus('off', 'Not saving yet'); sbAcct(false); return;
  }
  if (!window.claude || !window.claude.use) return connect();
  const perms = await claude.use('permissions');
  const st = perms ? await perms.state().catch(() => null) : null;
  const ok = n => !st || st[n] == null || st[n] === 'granted' || st[n] === 'unavailable';
  if (ok('db') && ok('user')) return connect();
  S.lazy = true;
  setStatus('off', 'Not saving yet');
  $('statusText').title = 'Your first entry, import or layout change will ask to save to your account.';
  calAutoLoad();
}
let prefTimer = null;
function savePrefs(){
  if (S.lazy && !S.base) { S.prefsDirty = true; ensureDb().then(ok => { if (ok) savePrefs(); }); return; }
  if (!S.prefsRef) return;
  clearTimeout(prefTimer);
  prefTimer = setTimeout(() => { S.prefsRef.set({layout: JSON.parse(JSON.stringify(S.layout)), goals: {...S.goals}, modes: {...S.modes}}).catch(() => {}); }, 600);
}
async function addLog(kind, data){
  data.createdAt = new Date().toISOString(); await ensureDb();
  if (S.base) { await S.base[kind].add(data); }
  else { S.logs[kind].push({id: 'local-' + Date.now() + Math.random(), ...data}); renderAll(); }
}
async function delLog(kind, id){
  await ensureDb();
  if (S.base && !String(id).startsWith('local-')) await S.base[kind].doc(id).delete();
  else { S.logs[kind] = S.logs[kind].filter(x => x.id !== id); renderAll(); }
}

// ---------- day nav ----------
function step(n){ const i = clamp(DAYS.indexOf(S.sel) + n, 0, DAYS.length - 1); S.sel = DAYS[i]; renderAll(); }
$('prev').onclick = () => step(-1);
$('next').onclick = () => step(1);
$('latest').onclick = () => { S.sel = LASTW; renderAll(); };
$('today').onclick = () => { S.sel = DAYS[DAYS.length - 1]; renderAll(); };
document.addEventListener('keydown', e => { if (e.target.closest('input,select,textarea,button,video,.rsz')) return; if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); });

// ---------- log lookups ----------
const foodOn = d => S.logs.food.filter(f => f.date === d);
const workOn = d => S.logs.workouts.filter(w => w.date === d).concat(APPLE.workouts.filter(w => w.date === d));
const appleDay = d => APPLE.days[d] || null;
function appleAvg(k, d, n){ const v = []; for (let i = 1; i <= n; i++) { const a = APPLE.days[addDays(d, -i)]; if (a && a[k] != null) v.push(a[k]); } return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; }
const sleepOn = d => S.logs.sleep.filter(s => s.date === d).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] || null;
function foodTotals(d){
  const f = foodOn(d), t = {n: f.length};
  ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'water', 'alcohol'].forEach(k => { const v = f.map(x => x[k]).filter(x => x != null && x !== ''); t[k] = v.length ? v.reduce((a, b) => a + Number(b), 0) : null; });
  const a = appleDay(d) && appleDay(d).food;
  if (a) { ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'water', 'alcohol'].forEach(k => { if (a[k] != null) t[k] = (t[k] || 0) + a[k]; }); t.n += 2; t.apple = a; }
  t.lateCaffeine = f.some(x => x.caffeine && x.time && x.time >= '14:00') || !!(a && a.caffeineLate);
  t.lateMeal = f.filter(x => x.time && (x.time >= '21:30' || x.time < '04:00')).sort((a, b) => (Number(b.kcal) || 0) - (Number(a.kcal) || 0))[0] || null;
  return t;
}
const sessLoad = w => (Number(w.minutes) || 0) * (Number(w.effort) || 0);

// ---------- background scene ----------
const SKY = {
  high: {stops: ['#1D4B7C', '#3F78AE', '#8CB2D6', '#C2D4E6'], ridge: ['#7F98B1', '#56708A', '#33445A', '#1B2533'], cloud: 'rgba(255,255,255,0.7)', snow: 'rgba(240,246,252,0.85)', n: 7},
  mid:  {stops: ['#1A2140', '#47476F', '#A07688', '#E4A57A'], ridge: ['#7A6C88', '#514967', '#322C45', '#1C1A29'], cloud: 'rgba(255,212,188,0.45)', snow: 'rgba(255,226,210,0.6)', n: 5},
  low:  {stops: ['#12161F', '#262C39', '#3F4756', '#566072'], ridge: ['#485060', '#343B48', '#242934', '#161A21'], cloud: 'rgba(160,170,185,0.55)', snow: 'rgba(200,208,218,0.35)', n: 10}
};
function rng(seed){ let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function ridgeY(x, W, base, amp, seed){ const t = x / W; return base - amp * (0.55 * Math.sin(t * 6.2 + seed) + 0.3 * Math.sin(t * 13.7 + seed * 2.1) + 0.15 * Math.sin(t * 29.3 + seed * 3.7) + 0.35 * Math.exp(-Math.pow((t - (0.3 + (seed % 0.4))) * 5, 2))); }
let lastScene = '';
function drawScene(force){
  const r = BYDATE[S.sel], z = r ? zone(r.recovery) : 'low';
  const cv = $('bg'), W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  const key = z + W + 'x' + H; if (!force && key === lastScene) return; lastScene = key;
  cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = SKY[z], sky = g.createLinearGradient(0, 0, 0, H * 0.62);
  P.stops.forEach((s, i) => sky.addColorStop(i / (P.stops.length - 1), s)); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const R = rng(z === 'high' ? 7 : z === 'mid' ? 19 : 31);
  for (let i = 0; i < P.n; i++) { const cx = R() * W, cy = H * (0.04 + R() * 0.3), rx = Math.max(90, W * (0.06 + R() * 0.1)), ry = rx * (0.3 + R() * 0.15);
    for (let k = 0; k < 4; k++) { const ox = cx + (k - 1.5) * rx * 0.45, oy = cy + (R() - 0.5) * ry * 0.6, rr = rx * (0.45 + R() * 0.3);
      const grd = g.createRadialGradient(ox, oy, 0, ox, oy, rr); grd.addColorStop(0, P.cloud); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.ellipse(ox, oy, rr, rr * (ry / rx) * 1.6, 0, 0, Math.PI * 2); g.fill(); } }
  [[0.5, 0.1, 1.3], [0.58, 0.12, 2.9], [0.67, 0.11, 4.4], [0.78, 0.08, 6.1]].forEach(([b, a, seed], i) => {
    g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 3) g.lineTo(x, ridgeY(x, W, H * b, H * a, seed)); g.lineTo(W, H); g.closePath(); g.fillStyle = P.ridge[i]; g.fill();
    if (i === 1) { g.save(); g.clip(); g.fillStyle = P.snow; for (let x = 0; x <= W; x += 3) { const y = ridgeY(x, W, H * b, H * a, seed), lim = H * (b - a * 0.35); if (y < lim) g.fillRect(x, y, 3, (lim - y) * 0.55); } g.restore(); }
  });
  const fade = g.createLinearGradient(0, H * 0.5, 0, H); fade.addColorStop(0, 'rgba(11,13,18,0)'); fade.addColorStop(1, 'rgba(11,13,18,0.85)'); g.fillStyle = fade; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, W, H);
}
window.addEventListener('resize', () => { drawScene(); scheduleCharts(); });

// ---------- gauges ----------
const A0 = 200, SWEEP = 220;
function pt(cx, cy, r, deg){ const a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
function arcPath(cx, cy, r, from, sweep){ const [x0, y0] = pt(cx, cy, r, from), [x1, y1] = pt(cx, cy, r, from - sweep); return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`; }
function gauge(frac, number, label, color, crown){
  const p = clamp(frac || 0, 0, 1) * SWEEP;
  const wrap = el('div', 'gauge');
  wrap.innerHTML = `<svg viewBox="0 0 300 228" role="img">
    <path d="${arcPath(150, 150, 118, A0, SWEEP)}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="9" stroke-linecap="round"/>
    ${p > 0.5 ? `<path class="arc" d="${arcPath(150, 150, 118, A0, p)}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>` : ''}
    ${crown ? '<path d="M136,74 l7,-10 l7,6 l7,-6 l7,10 z" fill="#fff"/>' : ''}
    <text x="150" y="168" text-anchor="middle" font-size="88" font-weight="300" fill="#fff" font-family="Figtree, system-ui, sans-serif"></text>
    <text x="150" y="212" text-anchor="middle" font-size="22" font-weight="600" fill="#fff" font-family="Figtree, system-ui, sans-serif"></text></svg>`;
  const t = wrap.querySelectorAll('text'); t[0].textContent = number; t[1].textContent = label;
  wrap.querySelector('svg').setAttribute('aria-label', number + ', ' + label);
  return wrap;
}
function kv(pairs){ const d = el('div', 'kv'); pairs.forEach(([k, v]) => { const r = el('div'); r.append(el('span', null, k), el('b', null, v)); d.appendChild(r); }); return d; }
function spark(values, colorFn, maxV, curIdx, labels){
  const box = el('div'); box.style.display = 'grid'; box.style.gap = '4px';
  const s = el('div', 'spark');
  values.forEach((v, i) => { const b = el('i'); b.style.height = v == null ? '3px' : Math.max(4, 100 * v / maxV) + '%'; b.style.background = v == null ? 'rgba(255,255,255,.12)' : colorFn(v); if (i === curIdx) b.classList.add('cur'); b.title = labels[i] + ': ' + (v == null ? 'no data' : (Math.round(v * 10) / 10)); s.appendChild(b); });
  const lab = el('div', 'sparklab'); lab.append(el('span', null, labels[0]), el('span', null, labels[labels.length - 1]));
  box.append(s, lab); return box;
}
const last7 = () => { const i = DAYS.indexOf(S.sel); return DAYS.slice(Math.max(0, i - 6), i + 1); };

// ---------- widgets ----------
const READY_COPY = {
  high: ['Ready to push', 'Your body has bounced back. If a heavy session is on the plan, today is a good day for it.'],
  mid: ['Steady does it', 'You’re partly recovered. Train as planned but leave a little in the tank.'],
  low: ['Time to recharge', 'Your body is still carrying load. Keep today light and get to bed early tonight.']
};
function contributorsReady(r){
  const out = [];
  if (r.rhr != null && r.rhr30 != null) { const d = r.rhr - r.rhr30; out.push(['Resting heart rate', r.rhr + ' bpm (' + sgn(d, 0) + ')', d <= 1 ? 'ok' : d <= 4 ? 'warn' : 'bad']); }
  if (r.hrv7 != null && r.hrv30 != null) { const q = r.hrv7 / r.hrv30; out.push(['HRV balance', r.hrv + ' ms · 7-day ' + Math.round(r.hrv7) + ' vs ' + Math.round(r.hrv30), q >= .97 ? 'ok' : q >= .88 ? 'warn' : 'bad']); }
  if (r.temp != null && r.temp30 != null) { const d = r.temp - r.temp30; out.push(['Body temperature', sgn(d, 1) + ' °C', Math.abs(d) <= .3 ? 'ok' : Math.abs(d) <= .6 ? 'warn' : 'bad']); }
  if (r.resp != null && r.resp30 != null) { const d = r.resp - r.resp30; out.push(['Respiratory rate', r.resp.toFixed(1) + ' rpm (' + sgn(d, 1) + ')', Math.abs(d) <= .5 ? 'ok' : Math.abs(d) <= 1 ? 'warn' : 'bad']); }
  if (r.prevStrain != null) out.push(['Previous day strain', r.prevStrain.toFixed(1), r.prevStrain <= 14 ? 'ok' : r.prevStrain <= 17 ? 'warn' : 'bad']);
  return out;
}
function statusList(items){
  const d = el('div', 'kv');
  items.forEach(([k, v, st]) => { const r = el('div'); const kspan = el('span'); const dot = el('i'); dot.style.cssText = 'display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:8px;vertical-align:1px;background:' + stColor(st); kspan.append(dot, document.createTextNode(k)); r.append(kspan, el('b', null, v)); d.appendChild(r); });
  return d;
}
function noData(body, text){ body.appendChild(gauge(0, '—', 'No WHOOP data', '#fff')); const p = el('p', 'empty', text); body.appendChild(p); }

function renderWidgets(){
  document.querySelectorAll('.w').forEach(w => {
    const k = w.dataset.w, span = effSpan(k), size = span >= 4 ? 'L' : span >= 2 ? 'M' : 'S';
    w.dataset.size = size;
    const body = w.querySelector('.wbody'); body.replaceChildren();
    const r = BYDATE[S.sel];
    const days7 = last7(), labs = days7.map(fmtShort), ci = days7.length - 1;
    if (k === 'stress') { renderStressWidget(body, size); return; }
    if (k === 'rec') {
      if (!r) {
        const a = appleDay(S.sel);
        if (a && (a.hrv != null || a.rhr != null)) {
          body.appendChild(gauge(0, '—', 'No WHOOP score', '#fff'));
          if (size !== 'S') { const t = el('div'); t.style.cssText = 'display:grid;gap:10px'; const items = [];
            if (a.hrv != null) { const m = appleAvg('hrv', S.sel, 30); items.push(['HRV (Apple)', Math.round(a.hrv) + ' ms' + (m ? ' · avg ' + Math.round(m) : '')]); }
            if (a.rhr != null) { const m = appleAvg('rhr', S.sel, 30); items.push(['Resting HR (Apple)', Math.round(a.rhr) + ' bpm' + (m ? ' · avg ' + Math.round(m) : '')]); }
            t.append(el('p', 'headline', 'From Apple Health'), kv(items), el('p', 'note', 'Apple measures HRV differently from WHOOP, so compare it only with its own average.')); body.appendChild(t); }
          return;
        }
        noData(body, 'WHOOP data here runs to ' + fmtShort(LASTW) + '. Import a newer export in Connections to fill this in.'); return;
      }
      const z = zone(r.recovery), lab = r.recovery >= 85 ? 'Optimal' : r.recovery >= 67 ? 'Good' : r.recovery >= 34 ? 'Fair' : 'Pay attention';
      body.appendChild(gauge(r.recovery / 100, String(r.recovery), lab, '#fff', r.recovery >= 85));
      if (size !== 'S') { const t = el('div'); t.style.cssText = 'display:grid;gap:8px'; t.append(el('p', 'headline', READY_COPY[z][0]), el('p', 'msg', READY_COPY[z][1])); body.appendChild(t); }
      if (size === 'L') { const c = el('div'); c.style.cssText = 'display:grid;gap:12px'; c.append(statusList(contributorsReady(r)), spark(days7.map(d => BYDATE[d] ? BYDATE[d].recovery : null), zoneColor, 100, ci, labs)); body.appendChild(c); }
    }
    if (k === 'sleep') {
      const sl = sleepOn(S.sel);
      if (!r) {
        const as = appleDay(S.sel) && appleDay(S.sel).sleep;
        if (as && as.asleep) {
          const need = avg(WD.slice(-30), 'need') || 480;
          body.appendChild(gauge(as.asleep / need, (as.asleep / 60).toFixed(1), 'hours asleep', 'var(--deep)'));
          if (size !== 'S') { const t = el('div'); t.style.cssText = 'display:grid;gap:10px';
            const st = el('div', 'stages'); [['deep', 'var(--deep)'], ['rem', 'var(--rem)'], ['core', 'var(--light)']].forEach(([kk, c]) => { const i = el('i'); i.style.cssText = 'display:block;height:100%;background:' + c + ';width:' + (100 * (as[kk] || 0) / Math.max(1, as.asleep)) + '%'; st.appendChild(i); });
            const items = [['Source', 'Apple Health']]; if (as.bed != null) items.push(['Fell asleep', clock(as.bed)]); if (as.deep || as.rem) items.push(['Deep · REM', hm(as.deep || 0) + ' · ' + hm(as.rem || 0)]); if (sl && sl.rested) items.push(['How rested you felt', sl.rested + ' / 5']);
            t.append(el('p', 'headline', hm(as.asleep) + ' asleep'), st, kv(items)); body.appendChild(t); }
          return;
        }
        noData(body, sl ? 'You logged feeling ' + sl.rested + ' out of 5 rested.' : 'No sleep data for this night yet. Log how you slept below.'); return;
      }
      const v = r.sleepPerf, lab = v >= 85 ? 'Optimal' : v >= 70 ? 'Sufficient' : 'Poor';
      body.appendChild(gauge(v / 100, String(v), lab, 'var(--deep)'));
      if (size !== 'S') {
        const t = el('div'); t.style.cssText = 'display:grid;gap:10px';
        const st = el('div', 'stages'); [['deep', 'var(--deep)'], ['rem', 'var(--rem)'], ['light', 'var(--light)']].forEach(([kk, c]) => { const i = el('i'); i.style.cssText = 'display:block;height:100%;background:' + c + ';width:' + (100 * (r[kk] || 0) / Math.max(1, r.asleep)) + '%'; st.appendChild(i); });
        t.append(el('p', 'headline', hm(r.asleep) + ' asleep'), st, kv([['Needed', hm(r.need)], ['Fell asleep', clock(r.bed)], ['Deep · REM', hm(r.deep) + ' · ' + hm(r.rem)]]));
        body.appendChild(t);
      }
      if (size === 'L') {
        const c = el('div'); c.style.cssText = 'display:grid;gap:12px';
        const items = [['Efficiency', r.eff + '%'], ['Sleep debt', r.debt ? hm(r.debt) : 'None'], ['Awake in bed', hm(r.awake)]];
        if (sl) { items.push(['How rested you felt', sl.rested ? sl.rested + ' / 5' : '—']); if (sl.tags && sl.tags.length) items.push(['Your notes', sl.tags.map(t => TAGNAME[t] || t).join(', ')]); }
        c.append(kv(items), spark(days7.map(d => BYDATE[d] ? BYDATE[d].asleep / 60 : null), () => 'var(--deep)', 11, ci, labs));
        body.appendChild(c);
      }
    }
    if (k === 'strain') {
      const ws = workOn(S.sel), v = r ? r.strain : null;
      const lab = v == null ? (ws.length ? ws.length + ' logged' : 'Day in progress') : v >= 18 ? 'All out' : v >= 14 ? 'Strenuous' : v >= 10 ? 'Moderate' : 'Light';
      body.appendChild(gauge(v == null ? 0 : v / 21, v == null ? '—' : v.toFixed(1), lab, 'var(--rhr)'));
      if (size !== 'S') {
        const t = el('div'); t.style.cssText = 'display:grid;gap:10px';
        const load = ws.reduce((a, w) => a + sessLoad(w), 0);
        t.append(el('p', 'headline', ws.length ? ws.length + (ws.length > 1 ? ' workouts logged' : ' workout logged') : 'No workouts logged'));
        const a = appleDay(S.sel), extra = [];
        if (a && a.steps != null) extra.push(['Steps (Apple)', Math.round(a.steps).toLocaleString()]);
        if (a && a.activeKcal != null) extra.push(['Active energy (Apple)', Math.round(a.activeKcal) + ' kcal']);
        if (ws.length) t.append(kv(ws.slice(0, 3).map(w => [w.name || KIND[w.kind], (w.minutes ? w.minutes + ' min' : '') + (w.source === 'apple' ? ' · Apple' : w.effort ? ' · effort ' + w.effort : '')]).concat(load ? [['Training load', Math.round(load) + '']] : []).concat(extra)));
        else { t.append(el('p', 'msg', 'Log a workout below to see it here and on the body map.')); if (extra.length) t.append(kv(extra)); }
        body.appendChild(t);
      }
      if (size === 'L') {
        const c = el('div'); c.style.cssText = 'display:grid;gap:12px';
        const ses = SESS.filter(s => s.date === S.sel);
        c.append(kv([['WHOOP lifting sessions', ses.length ? ses.map(s => s.strain.toFixed(1)).join(', ') : 'None'], ['7-day average strain', (() => { const v7 = days7.map(d => BYDATE[d] && BYDATE[d].strain).filter(x => x != null); return v7.length ? (v7.reduce((a, b) => a + b, 0) / v7.length).toFixed(1) : '—'; })()]]),
          spark(days7.map(d => BYDATE[d] ? BYDATE[d].strain : null), () => 'var(--rhr)', 21, ci, labs));
        body.appendChild(c);
      }
    }
  });
}


const mean = g => g.length ? g.reduce((s, r) => s + r.recovery, 0) / g.length : null;

// ---------- under-recovery analysis ----------
const TAGNAME = {noise: 'Noise', screens: 'Late screens', stress: 'Stress', hot: 'Room too hot', woke: 'Woke in the night', travel: 'Travel', sore: 'Sore'};
const KIND = {strength: 'Strength', cardio: 'Cardio', sport: 'Sport', other: 'Workout'};
function causes(d){
  const r = BYDATE[d], out = [];
  const prev = addDays(d, -1), ft = foodTotals(prev), wl = workOn(prev), sl = sleepOn(d);
  const bed = r && r.bed != null ? r.bed : (sl && sl.bed ? hhmmToH(sl.bed) : null);
  if (bed != null && bed >= 1) out.push({sev: bed >= 2 ? 3 : 1.6, src: 'WHOOP', t: 'Late bedtime', now: 'You fell asleep at ' + clock(bed) + '.', ev: 'After a 2 am or later bedtime your recovery averages ' + pct(INS.lateRec) + ', against ' + pct(INS.earlyRec) + ' before 1 am.', fix: 'Aim to be asleep by 12:30 am tonight.'});
  if (r && r.asleep != null && r.need) { const q = r.asleep / r.need; if (q < 0.85) out.push({sev: q < 0.7 ? 3 : 2, src: 'WHOOP', t: 'Not enough sleep', now: 'You slept ' + hm(r.asleep) + ' of the ' + hm(r.need) + ' you needed.', ev: 'Under 6 hours your recovery averages ' + pct(INS.shortRec) + '; at 7 hours or more it averages ' + pct(INS.okRec) + '.', fix: 'Give yourself about ' + hm(r.need / Math.max(0.75, (r.eff || 88) / 100)) + ' in bed tonight.'}); }
  if (r && r.hrv != null && r.hrv30) { const dd = 1 - r.hrv / r.hrv30; if (dd >= 0.1) out.push({sev: dd >= 0.2 ? 3 : 2, src: 'WHOOP', t: 'HRV below your normal', now: 'HRV was ' + r.hrv + ' ms, ' + Math.round(dd * 100) + '% under your 30-day average of ' + Math.round(r.hrv30) + ' ms.', ev: 'HRV is one of the main inputs to your Recovery score. A dip usually means your body is still handling stress or training load.', fix: 'Keep training easy today. HRV usually rebounds after a night or two of good sleep.'}); }
  if (r && r.rhr != null && r.rhr30) { const dd = r.rhr - r.rhr30; if (dd >= 3) out.push({sev: dd >= 6 ? 2.8 : 1.8, src: 'WHOOP', t: 'Resting heart rate up', now: 'Resting heart rate was ' + r.rhr + ' bpm, ' + Math.round(dd) + ' above your 30-day average.', ev: 'A raised resting heart rate often follows hard training, alcohol, a late meal or low fluids.', fix: 'Drink water through the morning and keep intensity low.'}); }
  const load = wl.reduce((a, w) => a + sessLoad(w), 0);
  if ((r && r.prevStrain != null && r.prevStrain > 14) || load >= 600) {
    const bits = []; if (r && r.prevStrain != null) bits.push('Strain ' + r.prevStrain.toFixed(1)); if (wl.length) bits.push('logged ' + wl.map(w => w.name || KIND[w.kind]).join(', ') + (load ? ' (load ' + Math.round(load) + ')' : ''));
    out.push({sev: ((r && r.prevStrain >= 17) || load >= 900) ? 2.6 : 1.8, src: wl.length ? 'Your log + WHOOP' : 'WHOOP', t: 'Hard day yesterday', now: 'Yesterday: ' + bits.join('; ') + '.', ev: 'After days over 14 Strain your recovery averages ' + pct(INS.hardRec) + ', against ' + pct(INS.easyRec) + ' after light days.', fix: 'Make today a lighter session or a rest day.'});
  }
  const drinks = ft.alcohol || 0;
  if (drinks > 0 || (r && r.alcohol === true)) out.push({sev: drinks >= 3 ? 2.6 : 2, src: drinks > 0 ? 'Your log' : 'WHOOP journal', t: 'Alcohol', now: drinks > 0 ? 'You logged ' + drinks + (drinks > 1 ? ' drinks' : ' drink') + ' yesterday.' : 'You logged alcohol in your WHOOP journal.', ev: INS.alcHrv != null ? 'On your alcohol nights HRV averaged ' + Math.abs(INS.alcHrv).toFixed(1) + ' ms ' + (INS.alcHrv < 0 ? 'lower' : 'higher') + ' and resting heart rate ' + Math.abs(INS.alcRhr).toFixed(1) + ' bpm ' + (INS.alcRhr > 0 ? 'higher' : 'lower') + ' (' + INS.alcN + ' nights).' : '', fix: 'Skip alcohol tonight to let HRV recover.'});
  if (ft.lateCaffeine) out.push({sev: 1.6, src: 'Your log', t: 'Afternoon caffeine', now: 'You logged caffeine after 2 pm yesterday.', ev: 'Caffeine can stay active for 6 hours or more and cut into deep sleep.', fix: 'Keep caffeine before 2 pm today.'});
  if (ft.lateMeal) out.push({sev: (Number(ft.lateMeal.kcal) || 0) >= 600 ? 1.8 : 1.3, src: 'Your log', t: 'Late meal', now: (ft.lateMeal.name || 'A meal') + ' at ' + clock(hhmmToH(ft.lateMeal.time)) + (ft.lateMeal.kcal ? ', ' + ft.lateMeal.kcal + ' kcal' : '') + '.', ev: 'Digesting close to bedtime can keep heart rate up during the first part of the night.', fix: 'Finish your last big meal 2–3 hours before bed.'});
  if (ft.sodium != null && ft.sodium > 3500) out.push({sev: 1.2, src: 'Your log', t: 'High sodium', now: 'You logged ' + Math.round(ft.sodium).toLocaleString() + ' mg of sodium yesterday.', ev: 'A salty day can raise resting heart rate and make you wake up thirsty.', fix: 'Drink extra water today and go lighter on salty food tonight.'});
  if (ft.water != null && ft.n >= 2 && ft.water < 1500) out.push({sev: 1.3, src: 'Your log', t: 'Low fluids', now: 'You logged ' + (ft.water / 1000).toFixed(1) + ' L of water yesterday.', ev: 'Running low on fluids raises resting heart rate, especially after training.', fix: 'Aim to spread water through the day, more around training.'});
  if (r && r.debt != null && r.debt >= 45) out.push({sev: r.debt >= 75 ? 2 : 1.2, src: 'WHOOP', t: 'Sleep debt', now: 'You carried ' + hm(r.debt) + ' of sleep debt into last night.', ev: 'Debt adds to tonight’s sleep need, so one short night makes the next one harder to cover.', fix: 'Add 30–60 minutes of sleep over the next few nights.'});
  if (r) { const td = r.temp != null && r.temp30 != null ? r.temp - r.temp30 : 0, rd = r.resp != null && r.resp30 != null ? r.resp - r.resp30 : 0;
    if (td >= 0.5 || rd >= 1) out.push({sev: (td >= 0.8 || rd >= 1.5) ? 2.2 : 1.4, src: 'WHOOP', t: td >= 0.5 ? 'Temperature up' : 'Breathing rate up', now: (td >= 0.5 ? 'Skin temperature was ' + sgn(td, 1) + ' °C' : 'Respiratory rate was ' + sgn(rd, 1) + ' rpm') + ' against your 30-day average.', ev: 'This can show up after very hard training, a hot room, or when your body is fighting something off.', fix: 'Check in with how you feel. If you feel run down, rest.'}); }
  if (sl && sl.tags && sl.tags.length) {
    const env = sl.tags.filter(t => ['noise', 'screens', 'hot', 'woke', 'travel'].includes(t));
    if (env.length) out.push({sev: 1.5 + 0.3 * Math.min(2, env.length - 1), src: 'Your sleep log', t: 'Disturbed night', now: 'You noted: ' + env.map(t => TAGNAME[t].toLowerCase()).join(', ') + '.', ev: r && r.eff != null ? 'Sleep efficiency was ' + r.eff + '%, with ' + hm(r.awake || 0) + ' awake in bed.' : 'Broken sleep cuts the deep and REM stages recovery relies on.', fix: env.includes('screens') ? 'Put screens away 30 minutes before bed.' : env.includes('hot') ? 'Cool the room a couple of degrees tonight.' : 'Try earplugs or a fan for steady background sound.'});
    if (sl.tags.includes('stress')) out.push({sev: 1.8, src: 'Your sleep log', t: 'Stress', now: 'You noted stress last night.', ev: 'Stress keeps the nervous system switched on, which lowers HRV.', fix: 'Try 5 minutes of slow breathing before bed tonight.'});
  }
  const cc = calCause(d); if (cc) out.push(cc);
  return out.sort((a, b) => b.sev - a.sev).slice(0, 4);
}
function renderWhy(){
  const r = BYDATE[S.sel], box = $('causes');
  applyLayout();
  box.replaceChildren();
  if (!r || r.recovery >= 67) { box.appendChild(el('p', 'empty', 'This tile appears on mornings when Readiness is under 67. Place it where you want it to show up.')); return; }
  const list = causes(S.sel);
  if (!list.length) { box.appendChild(el('p', 'empty', 'None of your usual drags stand out last night. Stress, travel or illness may not show up in this data; logging sleep notes helps.')); return; }
  list.forEach(c => {
    const color = c.sev >= 2.5 ? 'var(--bad)' : c.sev >= 1.5 ? 'var(--warn)' : 'var(--muted)';
    const card = el('div', 'cause'); card.style.setProperty('--sev', color);
    const t = el('div', 't'); t.append(el('h3', null, c.t), el('span', 'chip', c.sev >= 2.5 ? 'Big factor' : c.sev >= 1.5 ? 'Likely factor' : 'Minor factor'));
    const fix = el('p', 'fix'); const b = el('b', null, 'Try: '); fix.append(b, document.createTextNode(c.fix));
    card.append(t, el('span', 'src', c.src), el('p', null, c.now), el('p', 'ev', c.ev), fix);
    box.appendChild(card);
  });
}

// ---------- muscle model ----------
const MUS = ['chest','shoulders','traps','upperback','lats','lowerback','biceps','triceps','forearms','abdominals','obliques','hipflexors','glutes','abductors','adductors','quads','hamstrings','calves'];
const MNAME = {chest:'Chest',shoulders:'Shoulders',traps:'Traps',upperback:'Upper back',lats:'Lats',lowerback:'Lower back',biceps:'Biceps',triceps:'Triceps',forearms:'Forearms',abdominals:'Abs',obliques:'Obliques',hipflexors:'Hip flexors',glutes:'Glutes',abductors:'Abductors',adductors:'Adductors',quads:'Quads',hamstrings:'Hamstrings',calves:'Calves'};
const SHARE = {
  squat:{quads:.30,glutes:.20,adductors:.14,lowerback:.12,hamstrings:.06,abdominals:.06,obliques:.04,hipflexors:.03,calves:.03,upperback:.02},
  bench:{chest:.34,triceps:.24,shoulders:.22,lats:.06,upperback:.06,forearms:.04,biceps:.04},
  deadlift:{lowerback:.22,hamstrings:.20,glutes:.18,traps:.08,upperback:.08,lats:.07,quads:.07,forearms:.06,abdominals:.04},
  ohp:{shoulders:.38,triceps:.26,traps:.10,upperback:.08,chest:.08,abdominals:.05,obliques:.05},
  row:{upperback:.32,lats:.28,biceps:.14,lowerback:.10,forearms:.08,shoulders:.08},
  rdl:{hamstrings:.40,glutes:.28,lowerback:.22,forearms:.05,traps:.05},
  pull:{lats:.50,biceps:.22,upperback:.18,forearms:.10},
  legpress:{quads:.55,glutes:.25,adductors:.12,calves:.08},
  lunge:{quads:.40,glutes:.30,adductors:.12,abductors:.10,calves:.04,hipflexors:.04},
  dip:{triceps:.42,chest:.38,shoulders:.20},
  cardio:{quads:.30,hamstrings:.18,glutes:.18,calves:.20,hipflexors:.08,abductors:.06}
};
SHARE.even = {}; MUS.forEach(m => SHARE.even[m] = ((SHARE.squat[m] || 0) + (SHARE.bench[m] || 0) + (SHARE.deadlift[m] || 0)) / 3);
SHARE.other = SHARE.even; SHARE.sport = SHARE.even;
const EXF = {squat:1, bench:.8, deadlift:1.15, ohp:.7, row:.8, rdl:.9, pull:.7, legpress:.9, lunge:.8, dip:.6, other:.7};
const EXNAME = {squat:'Squat', bench:'Bench press', deadlift:'Deadlift', ohp:'Overhead press', row:'Barbell row', rdl:'Romanian deadlift', pull:'Pull-up / pulldown', legpress:'Leg press', lunge:'Lunge', dip:'Dip', other:'Other'};
const TAU = {chest:1.8, shoulders:1.5, traps:1.8, upperback:1.8, lats:1.8, lowerback:2.8, biceps:1.4, triceps:1.4, forearms:1.2, abdominals:1.2, obliques:1.2, hipflexors:1.6, glutes:2.0, abductors:1.8, adductors:2.2, quads:2.0, hamstrings:2.6, calves:1.4};
const e1rm = (load, reps, rpe) => load * (1 + (reps + (10 - rpe)) / 30);
const setStim = x => 3 * clamp((x.rpe - 5) / 4, .2, 1.25) * Math.sqrt(x.reps / 5) * (x.sets || 1) * (EXF[x.ex] || .7);
function runModel(logs){
  const sByDay = {}; SESS.forEach(s => (sByDay[s.date] = sByDay[s.date] || []).push(s));
  const wByDay = {}; logs.forEach(w => (wByDay[w.date] = wByDay[w.date] || []).push(w));
  const F = {}, src = {}; MUS.forEach(m => { F[m] = 0; src[m] = []; });
  const out = {};
  DAYS.forEach(d => {
    const rec = BYDATE[d] ? BYDATE[d].recovery : 50, mod = 0.6 + 0.8 * rec / 100;
    MUS.forEach(m => F[m] *= Math.exp(-mod / TAU[m]));
    out[d] = {F: {...F}, src: Object.fromEntries(MUS.map(m => [m, src[m].slice(-3)]))};
    const logged = wByDay[d] || [], hasStrength = logged.some(w => w.kind === 'strength' && (w.entries || []).length);
    logged.forEach(w => {
      if (w.kind === 'strength' && (w.entries || []).length) {
        w.entries.forEach(x => { const st = setStim(x); Object.entries(SHARE[x.ex] || SHARE.even).forEach(([m, wt]) => { if (!wt) return; F[m] += wt * st; src[m].push({d, txt: EXNAME[x.ex] + ' ' + x.load + ' kg × ' + x.reps + (x.sets > 1 ? ' × ' + x.sets : '') + ' @ ' + x.rpe}); }); });
      } else if (w.minutes && w.effort) {
        const L = sessLoad(w) / 60; const sh = w.kind === 'cardio' ? SHARE.cardio : SHARE.even;
        Object.entries(sh).forEach(([m, wt]) => { if (!wt) return; F[m] += wt * L; src[m].push({d, txt: (w.name || KIND[w.kind]) + ', ' + w.minutes + ' min'}); });
      }
    });
    if (!hasStrength && sByDay[d]) sByDay[d].forEach(s => { const L = Math.pow(2, s.strain / 3) - 1; Object.entries(SHARE.even).forEach(([m, wt]) => { if (!wt) return; F[m] += wt * L; src[m].push({d, txt: 'Unlogged WHOOP session, Strain ' + s.strain.toFixed(1)}); }); });
  });
  return out;
}
function model(){
  if (!REF) { const base = runModel([]); REF = {}; MUS.forEach(m => { const v = Object.values(base).map(o => o.F[m]).sort((a, b) => a - b); REF[m] = Math.max(v[Math.floor(v.length * .85)] || 1, .5); }); }
  const day = runModel(S.logs.workouts)[S.sel];
  const ready = {}; MUS.forEach(m => ready[m] = 100 * Math.exp(-day.F[m] / REF[m]));
  return {ready, src: day.src};
}
function heatColor(v){ const t = clamp(v / 100, 0, 1), lo = css('--bad'), mi = css('--warn'), hi = css('--ok'); return t < .5 ? d3.interpolateRgb(lo, mi)(t / .5) : d3.interpolateRgb(mi, hi)((t - .5) / .5); }
const hoursBack = (v, m) => { const x = -Math.log(Math.max(v, .1) / 100), t = -Math.log(.8); return x <= t ? 0 : TAU[m] * 24 * Math.log(x / t); };
// ---------- thermal lens (after Bencho's HeatMap / "Heat word", MIT, bencho.dev/licence) ----------
/* ══ Heat word ════════════════════════════════════════════
   A big word in flat, dull grey — until the hand comes. Around
   the cursor the word turns into a heat map of its own shape:
   deep navy in the middle of every stroke, through blue, cyan,
   yellow, orange and red, to a pink rim. Right under the pointer
   the heat opens up and the strokes thin, like something melting;
   leave and it fades back to grey.
   Here the "word" is the anatomy: every muscle (or brain region) is
   drawn into the field as bright as the load it is carrying, so the
   hand reveals a thermal view of where the body is working hardest.
   At rest the ordinary map shows through; the lens only paints where
   the hand is.

   ── A FIELD, THEN A PALETTE ─────────────────────────────
   The word is drawn once, blurred, into a grey field: bright in
   the thick of a stroke, fading at its edge. The cursor adds a
   soft round of heat to that field. Every pixel's brightness is
   then looked up in a 256-entry table of colours. Two strokes
   close together overlap in the field, so they fuse where the
   heat pools — that is the liquid, and nothing animates it but
   the field.

   ── THE BLUR IS A SHADOW ────────────────────────────────
   ctx.filter is not in every Safari, shadowBlur is. The word is
   drawn far off the canvas with its shadow thrown back on, so
   only the blurred shadow lands. */

/* the palettes, rim (0) to core (1); below the floor it is the card.
   Neon is the heat camera: a pink rim through red, yellow and
   cyan to a navy core. The others keep its shape — a light rim, a
   dark core, a bright band between — in other colours. */
const TH_PALETTES = {
  Neon: [[0.0, [255, 150, 225]], [0.1, [255, 90, 190]], [0.2, [255, 50, 60]], [0.32, [255, 150, 40]], [0.42, [255, 228, 100]], [0.54, [120, 215, 255]], [0.68, [40, 120, 245]], [0.84, [12, 44, 150]], [1.0, [6, 18, 80]]],
  Fire: [[0.0, [255, 238, 180]], [0.16, [255, 200, 80]], [0.34, [255, 130, 30]], [0.52, [228, 58, 28]], [0.72, [150, 18, 44]], [0.88, [74, 6, 42]], [1.0, [30, 2, 24]]],
  Sea: [[0.0, [210, 255, 225]], [0.16, [110, 245, 175]], [0.34, [40, 215, 200]], [0.52, [40, 150, 235]], [0.72, [80, 70, 205]], [0.88, [60, 20, 130]], [1.0, [24, 8, 60]]],
  Pop: [[0.0, [255, 225, 240]], [0.16, [255, 160, 210]], [0.34, [245, 110, 190]], [0.52, [180, 110, 255]], [0.72, [100, 150, 255]], [0.88, [40, 70, 190]], [1.0, [20, 24, 100]]]
};
const TH_FLOOR = 34;
function thTable(STOPS){
  const t = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    if (i < TH_FLOOR) { /* under the floor: nothing, so the card shows through */ t[i * 4 + 3] = 0; continue; }
    const u = (i - TH_FLOOR) / (255 - TH_FLOOR);
    let k = 0; while (k < STOPS.length - 2 && u > STOPS[k + 1][0]) k++;
    const [u0, c0] = STOPS[k], [u1, c1] = STOPS[k + 1], f = clamp((u - u0) / (u1 - u0), 0, 1);
    for (let c = 0; c < 3; c++) t[i * 4 + c] = c0[c] + (c1[c] - c0[c]) * f;
    /* the rim fades in over the first stretch, so the pink is a
       glow at the edge rather than a hard line */
    t[i * 4 + 3] = 255 * clamp((i - TH_FLOOR) / 26, 0, 1);
  }
  return t;
}
/* one table per palette, made the first time it is asked for */
const TH_LUTS = new Map();
const thLut = name => { let t = TH_LUTS.get(name); if (!t) { t = thTable(TH_PALETTES[name] || TH_PALETTES.Neon); TH_LUTS.set(name, t); } return t; };
S.thermal = 'Neon';

/* a lens on one figure. draw(g, k, off) paints the field's shapes, each with its own
   shadowColor as its brightness, in SVG units scaled by k and pushed off by `off` */
function makeThermal(wrap, vbW, vbH, draw, opts){
  const o = Object.assign({heat: 60, soft: 50, area: 50, maxRatio: 2}, opts || {});
  const shown = document.createElement('canvas'); shown.className = 'thermal'; shown.setAttribute('aria-hidden', 'true');
  wrap.appendChild(shown);
  const s = {base: null, work: null, px: 0.5, py: 0.5, tx: 0.5, ty: 0.5, power: 0, want: 0, raf: 0, ratio: 1};
  /* Area as a multiplier on every radius the hand has: half at 0,
     as it was at 50, half again at 100 */
  const spread = () => 0.5 + clamp(o.area, 0, 100) / 100;
  const build = () => {
    const r = Math.min(o.maxRatio, window.devicePixelRatio || 1); s.ratio = r;
    const cw = wrap.clientWidth || vbW, ch = cw * vbH / vbW, w = Math.max(2, Math.round(cw * r)), h = Math.max(2, Math.round(ch * r));
    s.base = s.base || document.createElement('canvas'); s.base.width = w; s.base.height = h;
    s.work = s.work || document.createElement('canvas'); s.work.width = w; s.work.height = h;
    shown.width = w; shown.height = h; shown.style.width = cw + 'px'; shown.style.height = ch + 'px';
    field();
  };
  /* the field itself, into the base at its current size */
  const field = () => {
    const base = s.base, w = base.width, h = base.height, g = base.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.shadowColor = 'transparent'; g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.shadowBlur = (3 + (clamp(o.soft, 0, 100) / 100) * 8) * (w / vbW);
    const off = w * 3; g.shadowOffsetX = off; g.fillStyle = '#fff';
    /* drawn off the canvas so only the blurred shadow lands; twice over, so the thick of a shape saturates */
    draw(g, w / vbW, off); draw(g, w / vbW, off);
  };
  /* one frame: base, plus heat at the cursor, through the palette */
  const paint = () => {
    if (!s.base) return; const w = shown.width, h = shown.height;
    const g = s.work.getContext('2d', {willReadFrequently: true});
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.drawImage(s.base, 0, 0);
    const cx = s.px * w, cy = s.py * h, unit = w / vbW;
    if (s.power > 0.002) {
      const rad = (34 + (o.heat / 100) * 28) * unit * spread(), amt = s.power * (0.35 + (o.heat / 100) * 0.55);
      /* the cursor COOLS the field: a multiply that dims it toward
         the middle of the pointer, so the navy cores open up into
         rings of blue, cyan, yellow and red and the strokes thin
         there — the letters melting under the hand */
      g.globalCompositeOperation = 'multiply';
      const cool = g.createRadialGradient(cx, cy, 0, cx, cy, rad), v = k => Math.round(255 * (1 - amt * k));
      cool.addColorStop(0, `rgb(${v(1)},${v(1)},${v(1)})`); cool.addColorStop(0.45, `rgb(${v(0.6)},${v(0.6)},${v(0.6)})`); cool.addColorStop(1, 'rgb(255,255,255)');
      g.fillStyle = cool; g.fillRect(0, 0, w, h);
    }
    const src = g.getImageData(0, 0, w, h).data, LUT = thLut(S.thermal), sg = shown.getContext('2d'), out = sg.createImageData(w, h), d = out.data;
    /* the reveal: how much heat map each pixel shows, a soft disc
       around the cursor scaled by how present the hand is. Outside
       it the ordinary map shows through. */
    const R = (54 + (o.heat / 100) * 30) * unit * spread(), R2 = R * R, on = s.power;
    if (on > 0.002) for (let y = 0, i = 0; y < h; y++) { const dy2 = (y - cy) * (y - cy);
      for (let x = 0; x < w; x++, i += 4) { const q = ((x - cx) * (x - cx) + dy2) / R2; if (q >= 1) continue;
        const t = 1 - q, m = on * t * t * (3 - 2 * t), v = src[i] * 4;
        d[i] = LUT[v]; d[i + 1] = LUT[v + 1]; d[i + 2] = LUT[v + 2]; d[i + 3] = LUT[v + 3] * m; } }
    sg.putImageData(out, 0, 0);
  };
  /* the loop runs only while something is moving */
  const run = () => {
    if (s.raf) return; let prev = performance.now();
    const step = t => {
      if (!shown.isConnected) { s.raf = 0; return; }
      const dt = Math.min(0.05, (t - prev) / 1000); prev = t;
      const k = 1 - Math.pow(0.002, dt);
      s.px += (s.tx - s.px) * k; s.py += (s.ty - s.py) * k;
      s.power += (s.want - s.power) * (1 - Math.pow(0.01, dt));
      paint();
      const still = Math.abs(s.want - s.power) < 0.004 && Math.abs(s.tx - s.px) < 0.001 && Math.abs(s.ty - s.py) < 0.001;
      if (still && s.want === 0) { s.power = 0; paint(); }
      s.raf = still ? 0 : requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  };
  const aim = e => { const r = wrap.getBoundingClientRect(); s.tx = (e.clientX - r.left) / r.width; s.ty = (e.clientY - r.top) / r.height; };
  wrap.addEventListener('pointerenter', e => { if (!s.base) build(); aim(e); s.px = s.tx; s.py = s.ty; s.want = 1; run(); });
  wrap.addEventListener('pointermove', e => { if (!s.base) build(); aim(e); s.want = 1; run(); });
  wrap.addEventListener('pointerleave', () => { s.want = 0; run(); });
  return {repaint(){ if (s.base) { build(); paint(); } }};
}
/* shared helpers for the two figures: a shape into the field at brightness v (0..1) */
function thFill(g, k, off, shape, v, mirror){
  const c = Math.round(255 * clamp(v, 0, 1)); g.shadowColor = `rgb(${c},${c},${c})`;
  g.setTransform(mirror ? -k : k, 0, 0, k, -off + (mirror ? 200 * k : 0), 0);
  if (shape.tag === 'ellipse') { g.beginPath(); g.ellipse(+shape.cx, +shape.cy, +shape.rx, +shape.ry, 0, 0, Math.PI * 2); g.fill(); }
  else g.fill(new Path2D(shape.d));
}
function thermalPicker(host){
  host.replaceChildren();
  Object.keys(TH_PALETTES).forEach(name => { const b = el('button', 'thchip', name); b.type = 'button'; b.setAttribute('aria-pressed', String(S.thermal === name));
    b.onclick = () => { S.thermal = name; document.querySelectorAll('.thpick').forEach(thermalPicker); TH_LENSES.forEach(l => l.repaint()); }; host.appendChild(b); });
}
let TH_LENSES = [];

// ---------- anatomy (original drawing; left half is drawn and mirrored) ----------
const SIL_HALF = 'M100,55 L92,55 C91,62 88,66 84,69 C74,73 62,75 54,79 C46,83 41,93 41,106 C40,124 38,142 36,160 C34,178 30,196 28,214 C26,228 24,240 24,251 C22,262 23,272 29,273 C34,272 35,263 35,255 L37,246 C41,226 46,206 49,190 C51,176 54,160 56,146 L63,124 C65,150 68,170 70,190 C66,206 64,220 66,236 C64,262 66,292 70,322 C72,340 72,356 74,372 C76,392 78,406 78,417 C76,426 73,432 80,435 L93,435 C93,428 90,421 90,414 C90,396 92,370 92,348 C92,336 94,326 94,316 C96,290 98,262 100,246 Z';
const ANAT = {
  front: [
    ['traps', 'M93,58 C89,64 85,68 77,72 C82,74 88,73 93,69 C95,66 96,62 96,60 Z'],
    ['shoulders', 'M55,80 C47,84 42,94 42,107 C42,117 46,124 52,126 C55,113 61,97 70,87 C66,82 61,80 55,80 Z'],
    ['chest', 'M98,82 C88,79 77,81 71,87 C63,97 59,110 61,121 C71,129 87,129 98,123 Z'],
    ['biceps', 'M53,128 C47,136 43,148 43,161 C45,169 50,171 54,167 C58,153 60,139 60,127 C58,123 55,123 53,128 Z'],
    ['forearms', 'M43,171 C37,185 33,200 31,216 C30,227 32,233 36,232 C41,220 46,205 50,189 C52,181 50,173 46,171 Z'],
    ['abdominals', 'M89,130 L98.5,130 L98.5,145 L88,145 C88,140 88,135 89,130 Z'],
    ['abdominals', 'M88,148 L98.5,148 L98.5,163 L88,163 Z'],
    ['abdominals', 'M88,166 L98.5,166 L98.5,181 L88,181 Z'],
    ['abdominals', 'M88,184 L98.5,184 L98.5,226 C94,223 90,214 88,206 Z'],
    ['obliques', 'M72,128 C77,132 82,134 85.5,136 L85.5,205 C80,203 75,198 72,190 C70,170 70,148 72,128 Z'],
    ['hipflexors', 'M85,210 C83,221 81,231 79,240 L91,251 C91,239 89,224 87,212 Z'],
    ['abductors', 'M67,232 C65,240 66,249 70,256 L74,244 C72,238 70,234 67,232 Z'],
    ['quads', 'M70,246 C66,272 66,300 72,324 C76,327 80,327 82,321 C80,297 78,269 76,247 Z'],
    ['quads', 'M78,243 C80,270 82,296 84,318 C88,321 90,317 90,311 C90,285 88,262 86,247 Z'],
    ['quads', 'M88,292 C86,304 86,316 90,326 C94,325 96,317 94,301 C92,294 90,290 88,292 Z'],
    ['adductors', 'M92,247 C92,263 92,280 92,295 C96,289 98,272 99,253 Z'],
    ['calves', 'M74,340 C70,357 72,377 76,393 L80,393 C80,375 80,355 78,340 Z'],
    ['calves', 'M90,341 C92,357 92,373 90,387 L86,387 C86,371 86,355 88,341 Z']
  ],
  back: [
    ['traps', 'M100,57 C94,62 86,70 72,76 C82,83 92,98 100,130 Z'],
    ['shoulders', 'M55,80 C47,84 42,94 42,107 C46,113 52,115 56,111 C58,101 64,91 72,85 C66,81 61,80 55,80 Z'],
    ['upperback', 'M72,87 C80,94 90,106 97,130 L95,141 C86,133 76,125 66,119 C64,109 66,97 72,87 Z'],
    ['triceps', 'M44,109 C40,125 38,143 38,159 C42,167 48,167 52,161 C54,145 56,129 56,115 C52,111 48,109 44,109 Z'],
    ['forearms', 'M41,171 C35,185 32,200 30,216 C29,227 31,233 35,232 C40,220 45,205 49,189 C51,181 49,173 45,171 Z'],
    ['lats', 'M66,123 C76,129 88,137 97,145 L97,177 C88,187 80,193 72,195 C70,175 68,151 66,123 Z'],
    ['lowerback', 'M91,146 L98.5,146 L98.5,224 L89.5,224 C89.5,200 89.5,170 91,146 Z'],
    ['obliques', 'M71,197 C77,199 83,200 88.5,201 L88.5,212 C81,213 75,212 69,210 Z'],
    ['abductors', 'M68,214 C67,220 67,226 68,231 C76,226 83,224 88.5,224 L88.5,215 C81,216 74,216 68,214 Z'],
    ['glutes', 'M68,233 C66,248 70,264 82,269 C92,271 99,267 99,257 L99,231 C90,227 78,227 68,233 Z'],
    ['hamstrings', 'M70,273 C66,297 68,317 74,335 L84,335 C84,313 82,291 82,273 Z'],
    ['hamstrings', 'M86,273 C86,293 88,315 90,333 L94,331 C96,311 96,291 96,273 Z'],
    ['calves', 'M72,343 C68,359 70,377 78,389 C82,385 84,371 84,351 C82,345 78,341 72,343 Z'],
    ['calves', 'M86,345 C86,363 86,381 88,393 C94,385 94,365 92,347 C90,343 88,343 86,345 Z']
  ]
};
const ARM = new Set(['shoulders','biceps','triceps','forearms']), LEG = new Set(['glutes','abductors','adductors','quads','hamstrings','calves','hipflexors']);
const NS = 'http://www.w3.org/2000/svg';

// ---------- synapse layer ----------
const SYN = {figs: [], sparks: [], flashes: [], running: false, last: 0, visible: true, reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches};
function routeFor(m, x, y){
  const side = x < 100 ? -1 : 1, P = [[100, 40], [100, 62]];
  if (ARM.has(m)) { P.push([100, 80], [100 + side * 30, 86]); if (m !== 'shoulders') P.push([100 + side * 52, 112]); }
  else if (LEG.has(m)) { P.push([100, 236], [100 + side * 14, 246]); if (m === 'calves' || (m === 'hamstrings' && y > 300)) P.push([100 + side * 18, 330]); }
  else P.push([100, clamp(y, 70, 230)]);
  P.push([x, y]);
  const seg = []; let len = 0; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(l); len += l; }
  return {P, seg, len};
}
function pointAt(r, d){
  for (let i = 0; i < r.seg.length; i++) { if (d <= r.seg[i]) { const t = d / r.seg[i], a = r.P[i], b = r.P[i + 1]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; } d -= r.seg[i]; }
  return r.P[r.P.length - 1];
}
function rgba(c, a){ const k = d3.color(c); return k ? `rgba(${k.r},${k.g},${k.b},${a})` : `rgba(255,255,255,${a})`; }
function synSetup(fig, svg, nodes){
  let cv = fig.querySelector('canvas'); if (!cv) { cv = document.createElement('canvas'); cv.className = 'syn'; cv.setAttribute('aria-hidden', 'true'); fig.querySelector('.figwrap').appendChild(cv); }
  return {cv, svg, nodes};
}
function synSize(f){
  const w = f.svg.clientWidth || 180, h = w * 440 / 200, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (f.cv.width !== Math.round(w * dpr)) { f.cv.width = Math.round(w * dpr); f.cv.height = Math.round(h * dpr); f.cv.style.width = w + 'px'; f.cv.style.height = h + 'px'; }
  f.k = w / 200 * dpr;
}
function synDraw(now){
  const dt = Math.min(0.05, (now - SYN.last) / 1000 || 0); SYN.last = now;
  SYN.figs.forEach((f, fi) => {
    synSize(f); const g = f.cv.getContext('2d'), k = f.k; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, f.cv.width, f.cv.height); g.setTransform(k, 0, 0, k, 0, 0);
    // nerve network
    g.lineWidth = 0.6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(190,220,255,0.10)';
    g.beginPath(); g.moveTo(100, 40); g.lineTo(100, 236); g.stroke();
    f.nodes.forEach(n => { g.strokeStyle = n.sel ? 'rgba(255,255,255,0.32)' : rgba(n.color, 0.10 + 0.22 * n.fat); g.beginPath(); n.r.P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); });
    // brain node
    g.globalCompositeOperation = 'lighter';
    const bg = g.createRadialGradient(100, 40, 0, 100, 40, 9); bg.addColorStop(0, 'rgba(220,235,255,0.55)'); bg.addColorStop(1, 'rgba(220,235,255,0)'); g.fillStyle = bg; g.beginPath(); g.arc(100, 40, 9, 0, Math.PI * 2); g.fill();
    // spawn + move sparks
    if (!SYN.reduced) f.nodes.forEach(n => { n.acc += dt * n.rate; while (n.acc >= 1) { n.acc -= 1; SYN.sparks.push({fi, n, d: 0, v: 70 + 50 * Math.random()}); } });
    SYN.sparks = SYN.sparks.filter(s => {
      if (s.fi !== fi) return true;
      s.d += s.v * dt;
      if (s.d >= s.n.r.len) { SYN.flashes.push({fi, n: s.n, t: 0}); return false; }
      for (let j = 0; j < 5; j++) { const [x, y] = pointAt(s.n.r, Math.max(0, s.d - j * 2.2)); g.fillStyle = rgba(s.n.sel ? '#ffffff' : s.n.color, (0.9 - j * 0.17)); g.beginPath(); g.arc(x, y, 1.15 - j * 0.15, 0, Math.PI * 2); g.fill(); }
      const [hx, hy] = pointAt(s.n.r, s.d); const hg = g.createRadialGradient(hx, hy, 0, hx, hy, 5); hg.addColorStop(0, rgba(s.n.color, 0.5)); hg.addColorStop(1, rgba(s.n.color, 0)); g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, 5, 0, Math.PI * 2); g.fill();
      return true;
    });
    // synapse nodes
    f.nodes.forEach(n => {
      const pulse = SYN.reduced ? 0 : 0.5 + 0.5 * Math.sin(now / 1000 * (1.2 + 2.4 * n.fat) + n.phase);
      const R = 2.2 + 3.8 * n.fat + pulse * 1.2 + (n.sel ? 2 : 0);
      const ng = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, R * 2.4); ng.addColorStop(0, rgba(n.sel ? '#ffffff' : n.color, 0.75)); ng.addColorStop(0.35, rgba(n.color, 0.35)); ng.addColorStop(1, rgba(n.color, 0));
      g.fillStyle = ng; g.beginPath(); g.arc(n.x, n.y, R * 2.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(n.x, n.y, 0.9 + (n.sel ? 0.6 : 0), 0, Math.PI * 2); g.fill();
    });
    SYN.flashes = SYN.flashes.filter(fl => {
      if (fl.fi !== fi) return true; fl.t += dt; if (fl.t > 0.6) return false;
      const p = fl.t / 0.6; g.strokeStyle = rgba(fl.n.color, 0.7 * (1 - p)); g.lineWidth = 0.8; g.beginPath(); g.arc(fl.n.x, fl.n.y, 2 + p * 9, 0, Math.PI * 2); g.stroke();
      // dendrite sparks into the muscle
      for (let a = 0; a < 4; a++) { const ang = fl.n.phase + a * Math.PI / 2, rr = 3 + p * 7; g.fillStyle = rgba(fl.n.color, 0.6 * (1 - p)); g.beginPath(); g.arc(fl.n.x + Math.cos(ang) * rr, fl.n.y + Math.sin(ang) * rr, 0.7, 0, Math.PI * 2); g.fill(); }
      return true;
    });
    g.globalCompositeOperation = 'source-over';
  });
  if (SYN.running) requestAnimationFrame(synDraw);
}
function synStart(){ if (SYN.reduced) { synDraw(performance.now()); return; } if (!SYN.running && SYN.visible && !document.hidden) { SYN.running = true; SYN.last = performance.now(); requestAnimationFrame(synDraw); } }
function synStop(){ SYN.running = false; }
document.addEventListener('visibilitychange', () => document.hidden ? synStop() : synStart());
if ('IntersectionObserver' in window) new IntersectionObserver(es => { SYN.visible = es[0].isIntersecting; SYN.visible ? synStart() : synStop(); }).observe($('bodies'));
window.addEventListener('resize', () => { if (SYN.reduced) synDraw(performance.now()); });
function synBurst(m){ SYN.figs.forEach((f, fi) => f.nodes.filter(n => n.m === m).forEach(n => { for (let i = 0; i < 3; i++) SYN.sparks.push({fi, n, d: -i * 14, v: 120}); })); }

function renderMuscles(){
  const M = model(), box = $('bodies');
  const fiber = '<defs><pattern id="fib" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><line x1="0" y1="0" x2="0" y2="3" stroke="rgba(0,0,0,.28)" stroke-width=".6"/></pattern>' +
    '<filter id="selglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  box.innerHTML = ['Front', 'Back'].map(s => `<figure><div class="figwrap"><svg viewBox="0 0 200 440" role="img" aria-label="${s} of body">${fiber}<g class="sil"><ellipse cx="100" cy="34" rx="16.5" ry="20.5"/><path d="${SIL_HALF}"/><path d="${SIL_HALF}" transform="translate(200,0) scale(-1,1)"/></g><g class="m"></g></svg></div><figcaption>${s}</figcaption></figure>`).join('');
  SYN.figs = []; SYN.sparks = []; SYN.flashes = []; TH_LENSES = TH_LENSES.filter(() => false);
  ['front', 'back'].forEach((side, si) => {
    const fig = box.querySelectorAll('figure')[si], svg = fig.querySelector('svg'), g = svg.querySelector('.m');
    const groups = {};
    ANAT[side].forEach(([m, d]) => {
      [false, true].forEach(mirror => {
        const key = m + (mirror ? 'R' : 'L');
        let grp = groups[key];
        if (!grp) {
          grp = groups[key] = document.createElementNS(NS, 'g');
          grp.setAttribute('class', 'mus' + (m === S.muscle ? ' sel' : '')); grp.setAttribute('tabindex', mirror ? '-1' : '0'); grp.setAttribute('role', 'button');
          grp.setAttribute('aria-label', MNAME[m] + ', ' + Math.round(M.ready[m]) + '% recovered');
          if (m === S.muscle) grp.setAttribute('filter', 'url(#selglow)');
          if (mirror) grp.setAttribute('transform', 'translate(200,0) scale(-1,1)');
          const t = document.createElementNS(NS, 'title'); t.textContent = MNAME[m] + ' · ' + Math.round(M.ready[m]) + '%'; grp.appendChild(t);
          const pick = () => { S.muscle = m; renderMuscles(); synBurst(m); };
          grp.addEventListener('click', pick); grp.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
          g.appendChild(grp);
        }
        const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', heatColor(M.ready[m])); grp.appendChild(p);
        const f = document.createElementNS(NS, 'path'); f.setAttribute('d', d); f.setAttribute('fill', 'url(#fib)'); f.setAttribute('class', 'fib'); grp.appendChild(f);
      });
    });
    // one synapse node per muscle per side, at the centre of its drawn shape
    const nodes = [];
    Object.entries(groups).forEach(([key, grp]) => {
      const m = key.slice(0, -1), mirror = key.endsWith('R'), bb = grp.getBBox();
      let x = bb.x + bb.width / 2; const y = bb.y + bb.height / 2; if (mirror) x = 200 - x;
      const fat = clamp(1 - M.ready[m] / 100, 0, 1);
      nodes.push({m, x, y, fat, color: heatColor(M.ready[m]), sel: m === S.muscle, rate: 0.08 + 1.5 * Math.pow(fat, 1.4), acc: Math.random(), phase: Math.random() * 6.28, r: routeFor(m, x, y)});
    });
    SYN.figs.push(synSetup(fig, svg, nodes));
    // thermal lens: each muscle as bright as the load it carries, the body outline faint
    const wrapEl = fig.querySelector('.figwrap');
    TH_LENSES.push(makeThermal(wrapEl, 200, 440, (g, k, off) => {
      thFill(g, k, off, {tag: 'ellipse', cx: 100, cy: 34, rx: 16.5, ry: 20.5}, 0.16, false);
      thFill(g, k, off, {d: SIL_HALF}, 0.16, false); thFill(g, k, off, {d: SIL_HALF}, 0.16, true);
      ANAT[side].forEach(([m, d]) => { const v = 0.3 + 0.7 * clamp(1 - M.ready[m] / 100, 0, 1); thFill(g, k, off, {d}, v, false); thFill(g, k, off, {d}, v, true); });
    }));
  });
  synStart();
  const L = $('lifts'); L.replaceChildren();
  [['squat', 'Squat'], ['bench', 'Bench'], ['deadlift', 'Deadlift']].forEach(([k, name]) => {
    const sh = SHARE[k], tot = Object.values(sh).reduce((a, b) => a + b, 0), v = Object.entries(sh).reduce((a, [m, w]) => a + w * M.ready[m], 0) / tot;
    const lim = Object.keys(sh).filter(m => M.ready[m] < 67).sort((a, b) => M.ready[a] - M.ready[b]).slice(0, 2).map(m => MNAME[m].toLowerCase());
    const d = el('div', 'lift'); const bar = el('span', 'bar'); const i = el('i'); i.style.width = v + '%'; i.style.background = heatColor(v); bar.appendChild(i);
    d.append(el('span', 'k', name), el('span', 'v', Math.round(v) + '%'), bar, el('span', 'wh', lim.length ? 'Held back by ' + lim.join(' and ') : 'Ready to load'));
    L.appendChild(d);
  });
  const m = S.muscle, v = M.ready[m], h = hoursBack(v, m), src = M.src[m], D = $('mdetail'); D.replaceChildren();
  const top = el('div', 'top'); const tag = el('span', 'tag', Math.round(v) + '% · ' + (v >= 67 ? 'Recovered' : v >= 34 ? 'Recovering' : 'Fatigued')); tag.style.background = heatColor(v);
  top.append(el('h3', null, MNAME[m]), tag);
  D.append(top, el('p', null, src.length ? 'Recent load: ' + src.slice().reverse().map(s => fmtShort(s.d) + ', ' + s.txt).join('; ') + '.' : 'No lifting load in your recent history.'),
    el('p', null, h > 0 ? 'Back above 80% in about ' + (h < 36 ? Math.round(h) + ' hours' : (h / 24).toFixed(1) + ' days') + ' with rest.' : 'Ready for heavy work.'));
}

// ---------- stress estimate ----------
function stressOf(d){
  const r = BYDATE[d]; if (!r || r.hrv == null || !r.hrv30 || r.rhr == null || r.rhr30 == null) return null;
  const zH = (r.hrv30 - r.hrv) / (r.hrvSd || r.hrv30 * 0.15), zR = (r.rhr - r.rhr30) / (r.rhrSd || 3);
  const zP = r.resp != null && r.resp30 != null ? (r.resp - r.resp30) / (r.respSd || 0.6) : 0, debt = (r.debt || 0) / 60;
  const sl = sleepOn(d), tag = sl && (sl.tags || []).includes('stress') ? 0.3 : 0;
  const parts = [
    {k: 'hrv', v: 0.45 * zH, txt: 'HRV ' + r.hrv + ' ms, ' + (r.hrv < r.hrv30 ? Math.round(100 * (1 - r.hrv / r.hrv30)) + '% under' : Math.round(100 * (r.hrv / r.hrv30 - 1)) + '% over') + ' your normal'},
    {k: 'rhr', v: 0.35 * zR, txt: 'Resting HR ' + r.rhr + ' bpm, ' + sgn(r.rhr - r.rhr30, 0) + ' vs your normal'},
    {k: 'resp', v: 0.15 * zP, txt: r.resp != null && r.resp30 != null ? 'Breathing ' + r.resp.toFixed(1) + ' rpm, ' + sgn(r.resp - r.resp30, 1) + ' vs normal' : ''},
    {k: 'debt', v: 0.25 * debt, txt: r.debt ? hm(r.debt) + ' of sleep debt' : ''},
    {k: 'tag', v: tag, txt: tag ? 'You noted stress in your sleep log' : ''}
  ];
  const cs = calDay(addDays(d, -1)); if (cs && cs.n) parts.push({k: 'cal', v: 0.5 * calScore(cs), txt: 'Yesterday: ' + calText(cs)});
  const value = clamp(1.3 + parts.reduce((a, p) => a + p.v, 0), 0, 3);
  return {value, parts: parts.filter(p => p.txt).sort((a, b) => b.v - a.v)};
}
const stressLabel = v => v < 1 ? 'Low' : v < 2 ? 'Moderate' : 'High';
const stressColor = v => heatColor(100 - (v / 3) * 100);
const STRESS_COPY = {Low: ['Calm and balanced', 'Your nervous system looks settled. A good day for focused work or a hard session.'],
  Moderate: ['Some pressure', 'Your body is carrying a bit of load. Short breaks and an early night will help it settle.'],
  High: ['Under strain', 'Your heart data points to high stress. Keep training easy and give yourself time to wind down tonight.']};

function renderStressWidget(body, size){
  const s = stressOf(S.sel);
  if (!s) { body.appendChild(gauge(0, '—', 'No data', '#fff')); body.appendChild(el('p', 'empty', 'Stress needs that morning’s WHOOP HRV and resting heart rate.')); return; }
  const lab = stressLabel(s.value);
  body.appendChild(gauge(s.value / 3, s.value.toFixed(1), lab, stressColor(s.value)));
  if (size !== 'S') {
    const t = el('div'); t.style.cssText = 'display:grid;gap:8px';
    t.append(el('p', 'headline', STRESS_COPY[lab][0]), el('p', 'msg', STRESS_COPY[lab][1]));
    const up = s.parts.filter(p => p.v > 0.05).slice(0, 2);
    if (up.length) t.append(kv(up.map(p => ['Raising it', p.txt])));
    body.appendChild(t);
  }
  if (size === 'L') {
    const days7 = last7(), c = el('div'); c.style.cssText = 'display:grid;gap:12px';
    const low = s.parts.filter(p => p.v < -0.05).slice(0, 2);
    const host = el('div'); host.style.minWidth = '0';
    c.append(kv(low.length ? low.map(p => ['Helping', p.txt]) : [['Helping', 'Nothing stands out today']]), host);
    body.appendChild(c);
    if (!STB_WIDGET) STB_WIDGET = StackedBars({title: 'Stress', unit: 'avg stress, 0–3', bars: 14, gap: 4, onPick: d => { S.sel = d; renderAll(); }});
    host.appendChild(STB_WIDGET.root); requestAnimationFrame(() => STB_WIDGET.update());
  }
}

// ---------- brain regions ----------
const BRAIN = {
  outline: 'M58,132 C38,98 52,52 98,34 C134,19 186,16 228,33 C268,49 294,84 290,121 C287,147 270,162 244,167 C223,170 203,168 188,172 C172,178 151,180 130,177 C100,174 70,162 58,132 Z',
  sulci: ['M92,66 C112,58 128,66 140,58', 'M150,44 C162,62 158,80 172,92', 'M196,40 C200,60 214,70 210,90', 'M236,56 C238,74 252,84 250,104', 'M78,104 C98,96 116,104 132,96', 'M120,124 C142,114 160,122 178,112', 'M100,148 C124,140 140,150 160,142', 'M226,124 C242,118 258,126 270,118', 'M168,62 C186,58 196,70 214,64'],
  cerebellum: 'M94,163 C78,172 80,198 104,204 C130,210 162,201 168,184 C152,177 122,173 94,163 Z',
  folia: ['M90,178 C112,184 140,186 162,182', 'M92,190 C114,196 138,197 158,192'],
  stem: 'M172,170 C170,192 174,212 178,236 L196,236 C194,212 194,190 200,168 Z'
};
const REGIONS = [
  {id: 'focus', name: 'Focus', area: 'Prefrontal cortex', fn: 'planning, attention, decisions', shape: {tag: 'path', d: 'M234,48 C264,61 287,89 287,119 C285,133 277,143 264,149 C254,131 242,111 228,97 C226,81 228,63 234,48 Z'}, lx: 262, ly: 40, la: 'middle', w: 0.3},
  {id: 'memory', name: 'Memory', area: 'Hippocampus', fn: 'storing what you learned and trained', shape: {tag: 'path', d: 'M146,140 C156,128 176,125 192,132 C203,137 207,147 200,153 C189,151 177,147 164,151 C155,154 146,150 146,140 Z'}, lx: 141, ly: 140, la: 'end', w: 0.2},
  {id: 'stress', name: 'Stress reactivity', area: 'Amygdala', fn: 'threat and stress response', shape: {tag: 'ellipse', cx: 213, cy: 148, rx: 8.5, ry: 6.5}, lx: 225, ly: 166, la: 'start', w: 0.2},
  {id: 'clock', name: 'Body clock', area: 'Hypothalamus', fn: 'sleep timing and hormones', shape: {tag: 'ellipse', cx: 205, cy: 124, rx: 9, ry: 7}, lx: 196, ly: 112, la: 'end', w: 0.1},
  {id: 'auto', name: 'Autonomic balance', area: 'Brainstem', fn: 'heart rate, breathing, rest vs alert', shape: {tag: 'path', d: BRAIN.stem}, lx: 203, ly: 222, la: 'start', w: 0.1},
  {id: 'motor', name: 'Motor recovery', area: 'Cerebellum', fn: 'coordination and movement skill', shape: {tag: 'path', d: BRAIN.cerebellum}, lx: 124, ly: 220, la: 'middle', w: 0.1}
];
const PATHS = [['auto', 'clock'], ['clock', 'stress'], ['stress', 'memory'], ['memory', 'focus'], ['clock', 'focus'], ['auto', 'motor'], ['stress', 'focus']];
S.region = 'focus';

function brainScores(d){
  const r = BYDATE[d]; if (!r) return null;
  const typ = k => avg(WD.filter(x => x.date < d).slice(-30), k);
  const out = {}, why = {};
  // focus
  { let s = 100; const bits = [];
    if (r.debt) { s -= r.debt / 2; bits.push(hm(r.debt) + ' sleep debt'); }
    if (r.need && r.asleep < r.need) { const p = (r.need - r.asleep) / r.need * 60; s -= p; bits.push(hm(r.need - r.asleep) + ' short of your sleep need'); }
    if (r.bed != null && r.bed > 1) { s -= (r.bed - 1) * 15; bits.push('asleep at ' + clock(r.bed)); }
    const ft = foodTotals(addDays(d, -1)); if ((ft.alcohol || 0) > 0 || r.alcohol) { s -= 10; bits.push('alcohol the day before'); }
    out.focus = clamp(s, 0, 100); why.focus = bits.length ? 'Pulled down by ' + bits.join(', ') + '.' : 'Enough sleep, on time, with no debt carried in.'; }
  // memory
  { const rt = typ('rem'), dt = typ('deep');
    out.memory = rt && dt && r.rem != null && r.deep != null ? clamp(50 * r.rem / rt + 50 * r.deep / dt, 0, 100) : null;
    why.memory = out.memory == null ? 'Needs that night’s REM and deep sleep.' : 'REM ' + hm(r.rem) + ' (typical ' + hm(rt) + ') and deep ' + hm(r.deep) + ' (typical ' + hm(dt) + '). Both help lock in what you learned and practised.'; }
  // stress reactivity
  { const st = stressOf(d); out.stress = st ? clamp(100 - st.value / 3 * 100, 0, 100) : null;
    why.stress = st ? 'Stress estimate ' + st.value.toFixed(1) + ' of 3 (' + stressLabel(st.value).toLowerCase() + ').' + (st.parts[0] && st.parts[0].v > 0.05 ? ' Biggest push: ' + st.parts[0].txt.charAt(0).toLowerCase() + st.parts[0].txt.slice(1) + '.' : '') : 'Needs that morning’s HRV and resting heart rate.'; }
  // body clock
  { const i = WD.indexOf(r), wk = WD.slice(Math.max(0, i - 6), i + 1).map(x => x.bed).filter(x => x != null);
    if (wk.length >= 3 && r.bed != null) { const m = wk.reduce((a, b) => a + b, 0) / wk.length, sdv = Math.sqrt(wk.reduce((a, b) => a + (b - m) ** 2, 0) / wk.length);
      out.clock = clamp(100 - sdv * 35 - Math.abs(r.bed - m) * 15, 0, 100);
      why.clock = 'Your bedtimes this week vary by about ' + Math.round(sdv * 60) + ' minutes around ' + clock(m) + '; last night was ' + clock(r.bed) + '. Regular timing keeps the body clock steady.'; }
    else { out.clock = null; why.clock = 'Needs at least three nights of bedtimes.'; } }
  // autonomic balance
  { if (r.hrv7 && r.hrv30 && r.hrv != null && r.rhr != null && r.rhr30 != null) {
      out.auto = clamp(60 + 120 * (r.hrv7 / r.hrv30 - 1) + 60 * (r.hrv / r.hrv30 - 1) - 6 * (r.rhr - r.rhr30), 0, 100);
      why.auto = 'HRV ' + r.hrv + ' ms (7-day ' + Math.round(r.hrv7) + ' vs 30-day ' + Math.round(r.hrv30) + ') and resting HR ' + r.rhr + ' (' + sgn(r.rhr - r.rhr30, 0) + '). Higher HRV and lower resting HR mean the rest-and-recover side is in charge.'; }
    else { out.auto = null; why.auto = 'Needs HRV and resting heart rate.'; } }
  // motor recovery
  { const dt = typ('deep');
    if (dt && r.deep != null) { const pen = Math.max(0, (r.prevStrain || 0) - 12) * 6; out.motor = clamp(100 * r.deep / dt - pen, 0, 100);
      why.motor = 'Deep sleep ' + hm(r.deep) + ' against a typical ' + hm(dt) + (r.prevStrain != null ? ', after a day at Strain ' + r.prevStrain.toFixed(1) : '') + '. Deep sleep is when movement skills consolidate.'; }
    else { out.motor = null; why.motor = 'Needs that night’s deep sleep.'; } }
  const have = REGIONS.filter(g => out[g.id] != null), wsum = have.reduce((a, g) => a + g.w, 0);
  const cog = wsum ? have.reduce((a, g) => a + g.w * out[g.id], 0) / wsum : null;
  return {s: out, why, cog};
}
const TIPS = {focus: 'Protect tonight’s sleep window and keep demanding work for late morning.', memory: 'A full night after learning or technique work helps it stick; avoid alcohol tonight.', stress: 'Five minutes of slow breathing or an easy walk helps bring stress down.', clock: 'Aim for the same bedtime within 30 minutes every night this week.', auto: 'Keep intensity low and drink water; HRV usually rebounds after a night or two of good sleep.', motor: 'Save heavy technical lifts for a day with more deep sleep behind them.'};

// ---------- brain synapse layer ----------
const BSYN = {nodes: {}, sparks: [], flashes: [], running: false, last: 0, visible: true, cv: null, scores: {}};
function bCurve(a, b){ const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.25; return t => [(1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x, (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y]; }
function bDraw(now){
  const cv = BSYN.cv; if (!cv || !cv.isConnected) { BSYN.running = false; return; }
  const dt = Math.min(0.05, (now - BSYN.last) / 1000 || 0); BSYN.last = now;
  const svg = cv.previousElementSibling, w = svg.clientWidth || 300, h = w * 240 / 320, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
  const g = cv.getContext('2d'), k = w / 320 * dpr; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.setTransform(k, 0, 0, k, 0, 0);
  g.lineWidth = 0.7;
  PATHS.forEach(([a, b]) => { const A = BSYN.nodes[a], B = BSYN.nodes[b]; if (!A || !B) return; const f = bCurve(A, B); g.strokeStyle = 'rgba(190,220,255,0.13)'; g.beginPath(); for (let i = 0; i <= 20; i++) { const [x, y] = f(i / 20); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    if (!REDUCE) { const sc = BSYN.scores[b], strain = sc == null ? 0.2 : 1 - sc / 100; const pair = a + b; BSYN.acc = BSYN.acc || {}; BSYN.acc[pair] = (BSYN.acc[pair] || Math.random()) + dt * (0.25 + 1.6 * strain); while (BSYN.acc[pair] >= 1) { BSYN.acc[pair] -= 1; BSYN.sparks.push({f, to: b, t: 0, v: 0.5 + Math.random() * 0.4}); } } });
  g.globalCompositeOperation = 'lighter';
  BSYN.sparks = BSYN.sparks.filter(s => { s.t += s.v * dt; if (s.t >= 1) { BSYN.flashes.push({n: s.to, t: 0}); return false; }
    const col = heatColor(BSYN.scores[s.to] == null ? 70 : BSYN.scores[s.to]);
    for (let j = 0; j < 5; j++) { const [x, y] = s.f(Math.max(0, s.t - j * 0.018)); g.fillStyle = rgba(col, 0.9 - j * 0.17); g.beginPath(); g.arc(x, y, 1.3 - j * 0.18, 0, Math.PI * 2); g.fill(); }
    return true; });
  Object.entries(BSYN.nodes).forEach(([id, n]) => { const sc = BSYN.scores[id], col = heatColor(sc == null ? 70 : sc), strain = sc == null ? 0.2 : 1 - sc / 100;
    const pulse = REDUCE ? 0 : 0.5 + 0.5 * Math.sin(now / 1000 * (1.2 + 2.4 * strain) + n.ph); const R = 3 + 4 * strain + pulse * 1.4 + (id === S.region ? 2 : 0);
    const gr = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, R * 2.4); gr.addColorStop(0, rgba(id === S.region ? '#ffffff' : col, 0.7)); gr.addColorStop(0.4, rgba(col, 0.3)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(n.x, n.y, R * 2.4, 0, Math.PI * 2); g.fill(); });
  BSYN.flashes = BSYN.flashes.filter(fl => { fl.t += dt; if (fl.t > 0.6) return false; const n = BSYN.nodes[fl.n]; if (!n) return false; const p = fl.t / 0.6; g.strokeStyle = rgba(heatColor(BSYN.scores[fl.n] == null ? 70 : BSYN.scores[fl.n]), 0.7 * (1 - p)); g.lineWidth = 0.9; g.beginPath(); g.arc(n.x, n.y, 3 + p * 10, 0, Math.PI * 2); g.stroke(); return true; });
  g.globalCompositeOperation = 'source-over';
  if (BSYN.running) requestAnimationFrame(bDraw);
}
const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function bStart(){ if (REDUCE) { bDraw(performance.now()); return; } if (!BSYN.running && BSYN.visible && !document.hidden && BSYN.cv) { BSYN.running = true; BSYN.last = performance.now(); requestAnimationFrame(bDraw); } }
document.addEventListener('visibilitychange', () => { if (document.hidden) BSYN.running = false; else bStart(); });
if ('IntersectionObserver' in window) new IntersectionObserver(es => { BSYN.visible = es[0].isIntersecting; if (BSYN.visible) bStart(); else BSYN.running = false; }).observe($('brainFig'));

function renderBrain(){
  const B = brainScores(S.sel), fig = $('brainFig'), side = $('brainRegions'), det = $('brainDetail'), cog = $('cogScore');
  cog.replaceChildren(); side.replaceChildren(); det.replaceChildren();
  const SV = 'http://www.w3.org/2000/svg';
  fig.innerHTML = `<svg viewBox="0 0 320 240" role="img" aria-label="Brain, side view"><path class="bshell" d="${BRAIN.outline}"/>${BRAIN.sulci.map(p => `<path class="bsulc" d="${p}"/>`).join('')}<path class="bshell" d="${BRAIN.cerebellum}"/>${BRAIN.folia.map(p => `<path class="bsulc" d="${p}"/>`).join('')}<path class="bshell" d="${BRAIN.stem}"/><g class="regs"></g><g class="labs"></g></svg><canvas aria-hidden="true"></canvas>`;
  const svg = fig.querySelector('svg'), gR = svg.querySelector('.regs'), gL = svg.querySelector('.labs');
  BSYN.cv = fig.querySelector('canvas'); BSYN.nodes = {}; BSYN.sparks = []; BSYN.flashes = []; BSYN.scores = B ? B.s : {};
  const pick = id => { S.region = id; renderBrain(); for (let i = 0; i < 3; i++) { const A = BSYN.nodes.auto, T = BSYN.nodes[id]; if (A && T && id !== 'auto') BSYN.sparks.push({f: bCurve(A, T), to: id, t: -i * 0.12, v: 1.1}); } };
  REGIONS.forEach(rg => {
    const sc = B ? B.s[rg.id] : null, e = document.createElementNS(SV, rg.shape.tag);
    Object.entries(rg.shape).forEach(([k, v]) => { if (k !== 'tag') e.setAttribute(k, v); });
    e.setAttribute('class', 'breg' + (rg.id === S.region ? ' sel' : '')); e.setAttribute('fill', sc == null ? 'rgba(255,255,255,.14)' : heatColor(sc)); e.setAttribute('fill-opacity', '0.85');
    e.setAttribute('tabindex', '0'); e.setAttribute('role', 'button'); e.setAttribute('aria-label', rg.name + ' (' + rg.area + ')' + (sc == null ? ', no data' : ', ' + Math.round(sc) + ' out of 100'));
    const tt = document.createElementNS(SV, 'title'); tt.textContent = rg.area + ' · ' + rg.name + (sc == null ? '' : ' · ' + Math.round(sc)); e.appendChild(tt);
    e.addEventListener('click', () => pick(rg.id)); e.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(rg.id); } });
    gR.appendChild(e);
    const lab = document.createElementNS(SV, 'text'); lab.setAttribute('x', rg.lx); lab.setAttribute('y', rg.ly); lab.setAttribute('class', 'blabel'); lab.setAttribute('text-anchor', rg.la || 'start'); lab.textContent = rg.name; gL.appendChild(lab);
    const bb = e.getBBox(); BSYN.nodes[rg.id] = {x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, ph: Math.random() * 6.28};
    const row = el('button', 'regrow'); row.type = 'button'; row.setAttribute('aria-pressed', String(rg.id === S.region));
    const bar = el('span', 'bar'); const bi = el('i'); bi.style.width = (sc || 0) + '%'; bi.style.background = sc == null ? 'transparent' : heatColor(sc); bar.appendChild(bi);
    row.append(el('span', 'rn', rg.name), el('span', 'rv', sc == null ? '—' : Math.round(sc)), el('span', 'rf', rg.area), bar);
    row.onclick = () => pick(rg.id); side.appendChild(row);
  });
  // thermal lens: each region as bright as the strain it is under, the brain's shell faint
  TH_LENSES.push(makeThermal(fig, 320, 240, (g, k, off) => {
    [BRAIN.outline, BRAIN.cerebellum, BRAIN.stem].forEach(d => thFill(g, k, off, {d}, 0.32, false));
    REGIONS.forEach(rg => { const sc = B ? B.s[rg.id] : null; thFill(g, k, off, rg.shape, sc == null ? 0.4 : 0.5 + 0.5 * (1 - sc / 100), false); });
  }, {maxRatio: 1.5}));
  if (!B) { cog.append(el('b', null, '—'), el('span', null, 'No WHOOP data for this day')); det.appendChild(el('p', null, 'Brain estimates need that morning’s WHOOP data. They’ll fill in when you import a newer export.')); bStart(); return; }
  cog.append(el('b', null, B.cog == null ? '—' : Math.round(B.cog)), el('span', null, 'Cognitive readiness'));
  const rg = REGIONS.find(x => x.id === S.region), sc = B.s[rg.id];
  const top = el('div', 'top'), tag = el('span', 'tag', sc == null ? 'No data' : Math.round(sc) + ' · ' + (sc >= 67 ? 'Ready' : sc >= 34 ? 'Under some load' : 'Strained')); tag.style.background = sc == null ? 'rgba(255,255,255,.3)' : heatColor(sc);
  top.append(el('h3', null, rg.name + ' · ' + rg.area), tag);
  det.append(top, el('p', null, 'Handles ' + rg.fn + '.'), el('p', null, B.why[rg.id]), el('p', null, 'Try: ' + TIPS[rg.id]));
  bStart();
}
function chartStress(){
  const box = $('c-stress'); box.replaceChildren();
  const rows = WD.slice(-30).map(r => ({date: r.date, v: (stressOf(r.date) || {}).value})).filter(r => r.v != null);
  if (!rows.length) return;
  const W = box.clientWidth || 600, H = 110, L = 26, T = 6;
  const x = d3.scaleBand(rows.map(r => r.date), [L, W - 6]), y = d3.scaleLinear([0, 3], [T + H, T]), cx = r => x(r.date) + x.bandwidth() / 2;
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H + T + 22}`);
  [[2, 3, css('--bad')], [1, 2, css('--warn')], [0, 1, css('--ok')]].forEach(([a, b, c]) => svg.append('rect').attr('x', L).attr('width', W - L - 6).attr('y', y(b)).attr('height', y(a) - y(b)).attr('fill', c).attr('opacity', 0.07));
  [0, 1, 2, 3].forEach(v => { svg.append('line').attr('x1', L).attr('x2', W - 6).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', 'rgba(255,255,255,.08)'); svg.append('text').attr('x', L - 6).attr('y', y(v) + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'rgba(235,240,247,.6)').text(v); });
  svg.append('path').attr('d', d3.line().x(cx).y(r => y(r.v))(rows)).attr('fill', 'none').attr('stroke', 'rgba(255,255,255,.75)').attr('stroke-width', 1.8).attr('stroke-linejoin', 'round');
  svg.append('g').selectAll('circle').data(rows).join('circle').attr('cx', cx).attr('cy', r => y(r.v)).attr('r', r => r.date === S.sel ? 5 : 3).attr('fill', r => stressColor(r.v)).attr('stroke', r => r.date === S.sel ? '#fff' : 'none').attr('stroke-width', 1.5).style('cursor', 'pointer')
    .on('click', (e, r) => { S.sel = r.date; renderAll(); });
  const t = tip(box);
  svg.selectAll('circle').on('mousemove', (e, r) => { const b = box.getBoundingClientRect(); showTip(box, t, [[fmtDay(r.date), 'd'], ['Stress ' + r.v.toFixed(1) + ' · ' + stressLabel(r.v)]], cx(r) * b.width / W, y(r.v) * b.width / W); }).on('mouseleave', () => t.hidden = true);
  rows.forEach((r, i) => { if (i % 7 === 0) svg.append('text').attr('x', cx(r)).attr('y', T + H + 16).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'rgba(235,240,247,.6)').text(fmtShort(r.date)); });
}

// ---------- Stacked bars (ported from Bencho's StackedBars.tsx, MIT, bencho.dev/licence) ----------
/* ══ Stacked bars ═════════════════════════════════════════
   An alert-volume card: a stack of four sources for every day (or
   week), and under the baseline the few that were escalated.
   Here: what raised stress each day, stacked by source, and under the
   baseline what calmed it.

   ── RUN ALONG IT ────────────────────────────────────────
   The column under the pointer gets a ring round its whole stack,
   the rest step back (their colour mixed toward the slab, never
   faded), and one tooltip glides beside it on a spring with the
   date, the total and what made it up.

   ── DAY / WEEK ──────────────────────────────────────────
   Swaps the dataset; every segment eases to its new height and
   offset a beat after its left neighbour. The same transition
   grows the bars out of the baseline the first time the card is
   seen. */
const STB_PAD = 16;
const STB_CH = 104; // room above the baseline
const STB_BH = 22; // room below it for the escalated bars
const STB_SEG_GAP = 2;
const STB_LIFT = 2; // air between the baseline and the bars either side of it
const STB_TIP_W = 150;
const STB_SPRING = {stiffness: 380, damping: 34};
const STB_CATS = ['HRV', 'Resting HR', 'Breathing', 'Sleep debt', 'Logged stress', 'Busy calendar'];
const STB_KEYS = ['hrv', 'rhr', 'resp', 'debt', 'tag', 'cal'];

/* the data: every WHOOP morning's stress estimate split into what pushed it up
   (one segment per source) and what pulled it down (the bar under the baseline) */
function stressBars(mode, n){
  const days = WD.map(r => r.date).filter(d => stressOf(d));
  const one = d => { const s = stressOf(d); if (!s) return null; const vals = STB_KEYS.map(k => { const p = s.parts.find(x => x.k === k); return p && p.v > 0 ? p.v : 0; }); const esc = s.parts.filter(p => p.v < 0).reduce((a, p) => a - p.v, 0); return {vals, esc, score: s.value}; };
  const out = [];
  if (mode === 'Day') {
    days.slice(-n).forEach(d => { const o = one(d); out.push({...o, label: fmtDay(d), short: fmtShort(d), date: d}); });
  } else {
    const last = days[days.length - 1];
    for (let w = n - 1; w >= 0; w--) {
      const end = addDays(last, -7 * w), start = addDays(end, -6);
      const xs = days.filter(d => d >= start && d <= end).map(one).filter(Boolean);
      if (!xs.length) continue;
      const m = k => xs.reduce((a, x) => a + x[k], 0) / xs.length;
      out.push({vals: STB_KEYS.map((_, i) => xs.reduce((a, x) => a + x.vals[i], 0) / xs.length), esc: m('esc'), score: m('score'),
        label: fmtShort(start) + ' – ' + (start.slice(5, 7) === end.slice(5, 7) ? String(Number(end.slice(8))) : fmtShort(end)), short: fmtShort(start), date: end});
    }
  }
  return out;
}
const stbSum = a => a.reduce((s, v) => s + v, 0);

function StackedBars(opts){
  const st = {mode: 'Day', at: null, seen: false, gen: 0, last: null, data: [], layout: [], bw: 0, g: 0, W: 300};
  const root = el('div', 'stb'); root.dataset.colour = 'on';
  root.innerHTML = `<div class="stb-head"><div class="stb-titles"><div class="stb-title"></div><div class="stb-sub"></div></div>
    <div class="stb-seg-ctl" data-mode="Day" role="tablist" aria-label="Group by"><span class="stb-thumb" aria-hidden="true"></span>
    <button type="button" role="tab" class="stb-tab" data-m="Day" aria-selected="true" data-on="">Day</button><button type="button" role="tab" class="stb-tab" data-m="Week" aria-selected="false">Week</button></div></div>
    <div class="stb-figure"><span class="stb-num"></span><span class="stb-unit"></span></div>
    <div class="stb-plot" tabindex="0" aria-label="Stress by day. Use the arrow keys to read each column."><span class="stb-base"></span><span class="stb-ring" aria-hidden="true"></span><div class="stb-tip" aria-hidden="true"></div></div>
    <div class="stb-axis"><span></span><span></span></div>`;
  root.querySelector('.stb-title').textContent = opts.title;
  root.querySelector('.stb-unit').textContent = opts.unit;
  const plot = root.querySelector('.stb-plot'), ring = root.querySelector('.stb-ring'), tip = root.querySelector('.stb-tip'), base = root.querySelector('.stb-base'), num = root.querySelector('.stb-num');
  plot.style.height = (STB_CH + 1 + STB_BH) + 'px'; base.style.top = STB_CH + 'px'; tip.style.width = STB_TIP_W + 'px';
  root.querySelectorAll('.stb-tab').forEach(b => b.addEventListener('click', () => { st.mode = b.dataset.m; root.querySelector('.stb-seg-ctl').dataset.mode = st.mode; root.querySelectorAll('.stb-tab').forEach(x => { const on = x === b; x.setAttribute('aria-selected', String(on)); if (on) x.dataset.on = ''; else delete x.dataset.on; }); update(); }));

  /* ring and tooltip: placed at once when they appear, glide after */
  const sp = {ringX: {v: 0, t: 0, vel: 0}, ringY: {v: 0, t: 0, vel: 0}, ringH: {v: 0, t: 0, vel: 0}, tipX: {v: 0, t: 0, vel: 0}};
  let raf = 0, lastT = 0, was = null;
  const step = now => {
    raf = 0; const dt = Math.min(0.032, (now - (lastT || now - 16)) / 1000); lastT = now; let moving = false;
    Object.values(sp).forEach(s => { const a = -STB_SPRING.stiffness * (s.v - s.t) - STB_SPRING.damping * s.vel; s.vel += a * dt; s.v += s.vel * dt; if (Math.abs(s.v - s.t) > 0.05 || Math.abs(s.vel) > 0.05) moving = true; else { s.v = s.t; s.vel = 0; } });
    paintSprings(); if (moving) raf = requestAnimationFrame(step);
  };
  const paintSprings = () => { ring.style.transform = `translate(${sp.ringX.v}px, ${sp.ringY.v}px)`; ring.style.height = sp.ringH.v + 'px'; tip.style.transform = `translate(${sp.tipX.v}px, 0)`; };
  const go = (key, v) => { const s = sp[key]; s.t = v; if (was === null) { s.v = v; s.vel = 0; } };
  function placeRing(){
    const at = st.at, n = st.data.length;
    if (at === null || at >= n) { was = null; delete root.dataset.scrub; return; }
    root.dataset.scrub = '';
    const L = st.layout[at], left = at * (st.bw + st.g), x = left - 3;
    const up = st.seen ? L.top : 0, down = st.seen ? L.esc : 0;
    const y = STB_CH - STB_LIFT - up - 3, h = up + STB_LIFT + 1 + STB_LIFT + down + 6;
    /* beside the column: right while it fits there, else left */
    const CW = st.W - STB_PAD * 2, right = left + st.bw + 8;
    const tx = right + STB_TIP_W <= CW || left - 8 - STB_TIP_W < 0 ? Math.min(CW - STB_TIP_W, right) : left - 8 - STB_TIP_W;
    go('ringX', x); go('ringY', y); go('ringH', h); go('tipX', tx);
    ring.style.width = (st.bw + 6) + 'px';
    if (was === null) paintSprings(); else if (!raf) { lastT = 0; raf = requestAnimationFrame(step); }
    was = at;
    const cur = st.data[at], top2 = cur.vals.map((v, k) => ({v, k})).filter(o => o.v > 0).sort((a, b) => b.v - a.v).slice(0, 2);
    tip.replaceChildren();
    const head = el('div', 'stb-tip-head'); head.append(el('span', null, cur.label), el('b', null, cur.score.toFixed(1) + ' ' + stressLabel(cur.score).toLowerCase())); tip.appendChild(head);
    if (!top2.length) { const r = el('div', 'stb-tip-row'); r.append(el('span', null, 'Nothing pushed it up')); tip.appendChild(r); }
    top2.forEach(({v, k}) => { const r = el('div', 'stb-tip-row'); const i = el('i'); i.style.setProperty('--c', `var(--stb-c${k + 1})`); r.append(i, el('span', null, STB_CATS[k]), el('b', null, '+' + v.toFixed(2))); tip.appendChild(r); });
    const er = el('div', 'stb-tip-row'); er.dataset.esc = ''; er.append(el('i'), el('span', null, 'Calmed by'), el('b', null, cur.esc ? '−' + cur.esc.toFixed(2) : '0')); tip.appendChild(er);
    root.querySelectorAll('.stb-col').forEach((c, i) => { if (i === at) c.dataset.on = ''; else delete c.dataset.on; });
  }
  const pick = e => { const b = plot.getBoundingClientRect(); if (!b.width) return; const i = Math.floor(((e.clientX - b.left - STB_PAD * 0) / b.width) * st.data.length); st.at = clamp(i, 0, st.data.length - 1); placeRing(); };
  plot.addEventListener('pointerdown', e => { try { plot.setPointerCapture(e.pointerId); } catch (err) { /* scripted */ } pick(e); });
  plot.addEventListener('pointermove', pick);
  plot.addEventListener('pointerup', e => { try { plot.releasePointerCapture(e.pointerId); } catch (err) { /* scripted */ } if (e.pointerType !== 'mouse') { st.at = null; placeRing(); clearOn(); } });
  plot.addEventListener('pointercancel', () => { st.at = null; placeRing(); clearOn(); });
  plot.addEventListener('pointerleave', () => { st.at = null; placeRing(); clearOn(); });
  plot.addEventListener('click', e => { if (st.at != null && opts.onPick) opts.onPick(st.data[st.at].date); });
  plot.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); st.at = clamp((st.at == null ? st.data.length : st.at) + (e.key === 'ArrowLeft' ? -1 : 1), 0, st.data.length - 1); placeRing(); }
    else if (e.key === 'Enter' && st.at != null && opts.onPick) opts.onPick(st.data[st.at].date);
    else if (e.key === 'Escape') { st.at = null; placeRing(); clearOn(); }
  });
  plot.addEventListener('blur', () => { st.at = null; placeRing(); clearOn(); });
  const clearOn = () => root.querySelectorAll('.stb-col[data-on]').forEach(c => delete c.dataset.on);

  /* grow in once, the first time the card is on screen */
  if (typeof IntersectionObserver === 'undefined') st.seen = true;
  else { const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { st.seen = true; io.disconnect(); requestAnimationFrame(() => update()); } }, {threshold: 0.3}); io.observe(root); }

  function update(){
    const n = opts.bars;
    st.data = stressBars(st.mode, n);
    const data = st.data, m = data.length; if (!m) return;
    st.W = Math.max(260, root.parentElement ? root.parentElement.clientWidth : 300);
    root.style.width = st.W + 'px';
    const CW = st.W - STB_PAD * 2;
    /* geometry: the gap gives way before a bar gets thinner than 3px,
       so 30 bars at the widest gap still draw */
    const g = Math.max(1, Math.min(opts.gap, (CW - 3 * m) / Math.max(1, m - 1)));
    const bw = (CW - g * (m - 1)) / m, r = Math.min(2.5, bw / 2);
    st.g = g; st.bw = bw;
    root.style.setProperty('--stb-r', r + 'px'); root.style.setProperty('--stb-rr', (r + 3) + 'px');
    const totals = data.map(b => stbSum(b.vals)), maxT = Math.max(0.3, ...totals), maxE = Math.max(0.15, ...data.map(b => b.esc));
    const scale = (STB_CH - STB_LIFT - 2 - STB_SEG_GAP * (STB_CATS.length - 1)) / maxT;
    st.layout = data.map(b => { let y = 0; const segs = b.vals.map(v => { const h = v > 0 ? Math.max(2, v * scale) : 0; const s = {bottom: y, h}; y += h ? h + STB_SEG_GAP : 0; return s; }); return {segs, top: Math.max(0, y - STB_SEG_GAP), esc: b.esc > 0 ? Math.max(3, (b.esc / maxE) * (STB_BH - STB_LIFT - 2)) : 0}; });
    // columns: kept between updates so every segment eases to its new height
    let cols = [...plot.querySelectorAll('.stb-col')];
    while (cols.length > m) cols.pop().remove();
    while (cols.length < m) { const c = el('div', 'stb-col'); STB_CATS.forEach(() => c.appendChild(el('span', 'stb-bar'))); c.appendChild(el('span', 'stb-esc')); plot.insertBefore(c, ring); cols.push(c); }
    cols.forEach((c, i) => {
      c.style.left = (i * (bw + g)) + 'px'; c.style.width = bw + 'px'; c.style.setProperty('--i', i);
      if (data[i].date === S.sel) c.dataset.sel = ''; else delete c.dataset.sel;
      const bars = c.querySelectorAll('.stb-bar');
      st.layout[i].segs.forEach((s, k) => { const b = bars[k]; b.style.setProperty('--c', `var(--stb-c${k + 1})`); b.style.bottom = (STB_BH + 1 + STB_LIFT + (st.seen ? s.bottom : 0)) + 'px'; b.style.height = (st.seen ? s.h : 0) + 'px'; });
      const e = c.querySelector('.stb-esc'); e.style.top = (STB_CH + 1 + STB_LIFT) + 'px'; e.style.height = (st.seen ? st.layout[i].esc : 0) + 'px';
    });
    root.querySelector('.stb-sub').textContent = 'Last ' + m + ' ' + (st.mode === 'Day' ? 'mornings' : 'weeks');
    const ax = root.querySelectorAll('.stb-axis span'); ax[0].textContent = data[0].short; ax[1].textContent = data[m - 1].short;
    /* the headline pops in on a change, Price flow's way: every
       character is keyed by a generation, so a new total is new
       elements and each plays one short entrance, left to right.
       The first paint does not play it; only a change does. */
    const avgScore = stbSum(data.map(d => d.score)) / m, txt = avgScore.toFixed(1);
    if (st.last !== null && st.last !== txt) st.gen++;
    if (st.last !== txt || !num.childNodes.length) {
      num.replaceChildren(); num.setAttribute('aria-label', txt + ' average stress');
      txt.split('').forEach((ch, i) => { const s = el('span', 'stb-digit', ch); if (st.gen > 0) s.dataset.pop = ''; s.style.setProperty('--i', i); s.setAttribute('aria-hidden', 'true'); num.appendChild(s); });
    }
    st.last = txt;
    if (st.at != null) placeRing();
  }
  return {root, update};
}
let STB_BRAIN = null, STB_WIDGET = null;
function renderStressBars(){
  const host = $('stb-stress'); if (!host) return;
  if (!STB_BRAIN) { STB_BRAIN = StackedBars({title: 'Stress', unit: 'avg stress, 0–3', bars: 20, gap: 6, onPick: d => { S.sel = d; renderAll(); }}); host.appendChild(STB_BRAIN.root); }
  STB_BRAIN.update();
}

// ---------- logging ----------
function flash(id, text, err){ const m = $(id); m.textContent = text; m.classList.toggle('err', !!err); if (!err) setTimeout(() => { if (m.textContent === text) m.textContent = ''; }, 4000); }
const num = id => { const v = $(id).value; return v === '' ? null : Number(v); };
function saveErr(err){ const c = err && err.code; if (c === 'quota_exceeded') return 'Your log is full. Delete some old entries and try again.'; if (c === 'not_granted' || c === 'permission_denied') return 'You don’t have permission to save here.'; return 'Couldn’t save. Check your connection and try again.'; }
async function updLog(kind, id, data){
  data.updatedAt = new Date().toISOString(); await ensureDb();
  if (S.base && !String(id).startsWith('local-')) await S.base[kind].doc(id).set(data);
  else { S.logs[kind] = S.logs[kind].map(x => x.id === id ? {id, ...data} : x); renderAll(); }
}
S.goals = {}; S.macroAlt = false; S.open = {};
const COACHES = ['Tanner Newman', 'Charlie Keane', 'Dillon Johnson'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const mealOf = f => f.meal || (!f.time ? 'Snacks' : f.time < '11:00' && f.time >= '04:00' ? 'Breakfast' : f.time < '16:00' && f.time >= '11:00' ? 'Lunch' : f.time < '21:00' && f.time >= '16:00' ? 'Dinner' : 'Snacks');
const MCOL = {carbs: '#4FD1C5', fat: '#A97CF8', protein: '#F6B04D', upper: '#7D9BFF', lower: '#8FE0C6', core: '#F6B04D'};
const REGION = {chest: 'upper', shoulders: 'upper', traps: 'upper', upperback: 'upper', lats: 'upper', biceps: 'upper', triceps: 'upper', forearms: 'upper', abdominals: 'core', obliques: 'core', lowerback: 'core', hipflexors: 'core', glutes: 'lower', abductors: 'lower', adductors: 'lower', quads: 'lower', hamstrings: 'lower', calves: 'lower'};
const ICON = {
  Breakfast: '<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M4 21h14"/>',
  Lunch: '<path d="M4 11a8 5 0 0 1 16 0z"/><path d="M3.5 14h17"/><path d="M4 17h16a0 0 0 0 1 0 0 3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/>',
  Dinner: '<path d="M3 12h18a9 7 0 0 1-18 0z"/><path d="M8 8c0-2 2-2 2-4M12 8c0-2 2-2 2-4"/>',
  Snacks: '<path d="M12 7c-3-2-8-1-8 5 0 5 3 9 5 9 1 0 2-.6 3-.6s2 .6 3 .6c2 0 5-4 5-9 0-6-5-7-8-5z"/><path d="M12 7c0-2 1-3 3-4"/>',
  strength: '<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>',
  cardio: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  sport: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>',
  night: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  source: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'
};
const svgIcon = k => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DOTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></g></svg>';
const SWAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14l-3-3M20 16H6l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function donut(segs, center, sub){
  const tot = segs.reduce((a, s) => a + s.v, 0), R = 52, C = 2 * Math.PI * R; let off = 0;
  const arcs = tot > 0 ? segs.filter(s => s.v > 0).map(s => { const len = C * s.v / tot, gap = segs.filter(x => x.v > 0).length > 1 ? 3 : 0; const a = `<circle cx="66" cy="66" r="${R}" fill="none" stroke="${s.c}" stroke-width="11" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 66 66)" stroke-linecap="butt"/>`; off += len; return a; }).join('') : '';
  const wrap = el('div'); wrap.innerHTML = `<svg viewBox="0 0 132 132" role="img"><circle cx="66" cy="66" r="${R}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="11"/>${arcs}<text x="66" y="68" text-anchor="middle" font-size="28" font-weight="700" fill="#fff" font-family="Figtree,system-ui,sans-serif"></text><text x="66" y="88" text-anchor="middle" font-size="13" fill="rgba(235,240,247,.7)" font-family="Figtree,system-ui,sans-serif"></text></svg>`;
  const t = wrap.querySelectorAll('text'); t[0].textContent = center; t[1].textContent = sub; wrap.querySelector('svg').setAttribute('aria-label', center + ' ' + sub);
  return wrap;
}
function mcol(pctTxt, val, name, color){ const d = el('div', 'mcol'); const p = el('span', 'p', pctTxt); p.style.color = color; d.append(p, el('span', 'g', val), el('span', 'n', name)); return d; }
function pbar(frac, color){ const b = el('div', 'pbar'); const i = el('i'); i.style.width = clamp(frac || 0, 0, 1) * 100 + '%'; i.style.background = color; b.appendChild(i); return b; }
const fmtG = v => v == null ? '—' : (Math.round(v * 10) / 10).toString().replace(/\.0$/, '');

// ---------- week strip ----------
const hasEntries = d => S.tab === 'food' ? (foodOn(d).length > 0 || !!(appleDay(d) && appleDay(d).food)) : S.tab === 'workout' ? workOn(d).length > 0 : S.logs.sleep.some(s => s.date === d);
function weekOf(d){ const dt = pD(d), dow = dt.getUTCDay(); return Array.from({length: 7}, (_, i) => addDays(d, i - dow)); }
function renderWeek(){
  const wk = weekOf(S.sel), box = $('weekDays'); box.replaceChildren();
  $('logDateLabel').textContent = S.sel === TODAY ? 'Today' : fmtDay(S.sel);
  wk.forEach(d => {
    const b = el('button', 'dayb'); b.type = 'button';
    if (d === TODAY) b.classList.add('today'); if (d === S.sel) b.classList.add('sel'); if (hasEntries(d)) b.classList.add('done');
    b.disabled = !DAYS.includes(d);
    b.innerHTML = `<span class="dot"></span><span class="l">${'SMTWTFS'[pD(d).getUTCDay()]}</span><span class="c">${CHECK}</span>`;
    b.setAttribute('aria-label', fmtDay(d) + (hasEntries(d) ? ', has entries' : '') + (d === S.sel ? ', selected' : ''));
    b.onclick = () => { S.sel = d; renderAll(); };
    box.appendChild(b);
  });
  $('wkNext').disabled = !DAYS.includes(addDays(wk[6], 1)); $('wkPrev').disabled = !DAYS.includes(addDays(wk[0], -1));
  $('wkToday').disabled = S.sel === TODAY;
}
$('wkPrev').onclick = () => { const t = addDays(S.sel, -7); S.sel = DAYS.includes(t) ? t : DAYS[0]; renderAll(); };
$('wkNext').onclick = () => { const t = addDays(S.sel, 7); S.sel = DAYS.includes(t) ? t : DAYS[DAYS.length - 1]; renderAll(); };
$('wkToday').onclick = () => { S.sel = DAYS[DAYS.length - 1]; renderAll(); };
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
  S.tab = b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(x => { const on = x === b; x.setAttribute('aria-selected', String(on)); x.setAttribute('aria-pressed', String(on)); });
  renderLog();
}));

// ---------- diary rows ----------
function diaryRow(key, iconKey, name, summary, sub, items, onLog, logLabel){
  const r = el('div', 'drow'); r.insertAdjacentHTML('beforeend', svgIcon(iconKey));
  const mid = el('div'); mid.append(el('div', 'nm', name)); if (summary) mid.append(el('div', 'sm', summary)); if (sub) mid.append(el('div', 'sm2', sub));
  r.appendChild(mid);
  const dots = el('button', 'dots'); dots.type = 'button'; dots.innerHTML = DOTS; dots.setAttribute('aria-label', 'Show ' + name + ' entries'); dots.setAttribute('aria-expanded', String(!!S.open[key]));
  dots.disabled = !items.length; if (!items.length) dots.style.visibility = 'hidden';
  dots.onclick = () => { S.open[key] = !S.open[key]; renderLog(); };
  r.appendChild(dots);
  if (onLog) { const lp = el('button', 'logpill', logLabel || 'Log'); lp.type = 'button'; lp.setAttribute('aria-label', (logLabel || 'Log') + ' ' + name.toLowerCase()); lp.onclick = onLog; r.appendChild(lp); } else r.appendChild(el('span'));
  if (S.open[key] && items.length) { const list = el('div', 'items'); items.forEach(it => list.appendChild(it)); r.appendChild(list); }
  return r;
}
function itemBtn(left, right, onClick){
  const b = el(onClick ? 'button' : 'div', 'item' + (onClick ? '' : ' ro')); if (onClick) { b.type = 'button'; b.onclick = onClick; }
  b.append(el('span', null, left), el('span', null, right)); return b;
}

// ---------- food view ----------
function renderFood(v){
  const d = S.sel, t = foodTotals(d), g = S.goals;
  const c1 = el('div', 'sumcard'); const big = el('div', 'big'); const lb = el('b'); lb.append(document.createTextNode((t.kcal != null ? Math.round(t.kcal).toLocaleString() : 0) + ' cal'));
  if (g.kcal) { const of = el('span', 'of', ' / ' + g.kcal.toLocaleString()); lb.appendChild(of); }
  big.append(lb, el('span', 'left', g.kcal ? Math.max(0, Math.round(g.kcal - (t.kcal || 0))).toLocaleString() + (t.kcal > g.kcal ? ' over' : ' left') : 'No calorie goal set'));
  if (g.kcal && t.kcal > g.kcal) big.lastChild.textContent = Math.round(t.kcal - g.kcal).toLocaleString() + ' over';
  c1.append(el('span', 'lab', 'Calories'), big, pbar(g.kcal ? (t.kcal || 0) / g.kcal : 0, 'var(--deep)'));
  const c2 = el('div', 'sumcard'); const sw = el('button', 'swap'); sw.type = 'button'; sw.innerHTML = SWAP; sw.setAttribute('aria-label', S.macroAlt ? 'Show carbs, fat and protein' : 'Show fiber, sodium and water'); sw.onclick = () => { S.macroAlt = !S.macroAlt; renderLog(); };
  const tri = el('div', 'tri');
  const set = S.macroAlt ? [['fiber', 'Fiber', 'g', '#8FE0C6'], ['sodium', 'Sodium', 'mg', '#F59384'], ['water', 'Water', 'ml', '#7D9BFF']] : [['carbs', 'Carbs', 'g', MCOL.carbs], ['fat', 'Fat', 'g', MCOL.fat], ['protein', 'Protein', 'g', MCOL.protein]];
  set.forEach(([k, name, u, col]) => { const x = el('div', 't'); const vv = el('div', 'v'); vv.append(document.createTextNode((t[k] != null ? Math.round(t[k]).toLocaleString() : 0) + ' ' + u)); if (g[k]) vv.appendChild(el('span', null, ' / ' + g[k].toLocaleString())); x.append(el('span', 'n', name), vv, pbar(g[k] ? (t[k] || 0) / g[k] : 0, col)); tri.appendChild(x); });
  c2.append(sw, tri);
  const dh = el('div', 'diaryhead'); const sg = el('button', 'linkbtn', Object.values(g).some(Boolean) ? 'Edit goals' : 'Set goals'); sg.type = 'button'; sg.onclick = () => openSheet('goals');
  dh.append(el('h3', null, 'Diary'), sg);
  v.append(c1, c2, dh);
  MEALS.forEach(m => {
    const f = foodOn(d).filter(x => mealOf(x) === m).sort((a, b) => (a.time < b.time ? -1 : 1));
    const kc = f.reduce((a, x) => a + (Number(x.kcal) || 0), 0);
    const summary = f.length ? (f[0].name || 'Food') + (f.length > 1 ? ' and ' + (f.length - 1) + ' more' : '') : null;
    v.appendChild(diaryRow('food-' + m, m, m, summary, f.length ? Math.round(kc).toLocaleString() + ' cal' : null,
      f.map(x => itemBtn((x.name || 'Food') + (x.servings && x.servings !== 1 ? ' × ' + fmtG(x.servings) : ''), (x.kcal != null ? Math.round(x.kcal) + ' cal · ' : '') + clock(hhmmToH(x.time)), () => openSheet('food', x))),
      () => openSheet('food', null, {meal: m})));
  });
  const a = appleDay(d);
  if (a && a.food) { const fd = a.food; v.appendChild(diaryRow('food-apple', 'source', 'From Apple Health', [fd.kcal != null ? Math.round(fd.kcal).toLocaleString() + ' cal' : null, fd.protein != null ? Math.round(fd.protein) + ' g protein' : null].filter(Boolean).join(' · '), [fd.water != null ? Math.round(fd.water) + ' ml water' : null, fd.caffeine ? Math.round(fd.caffeine) + ' mg caffeine' : null, fd.alcohol ? fd.alcohol + ' drinks' : null].filter(Boolean).join(' · ') || null, [], null)); }
}

// ---------- workout view ----------
function stimSplit(ws){
  const reg = {upper: 0, lower: 0, core: 0};
  ws.forEach(w => {
    if (w.kind === 'strength' && (w.entries || []).length) w.entries.forEach(x => { const st = setStim(x); Object.entries(SHARE[x.ex] || SHARE.even).forEach(([m, wt]) => reg[REGION[m]] += wt * st); });
    else if (w.minutes && w.effort) { const L = sessLoad(w) / 60, sh = w.kind === 'cardio' ? SHARE.cardio : SHARE.even; Object.entries(sh).forEach(([m, wt]) => reg[REGION[m]] += wt * L); }
  });
  return reg;
}
function renderWorkout(v){
  const d = S.sel, ws = workOn(d), load = ws.reduce((a, w) => a + sessLoad(w), 0), mins = ws.reduce((a, w) => a + (Number(w.minutes) || 0), 0);
  const prev = []; for (let i = 1; i <= 7; i++) prev.push(workOn(addDays(d, -i)).reduce((a, w) => a + sessLoad(w), 0));
  const avg7 = prev.reduce((a, b) => a + b, 0) / 7;
  const c1 = el('div', 'sumcard'), big = el('div', 'big'), lb = el('b'); lb.append(document.createTextNode(Math.round(load).toLocaleString())); if (avg7 > 0) lb.appendChild(el('span', 'of', ' / ' + Math.round(avg7).toLocaleString() + ' daily avg'));
  big.append(lb, el('span', 'left', mins ? mins + ' min' : 'No sessions yet'));
  c1.append(el('span', 'lab', 'Training load'), big, pbar(load / Math.max(1, avg7 * 1.5, load), 'var(--rhr)'));
  const reg = stimSplit(ws), tot = reg.upper + reg.lower + reg.core;
  const c2 = el('div', 'sumcard'), tri = el('div', 'tri');
  [['upper', 'Upper body'], ['lower', 'Lower body'], ['core', 'Core & back']].forEach(([k, name]) => { const x = el('div', 't'), vv = el('div', 'v', tot ? Math.round(100 * reg[k] / tot) + '%' : '—'); x.append(el('span', 'n', name), vv, pbar(tot ? reg[k] / tot : 0, MCOL[k])); tri.appendChild(x); });
  c2.appendChild(tri);
  const dh = el('div', 'diaryhead'); dh.append(el('h3', null, 'Sessions'), el('span', 'muted', 'Session load = minutes × effort'));
  v.append(c1, c2, dh);
  [['strength', 'Strength', ['strength']], ['cardio', 'Cardio', ['cardio']], ['sport', 'Sport & other', ['sport', 'other']]].forEach(([key, name, kinds]) => {
    const list = ws.filter(w => kinds.includes(w.kind));
    const first = list[0];
    const exNames = first && (first.entries || []).length ? EXNAME[first.entries[0].ex] + (first.entries.length > 1 ? ' and ' + (first.entries.length - 1) + ' more' : '') : null;
    const summary = first ? (first.name || exNames || KIND[first.kind]) + (first.coach ? ' · with ' + first.coach : '') + (list.length > 1 ? ' · +' + (list.length - 1) + ' more' : '') : null;
    const sub = list.length ? [list.reduce((a, w) => a + (Number(w.minutes) || 0), 0) + ' min', exNames && first.name ? exNames : null, 'load ' + Math.round(list.reduce((a, w) => a + sessLoad(w), 0))].filter(Boolean).join(' · ') : null;
    const items = list.map(w => {
      const right = (w.minutes ? w.minutes + ' min' : '') + (w.source === 'apple' ? ' · Apple Health' : w.coach ? ' · ' + w.coach : '');
      const it = itemBtn((w.name || KIND[w.kind]) + ((w.entries || []).length ? ' · ' + w.entries.map(e => EXNAME[e.ex]).join(', ') : ''), right, w.source === 'apple' ? null : () => openSheet('workout', w));
      const vids = (w.entries || []).filter(e => e.videoId); if (!vids.length) return it;
      const wrap = el('div'); wrap.style.cssText = 'display:grid;gap:6px;width:100%'; wrap.appendChild(it);
      vids.forEach(e => { const vd = document.createElement('video'); vd.controls = true; vd.playsInline = true; vd.preload = 'none'; setVideoSrc(vd, e.videoId); vd.setAttribute('aria-label', EXNAME[e.ex] + ' video'); wrap.appendChild(vd); });
      return wrap;
    });
    v.appendChild(diaryRow('w-' + key, key === 'sport' ? 'sport' : key, name, summary, sub, items, () => openSheet('workout', null, {kind: kinds[0]})));
  });
}

// ---------- sleep view ----------
function nightData(d){
  const r = BYDATE[d], a = appleDay(d) && appleDay(d).sleep, sl = sleepOn(d);
  if (r && r.asleep) return {src: 'WHOOP', asleep: r.asleep, need: r.need, deep: r.deep, rem: r.rem, light: r.light, bed: r.bed};
  if (a && a.asleep) return {src: 'Apple Health', asleep: a.asleep, need: avg(WD.slice(-30), 'need') || 480, deep: a.deep, rem: a.rem, light: a.core, bed: a.bed};
  if (sl && sl.bed && sl.wake) { let b = hhmmToH(sl.bed), w = hhmmToH(sl.wake); if (w < 12 && w < b) w += 24; let mins = (w - b) * 60; if (mins < 0) mins += 1440; return {src: 'Your log', asleep: mins, need: avg(WD.slice(-30), 'need') || 480, bed: b}; }
  return null;
}
const typical = k => avg(WD.slice(-30), k);
function renderSleep(v){
  const d = S.sel, n = nightData(d), sl = sleepOn(d);
  const c1 = el('div', 'sumcard'), big = el('div', 'big'), lb = el('b');
  lb.append(document.createTextNode(n ? hm(n.asleep) : '—')); if (n && n.need) lb.appendChild(el('span', 'of', ' / ' + hm(n.need)));
  big.append(lb, el('span', 'left', !n ? 'No sleep recorded' : n.need && n.asleep < n.need ? hm(n.need - n.asleep) + ' short' : 'Need met'));
  c1.append(el('span', 'lab', 'Sleep' + (n ? ' · ' + n.src : '')), big, pbar(n && n.need ? n.asleep / n.need : 0, 'var(--deep)'));
  const c2 = el('div', 'sumcard'), tri = el('div', 'tri');
  [['deep', 'Deep', 'var(--deep)'], ['rem', 'REM', 'var(--rem)'], ['light', 'Light', 'rgba(255,255,255,.55)']].forEach(([k, name, col]) => {
    const val = n && n[k] != null ? n[k] : null, ty = typical(k), x = el('div', 't'), vv = el('div', 'v');
    vv.append(document.createTextNode(val != null ? hm(val) : '—')); if (ty) vv.appendChild(el('span', null, ' / ' + hm(ty)));
    x.append(el('span', 'n', name), vv, pbar(val != null && ty ? val / ty : 0, col)); tri.appendChild(x);
  });
  c2.appendChild(tri);
  const dh = el('div', 'diaryhead'); dh.append(el('h3', null, 'Night'), el('span', 'muted', 'Stage targets are your 30-day typical'));
  v.append(c1, c2, dh);
  const summary = sl ? (sl.rested ? 'Felt ' + ['', 'exhausted', 'tired', 'OK', 'good', 'great'][sl.rested] + ' (' + sl.rested + '/5)' : 'Logged') : null;
  const sub = sl ? [(sl.tags || []).map(t => TAGNAME[t] || t).join(', '), sl.bed ? 'bed ' + clock(hhmmToH(sl.bed)) : null, sl.note].filter(Boolean).join(' · ') || null : null;
  v.appendChild(diaryRow('s-night', 'night', 'How you slept', summary, sub, [], () => openSheet('sleep', sl), sl ? 'Edit' : 'Log'));
  if (n && n.src !== 'Your log') v.appendChild(diaryRow('s-src', 'source', 'From ' + n.src, hm(n.asleep) + ' asleep' + (n.bed != null ? ' · fell asleep ' + clock(n.bed) : ''), n.deep != null ? 'Deep ' + hm(n.deep) + ' · REM ' + hm(n.rem || 0) : null, [], null));
}

function renderLog(){
  renderWeek();
  const v = $('logView'); v.replaceChildren();
  if (S.tab === 'food') renderFood(v); else if (S.tab === 'workout') renderWorkout(v); else renderSleep(v);
}

// ---------- entry sheet ----------
let lastFocus = null;
function openSheet(kind, entry, preset){
  S.sheet = {kind, id: entry ? entry.id : null, item: entry || null};
  lastFocus = document.activeElement;
  document.querySelectorAll('[data-sheet]').forEach(f => f.hidden = f.dataset.sheet !== kind);
  $('sheetTitle').textContent = kind === 'goals' ? 'Daily goals' : (entry ? 'Edit ' : 'Add ') + ({food: 'food', workout: 'workout', sleep: 'sleep'})[kind];
  if (kind === 'food') fillFood(entry, preset || {});
  if (kind === 'workout') fillWorkout(entry, preset || {});
  if (kind === 'sleep') fillSleep(entry);
  if (kind === 'goals') ['kcal', 'carbs', 'fat', 'protein', 'fiber', 'sodium', 'water'].forEach(k => $('g-' + k).value = S.goals[k] || '');
  ['f-msg', 'w-msg', 's-msg', 'g-msg'].forEach(id => $(id).textContent = '');
  $('sheet').hidden = false; document.body.classList.add('sheet-open');
  const first = document.querySelector('[data-sheet="' + kind + '"] input, [data-sheet="' + kind + '"] select');
  setTimeout(() => { if (!$('sheet').contains(document.activeElement)) (first || $('sheetSave')).focus(); }, 30);
}
function closeSheet(){
  $('sheet').hidden = true; document.body.classList.remove('sheet-open'); S.sheet = null;
  if (S.vid) { $('x-file').value = ''; setVideo(null); }
  if (lastFocus && lastFocus.isConnected) lastFocus.focus();
}
document.querySelectorAll('#sheet [data-close]').forEach(b => b.addEventListener('click', closeSheet));
$('sheetSave').onclick = () => { const f = document.querySelector('[data-sheet]:not([hidden])'); if (f) f.requestSubmit(); };
document.addEventListener('keydown', e => {
  if ($('sheet').hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
  if (e.key === 'Tab') { const focusables = [...$('sheet').querySelectorAll('button:not([disabled]), input, select, textarea, video, summary')].filter(x => x.offsetParent !== null); if (!focusables.length) return; const a = focusables[0], z = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
});
function armDelete(btn, label, action){
  let armed = false;
  btn.onclick = async () => { if (!armed) { armed = true; btn.textContent = 'Tap again to delete'; setTimeout(() => { armed = false; btn.textContent = label; }, 3000); return; } btn.disabled = true; try { await action(); closeSheet(); } catch (e) { btn.textContent = 'Couldn’t delete'; } btn.disabled = false; };
}

// food sheet
const FOODF = ['kcal', 'carbs', 'fat', 'protein', 'fiber', 'sodium', 'water'];
function fillFood(x, preset){
  const base = x ? (x.base || Object.fromEntries(FOODF.map(k => [k, x[k] != null && x.servings ? x[k] / x.servings : x[k]]))) : {};
  $('f-name').value = x ? x.name || '' : ''; $('f-serving').value = x ? x.serving || '' : ''; $('f-servings').value = x ? (x.servings || 1) : 1;
  $('f-meal').value = x ? mealOf(x) : preset.meal || 'Breakfast'; $('f-date').value = x ? x.date : (DAYS.includes(S.sel) ? S.sel : TODAY);
  const defTime = {Breakfast: '08:30', Lunch: '12:30', Dinner: '19:00', Snacks: '15:30'};
  $('f-time').value = x ? x.time || '12:30' : defTime[$('f-meal').value];
  FOODF.forEach(k => $('f-' + k).value = base[k] != null ? Math.round(base[k] * 10) / 10 : '');
  $('f-alcohol').value = x ? x.alcohol || 0 : 0; $('f-caffeine').checked = !!(x && x.caffeine); $('f-dairy').checked = !!(x && x.dairy);
  $('f-del').hidden = !x; if (x) armDelete($('f-del'), 'Delete', () => delLog('food', x.id));
  syncFood();
}
function foodPreview(){
  const sv = Math.max(0, num('f-servings') || 0), g = k => (num('f-' + k) || 0) * sv;
  return {kcal: g('kcal'), carbs: g('carbs'), fat: g('fat'), protein: g('protein')};
}
function syncFood(){
  const p = foodPreview(), cc = p.carbs * 4, fc = p.fat * 9, pc = p.protein * 4, tot = cc + fc + pc;
  const box = $('f-donut'); box.replaceChildren();
  box.append(donut([{v: cc, c: MCOL.carbs}, {v: fc, c: MCOL.fat}, {v: pc, c: MCOL.protein}], Math.round(p.kcal || tot).toLocaleString(), 'cal'),
    mcol(tot ? Math.round(100 * cc / tot) + '%' : '—', fmtG(p.carbs) + ' g', 'Carbs', MCOL.carbs),
    mcol(tot ? Math.round(100 * fc / tot) + '%' : '—', fmtG(p.fat) + ' g', 'Fat', MCOL.fat),
    mcol(tot ? Math.round(100 * pc / tot) + '%' : '—', fmtG(p.protein) + ' g', 'Protein', MCOL.protein));
  const gb = $('f-goalbars'); gb.replaceChildren();
  const anyGoal = ['kcal', 'carbs', 'fat', 'protein'].some(k => S.goals[k]);
  gb.closest('.goalsec').hidden = !anyGoal;
  [['kcal', 'Calories', 'var(--deep)'], ['carbs', 'Carbs', MCOL.carbs], ['fat', 'Fat', MCOL.fat], ['protein', 'Protein', MCOL.protein]].forEach(([k, name, col]) => {
    const gv = S.goals[k], c = el('div', 'gb'); c.append(pbar(gv ? p[k] / gv : 0, col), el('span', 'p', gv ? Math.round(100 * p[k] / gv) + '%' : '—'), el('span', 'n', name)); gb.appendChild(c);
  });
  $('f-save').disabled = !($('f-date').value && $('f-time').value && ($('f-name').value.trim() || num('f-kcal') != null || num('f-water') != null || num('f-alcohol') > 0 || $('f-caffeine').checked));
}
document.querySelectorAll('#p-food input, #p-food select').forEach(i => i.addEventListener('input', syncFood));
$('f-meal').addEventListener('change', () => { if (!S.sheet || S.sheet.id) return; $('f-time').value = {Breakfast: '08:30', Lunch: '12:30', Dinner: '19:00', Snacks: '15:30'}[$('f-meal').value]; });
$('p-food').addEventListener('submit', async e => {
  e.preventDefault(); syncFood(); if ($('f-save').disabled) return;
  const sv = Math.max(0.25, num('f-servings') || 1), base = Object.fromEntries(FOODF.map(k => [k, num('f-' + k)]));
  const data = {date: $('f-date').value, time: $('f-time').value, meal: $('f-meal').value, name: $('f-name').value.trim(), serving: $('f-serving').value.trim(), servings: sv, base,
    alcohol: num('f-alcohol') || 0, caffeine: $('f-caffeine').checked, dairy: $('f-dairy').checked};
  FOODF.forEach(k => data[k] = base[k] == null ? null : Math.round(base[k] * sv * 10) / 10);
  $('f-save').disabled = true;
  try {
    if (S.sheet && S.sheet.id) await updLog('food', S.sheet.id, data); else await addLog('food', data);
    S.sel = DAYS.includes(data.date) ? data.date : S.sel; closeSheet(); renderAll(); flash('logMsg', 'Saved ' + (data.name || 'food') + ' to ' + data.meal.toLowerCase() + '.');
  } catch (err) { flash('f-msg', saveErr(err), true); $('f-save').disabled = false; }
});

// workout sheet
function fillWorkout(w, preset){
  $('w-name').value = w ? w.name || '' : ''; $('w-coach').value = w ? w.coach || '' : (S.lastCoach || '');
  $('w-time').value = w ? w.time || '' : ''; $('w-cal').checked = false; setTimeout(syncCalRow);
  $('w-kind').value = w ? w.kind : preset.kind || 'strength'; $('w-date').value = w ? w.date : (DAYS.includes(S.sel) ? S.sel : TODAY);
  $('w-min').value = w && w.minutes ? w.minutes : ''; $('w-effort').value = w && w.effort ? w.effort : '';
  S.draft = w ? (w.entries || []).map(x => ({...x})) : [];
  $('x-load').value = ''; $('x-reps').value = ''; $('x-sets').value = 1; $('x-file').value = ''; setVideo(null);
  $('w-del').hidden = !w; if (w) armDelete($('w-del'), 'Delete', () => delLog('workouts', w.id));
  renderDraft(); syncWorkoutUI();
}
function syncWorkoutUI(){
  const k = $('w-kind').value; $('w-strength').hidden = k !== 'strength';
  const ok = $('w-date').value && (k === 'strength' ? S.draft.length > 0 : (num('w-min') > 0));
  $('w-save').disabled = !ok || S.saving;
  const load = num('x-load'), reps = num('x-reps'), rpe = Number($('x-rpe').value);
  $('x-add').disabled = !(load != null && load >= 0 && reps > 0);
  $('x-e1rm').textContent = load > 0 && reps > 0 ? 'Estimated 1RM ' + (Math.round(e1rm(load, reps, rpe) * 2) / 2) + ' kg (' + (10 - rpe) + ' reps in reserve).' : 'Enter load and reps to see an estimated 1RM.';
  const w = {kind: k, minutes: num('w-min'), effort: num('w-effort'), entries: k === 'strength' ? S.draft : []};
  const reg = stimSplit([w]), tot = reg.upper + reg.lower + reg.core, sl = sessLoad(w);
  const box = $('w-donut'); box.replaceChildren();
  box.append(donut([{v: reg.upper, c: MCOL.upper}, {v: reg.lower, c: MCOL.lower}, {v: reg.core, c: MCOL.core}], sl ? Math.round(sl).toLocaleString() : '—', 'session load'),
    mcol(tot ? Math.round(100 * reg.upper / tot) + '%' : '—', 'Upper', 'body', MCOL.upper),
    mcol(tot ? Math.round(100 * reg.lower / tot) + '%' : '—', 'Lower', 'body', MCOL.lower),
    mcol(tot ? Math.round(100 * reg.core / tot) + '%' : '—', 'Core', '& back', MCOL.core));
}
document.querySelectorAll('#p-workout input, #p-workout select').forEach(i => i.addEventListener('input', syncWorkoutUI));
let vidURL = null;
function setVideo(file){
  if (vidURL) { URL.revokeObjectURL(vidURL); vidURL = null; }
  S.vid = file || null; S.marks = [];
  const box = $('vidbox'); box.replaceChildren(); $('marks').hidden = !file;
  if (file) {
    vidURL = URL.createObjectURL(file);
    const v = document.createElement('video'); v.controls = true; v.playsInline = true; v.preload = 'metadata'; v.src = vidURL; v.setAttribute('aria-label', 'Set video');
    v.addEventListener('error', () => { box.replaceChildren(el('p', 'note', 'This browser couldn’t preview that video. It will still be saved with the exercise if it’s under 20 MB.')); });
    box.appendChild(v);
  }
  renderReps();
}
$('x-file').addEventListener('change', e => setVideo(e.target.files[0]));
const drop = $('drop');
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('video/')) setVideo(f); });
const vt = () => { const v = document.querySelector('#vidbox video'); return v ? v.currentTime : 0; };
$('m-start').onclick = () => { const l = S.marks[S.marks.length - 1]; if (l && l.end == null) l.start = vt(); else S.marks.push({start: vt(), end: null}); renderReps(); };
$('m-end').onclick = () => { const l = S.marks[S.marks.length - 1]; if (l && l.end == null && vt() > l.start) { l.end = vt(); renderReps(); } };
$('m-undo').onclick = () => { const l = S.marks[S.marks.length - 1]; if (!l) return; if (l.end != null) l.end = null; else S.marks.pop(); renderReps(); };
$('m-clear').onclick = () => { $('x-file').value = ''; setVideo(null); };
const repLoss = marks => { const t = marks.filter(m => m.end != null).map(m => m.end - m.start).filter(x => x > 0); return t.length < 2 ? null : 1 - t[0] / t[t.length - 1]; };
const rpeFromLoss = l => l < .1 ? '7 or lower' : l < .2 ? 'about 8' : l < .3 ? 'about 9' : '9.5 to 10';
function renderReps(){
  const out = $('repout'); out.replaceChildren(); if (!S.vid) return;
  const done = S.marks.filter(m => m.end != null), open = S.marks.length && S.marks[S.marks.length - 1].end == null;
  if (!done.length) { out.appendChild(el('p', 'note', open ? 'Rep start marked. Tap Lockout when the bar reaches the top.' : 'Play the video. For each rep, tap Rep start at the bottom and Lockout at the top.')); return; }
  const times = done.map(m => m.end - m.start), mx = Math.max(...times), reps = el('div', 'reps');
  times.forEach((t, i) => { const b = el('i'); const loss = 1 - times[0] / t; b.style.height = (18 + 82 * t / mx) + '%'; b.style.background = loss >= .3 ? 'var(--bad)' : loss >= .2 ? 'var(--warn)' : 'var(--ok)'; b.title = 'Rep ' + (i + 1) + ': ' + t.toFixed(2) + ' s'; reps.appendChild(b); });
  out.appendChild(reps);
  const L = repLoss(S.marks);
  out.appendChild(el('p', 'muted', L == null ? 'Rep 1 took ' + times[0].toFixed(2) + ' s. Mark one more rep to measure slowdown.' : 'Lifting time went from ' + times[0].toFixed(2) + ' s to ' + times[times.length - 1].toFixed(2) + ' s, a ' + Math.round(Math.max(0, L) * 100) + '% speed loss. That usually means RPE ' + rpeFromLoss(Math.max(0, L)) + '; you entered ' + $('x-rpe').value + '.'));
}
$('x-add').onclick = () => {
  const x = {ex: $('x-ex').value, load: num('x-load') || 0, reps: num('x-reps'), rpe: Number($('x-rpe').value), sets: Math.max(1, num('x-sets') || 1)};
  const L = repLoss(S.marks); x.loss = L == null ? null : Math.max(0, Math.round(L * 1000) / 1000);
  x.file = S.vid; S.draft.push(x);
  $('x-load').value = ''; $('x-reps').value = ''; $('x-sets').value = 1; $('x-file').value = ''; setVideo(null);
  renderDraft(); syncWorkoutUI();
};
function renderDraft(){
  const d = $('draft'); d.replaceChildren();
  if (!S.draft.length) { d.appendChild(el('p', 'note', 'No exercises yet. Add them below.')); return; }
  S.draft.forEach((x, i) => {
    const row = el('div', 'draftrow');
    row.append(el('span', null, EXNAME[x.ex] + ' ' + x.load + ' kg × ' + x.reps + (x.sets > 1 ? ' × ' + x.sets : '') + ' @ RPE ' + x.rpe + (x.file || x.videoId ? ' · video' : '') + (x.loss != null ? ' · ' + Math.round(x.loss * 100) + '% slowdown' : '')));
    const b = el('button', 'ghost', 'Remove'); b.type = 'button'; b.onclick = () => { S.draft.splice(i, 1); renderDraft(); syncWorkoutUI(); };
    row.appendChild(b); d.appendChild(row);
  });
}
$('p-workout').addEventListener('submit', async e => {
  e.preventDefault(); syncWorkoutUI(); if ($('w-save').disabled) return;
  S.saving = true; syncWorkoutUI(); await ensureDb();
  const kind = $('w-kind').value;
  const prevItem = S.sheet && S.sheet.item;
  const data = {date: $('w-date').value, time: $('w-time').value || null, kind, name: $('w-name').value.trim(), coach: $('w-coach').value || null, minutes: num('w-min'), effort: num('w-effort'), entries: [], calAdded: !!(prevItem && prevItem.calAdded)};
  let videoNote = '';
  if (kind === 'strength') {
    for (const x of S.draft) {
      const entry = {ex: x.ex, load: x.load, reps: x.reps, rpe: x.rpe, sets: x.sets, loss: x.loss == null ? null : x.loss};
      if (x.videoId) entry.videoId = x.videoId;
      if (x.file) {
        if (!S.assets) videoNote = ' Videos can’t be stored in this view, so they were left out.';
        else if (x.file.size > 20 * 1024 * 1024) videoNote = ' One video was over 20 MB and was left out; trim it and add it again.';
        else { try { flash('w-msg', 'Uploading video…'); const up = await S.assets.upload(x.file); entry.videoId = up.id; } catch (err) { videoNote = ' A video couldn’t be uploaded (' + (err && err.code === 'quota_exceeded' ? 'storage is full' : 'upload failed') + ').'; } }
      }
      data.entries.push(entry);
    }
  }
  let calNote = '';
  if (calLive() && $('w-cal').checked && !data.calAdded) {
    /* the session goes on the calendar at its start time, or 6 pm when none was given */
    const [hh, mm] = (data.time || '18:00').split(':').map(Number), st = dayStartMs(data.date) + (hh * 60 + mm) * 60000, len = (data.minutes || 60) * 60000;
    const what = data.entries.length ? data.entries.map(x => EXNAME[x.ex]).join(', ') : '';
    try { flash('w-msg', 'Adding to Google Calendar…'); await calCreate((data.name || KIND[kind]) + ' · Training', st, st + len, [data.coach ? 'Coach: ' + data.coach : '', what, 'Logged in Recovery Dashboard.'].filter(Boolean).join('\n')); data.calAdded = true; calNote = ' Added to Google Calendar' + (data.time ? '' : ' at 6 pm') + '.'; }
    catch (err) { calNote = ' Not added to Google Calendar: ' + calWriteErr(err); }
  }
  try {
    if (S.sheet && S.sheet.id) await updLog('workouts', S.sheet.id, data); else await addLog('workouts', data);
    S.lastCoach = data.coach || ''; S.sel = DAYS.includes(data.date) ? data.date : S.sel; S.saving = false;
    closeSheet(); renderAll(); flash('logMsg', 'Saved ' + (data.name || KIND[kind].toLowerCase()) + (data.coach ? ' with ' + data.coach : '') + '.' + videoNote + calNote, !!videoNote || calNote.startsWith(' Not'));
  } catch (err) { flash('w-msg', saveErr(err), true); }
  S.saving = false; syncWorkoutUI();
});

// sleep sheet
function fillSleep(x){
  $('s-date').value = x ? x.date : (DAYS.includes(S.sel) ? S.sel : TODAY);
  $('s-bed').value = x ? x.bed || '' : ''; $('s-wake').value = x ? x.wake || '' : ''; $('s-note').value = x ? x.note || '' : '';
  S.rested = x ? x.rested || null : null;
  document.querySelectorAll('.rested button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.r) === S.rested)));
  document.querySelectorAll('#s-tags input').forEach(i => i.checked = !!(x && (x.tags || []).includes(i.value)));
  $('s-del').hidden = !x; if (x) armDelete($('s-del'), 'Delete', () => delLog('sleep', x.id));
  syncSleep();
}
document.querySelectorAll('.rested button').forEach(b => b.addEventListener('click', () => {
  S.rested = Number(b.dataset.r); document.querySelectorAll('.rested button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); syncSleep();
}));
function syncSleep(){
  const d = $('s-date').value, n = d ? nightData(d) : null;
  let asleep = n ? n.asleep : null, src = n ? n.src : null;
  if ($('s-bed').value && $('s-wake').value && (!n || n.src === 'Your log')) { let b = hhmmToH($('s-bed').value), w = hhmmToH($('s-wake').value); let mins = (w - b) * 60; if (mins < 0) mins += 1440; asleep = mins; src = 'from your times'; }
  const box = $('s-donut'); box.replaceChildren();
  const deep = n && n.deep || 0, rem = n && n.rem || 0, light = n && n.light || 0, tot = deep + rem + light;
  box.append(donut([{v: deep, c: css('--deep')}, {v: rem, c: css('--rem')}, {v: light, c: 'rgba(255,255,255,.55)'}].map(s => tot ? s : {v: 0, c: s.c}).concat(tot ? [] : [{v: asleep ? 1 : 0, c: css('--deep')}]), asleep ? (asleep / 60).toFixed(1) : '—', asleep ? 'hours · ' + (src || '') : 'hours asleep'),
    mcol(tot ? Math.round(100 * deep / tot) + '%' : '—', deep ? hm(deep) : '—', 'Deep', css('--deep')),
    mcol(tot ? Math.round(100 * rem / tot) + '%' : '—', rem ? hm(rem) : '—', 'REM', css('--rem')),
    mcol(tot ? Math.round(100 * light / tot) + '%' : '—', light ? hm(light) : '—', 'Light', 'rgba(255,255,255,.75)'));
  $('s-save').disabled = !(d && (S.rested || $('s-bed').value || document.querySelector('#s-tags input:checked') || $('s-note').value.trim()));
}
document.querySelectorAll('#p-sleep input, #p-sleep textarea').forEach(i => i.addEventListener('input', syncSleep));
$('p-sleep').addEventListener('submit', async e => {
  e.preventDefault(); syncSleep(); if ($('s-save').disabled) return;
  const data = {date: $('s-date').value, rested: S.rested, bed: $('s-bed').value || null, wake: $('s-wake').value || null,
    tags: [...document.querySelectorAll('#s-tags input:checked')].map(i => i.value), note: $('s-note').value.trim()};
  $('s-save').disabled = true;
  try {
    const existing = (S.sheet && S.sheet.id) || (S.logs.sleep.find(s => s.date === data.date) || {}).id;
    if (existing) await updLog('sleep', existing, data); else await addLog('sleep', data);
    S.sel = DAYS.includes(data.date) ? data.date : S.sel; closeSheet(); renderAll(); flash('logMsg', 'Saved your sleep for ' + fmtShort(data.date) + '.');
  } catch (err) { flash('s-msg', saveErr(err), true); syncSleep(); }
});

// goals sheet
$('p-goals').addEventListener('submit', e => {
  e.preventDefault();
  S.goals = Object.fromEntries(['kcal', 'carbs', 'fat', 'protein', 'fiber', 'sodium', 'water'].map(k => [k, num('g-' + k) || null]).filter(([, v]) => v));
  savePrefs(); closeSheet(); renderLog();
});

// ---------- charts ----------
function windowDays(){ const w = S.range ? WD.slice(-S.range) : WD; return w; }
function tip(box){ let t = box.querySelector('.tt'); if (!t) { t = el('div', 'tt'); t.hidden = true; box.appendChild(t); } return t; }
function showTip(box, t, lines, x, y){ t.replaceChildren(...lines.map(([s, c]) => el('div', c || null, s))); t.hidden = false; const W = box.clientWidth, w = t.offsetWidth; t.style.left = clamp(x - w / 2, 0, Math.max(0, W - w)) + 'px'; t.style.top = Math.max(0, y - t.offsetHeight - 10) + 'px'; }
function gridY(svg, y, vals, L, R, f){ vals.forEach(v => { svg.append('line').attr('x1', L).attr('x2', R).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', 'rgba(255,255,255,.08)'); svg.append('text').attr('x', L - 6).attr('y', y(v) + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'rgba(235,240,247,.6)').text(f ? f(v) : v); }); }
function axisX(svg, x, H, rows){ rows.forEach((r, i) => { if (S.range === 30 ? i % 7 === 0 : r.date.endsWith('-01')) svg.append('text').attr('x', x(r.date) + x.bandwidth() / 2).attr('y', H + 16).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', 'rgba(235,240,247,.6)').text(S.range === 30 ? fmtShort(r.date) : pD(r.date).toLocaleDateString('en-US', {month: 'short', timeZone: 'UTC'})); }); }
function chartRec(){
  const box = $('c-rec'), rows = windowDays(); box.replaceChildren();
  const W = box.clientWidth || 600, H = 160, L = 30, T = 6;
  const x = d3.scaleBand(rows.map(r => r.date), [L, W - 4]).padding(rows.length > 60 ? .2 : .3), y = d3.scaleLinear([0, 100], [T + H, T]);
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H + T + 22}`);
  gridY(svg, y, [0, 34, 67, 100], L, W - 4);
  const t = tip(box);
  svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', r => x(r.date)).attr('width', x.bandwidth()).attr('y', r => y(r.recovery)).attr('height', r => y(0) - y(r.recovery))
    .attr('rx', Math.min(3, x.bandwidth() / 2)).attr('fill', r => zoneColor(r.recovery)).attr('opacity', r => r.date === S.sel ? 1 : .55).attr('stroke', r => r.date === S.sel ? '#fff' : 'none').attr('stroke-width', 1.5).style('cursor', 'pointer')
    .on('click', (e, r) => { S.sel = r.date; renderAll(); window.scrollTo({top: 0, behavior: 'smooth'}); })
    .on('mousemove', (e, r) => { const b = box.getBoundingClientRect(); showTip(box, t, [[fmtDay(r.date), 'd'], ['Recovery ' + r.recovery + '%']], e.clientX - b.left, y(r.recovery) * b.width / W); })
    .on('mouseleave', () => t.hidden = true);
  axisX(svg, x, T + H, rows);
}
function chartLine(id, k, color, unit){
  const box = $(id), rows = windowDays(), base = k + '30'; box.replaceChildren();
  const W = box.clientWidth || 400, H = 120, L = 30, T = 8;
  const vals = rows.flatMap(r => [r[k], r[base]]).filter(v => v != null);
  const y = d3.scaleLinear([d3.min(vals) - 3, d3.max(vals) + 3], [T + H, T]).nice(), x = d3.scaleBand(rows.map(r => r.date), [L, W - 6]), cx = r => x(r.date) + x.bandwidth() / 2;
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H + T + 22}`);
  gridY(svg, y, y.ticks(3), L, W - 6);
  const gid = 'g' + id; svg.append('defs').html(`<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">${[[0, .3], [.25, .18], [.5, .09], [.75, .03], [1, 0]].map(([o, a]) => `<stop offset="${o}" style="stop-color:${color};stop-opacity:${a}"/>`).join('')}</linearGradient>`);
  const pts = rows.filter(r => r[k] != null);
  svg.append('path').attr('d', d3.area().x(cx).y0(T + H).y1(r => y(r[k]))(pts)).attr('fill', `url(#${gid})`);
  svg.append('path').attr('d', d3.line().x(cx).y(r => y(r[base])).defined(r => r[base] != null)(rows)).attr('fill', 'none').attr('stroke', 'rgba(255,255,255,.5)').attr('stroke-width', 1.5).attr('stroke-dasharray', '4 4');
  svg.append('path').attr('d', d3.line().x(cx).y(r => y(r[k]))(pts)).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
  const cur = rows.find(r => r.date === S.sel);
  if (cur && cur[k] != null) { svg.append('line').attr('x1', cx(cur)).attr('x2', cx(cur)).attr('y1', T).attr('y2', T + H).attr('stroke', 'rgba(255,255,255,.3)').attr('stroke-dasharray', '2 3'); svg.append('circle').attr('cx', cx(cur)).attr('cy', y(cur[k])).attr('r', 4.5).attr('fill', color).attr('stroke', '#12151C').attr('stroke-width', 2); }
  const t = tip(box), at = e => { const b = box.getBoundingClientRect(); return rows[clamp(Math.floor(((e.clientX - b.left) * W / b.width - L) / x.step()), 0, rows.length - 1)]; };
  svg.append('rect').attr('x', L).attr('y', T).attr('width', W - L - 6).attr('height', H).attr('fill', 'transparent').style('cursor', 'pointer')
    .on('mousemove', e => { const r = at(e), b = box.getBoundingClientRect(); showTip(box, t, [[fmtDay(r.date), 'd'], [(r[k] ?? '—') + unit], [r[base] != null ? '30-day avg ' + Math.round(r[base]) + unit : '', 'd']], cx(r) * b.width / W, (r[k] != null ? y(r[k]) : T) * b.width / W); })
    .on('mouseleave', () => t.hidden = true).on('click', e => { S.sel = at(e).date; renderAll(); });
  axisX(svg, x, T + H, rows);
}
function chartSleep(){
  const box = $('c-sleep'), rows = windowDays(); box.replaceChildren();
  const W = box.clientWidth || 600, H = 160, L = 30, T = 6;
  const y = d3.scaleLinear([0, Math.ceil(Math.max(10, d3.max(rows, r => Math.max(r.asleep || 0, r.need || 0)) / 60))], [T + H, T]);
  const x = d3.scaleBand(rows.map(r => r.date), [L, W - 4]).padding(rows.length > 60 ? .2 : .3);
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H + T + 22}`);
  gridY(svg, y, y.ticks(4), L, W - 4, v => v + 'h');
  const keys = [['deep', css('--deep')], ['rem', css('--rem')], ['light', 'rgba(255,255,255,.22)']], t = tip(box);
  rows.forEach(r => {
    let acc = 0; const g = svg.append('g').style('cursor', 'pointer').attr('opacity', r.date === S.sel ? 1 : .85);
    keys.forEach(([k, c]) => { const v = (r[k] || 0) / 60; g.append('rect').attr('x', x(r.date)).attr('width', x.bandwidth()).attr('y', y(acc + v)).attr('height', Math.max(0, y(acc) - y(acc + v))).attr('fill', c); acc += v; });
    if (r.need) g.append('line').attr('x1', x(r.date) - 1).attr('x2', x(r.date) + x.bandwidth() + 1).attr('y1', y(r.need / 60)).attr('y2', y(r.need / 60)).attr('stroke', '#fff').attr('stroke-width', 1.5);
    if (r.date === S.sel) g.append('rect').attr('x', x(r.date) - 1.5).attr('width', x.bandwidth() + 3).attr('y', y(acc) - 1.5).attr('height', y(0) - y(acc) + 3).attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', 1.5);
    g.on('click', () => { S.sel = r.date; renderAll(); })
     .on('mousemove', e => { const b = box.getBoundingClientRect(); showTip(box, t, [[fmtDay(r.date), 'd'], ['Deep ' + hm(r.deep || 0)], ['REM ' + hm(r.rem || 0)], ['Light ' + hm(r.light || 0)], ['Needed ' + (r.need ? hm(r.need) : '—'), 'd']], e.clientX - b.left, y(acc) * b.width / W); })
     .on('mouseleave', () => t.hidden = true);
  });
  axisX(svg, x, T + H, rows);
}
let chartTimer = null;
function scheduleCharts(){ clearTimeout(chartTimer); chartTimer = setTimeout(renderCharts, 120); }
function renderCharts(){ renderStressBars(); chartRec(); chartLine('c-hrv', 'hrv', css('--hrv'), ' ms'); chartLine('c-rhr', 'rhr', css('--rhr'), ' bpm'); chartSleep(); }
document.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', () => { S.range = Number(b.dataset.range); document.querySelectorAll('[data-range]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderCharts(); }));

// ---------- patterns ----------
function hbars(id, buckets){
  const box = $(id); box.replaceChildren();
  const W = box.clientWidth || 400, rowH = 34, lab = 116, right = 120, x = d3.scaleLinear([0, 100], [lab, W - right]);
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${buckets.length * rowH + 8}`);
  const worst = d3.min(buckets.filter(b => b.v != null), b => b.v);
  buckets.forEach((b, i) => { const yy = 4 + i * rowH;
    svg.append('text').attr('x', 0).attr('y', yy + 20).attr('font-size', 13).attr('fill', '#fff').text(b.label);
    svg.append('rect').attr('x', lab).attr('y', yy + 9).attr('width', x(100) - lab).attr('height', 14).attr('rx', 7).attr('fill', 'rgba(255,255,255,.1)');
    if (b.v != null) svg.append('rect').attr('x', lab).attr('y', yy + 9).attr('width', Math.max(4, x(b.v) - lab)).attr('height', 14).attr('rx', 7).attr('fill', b.v === worst ? css('--bad') : css('--ok'));
    svg.append('text').attr('x', W - right + 8).attr('y', yy + 20).attr('font-size', 13).attr('font-weight', 600).attr('fill', '#fff').text(b.v == null ? '—' : Math.round(b.v) + '%');
    svg.append('text').attr('x', W).attr('y', yy + 20).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'rgba(235,240,247,.6)').text(b.n + ' nights');
  });
}
function renderPatterns(){
  const p = $('patLede'); p.replaceChildren();
  const parts = ['Across ', [INS.n + ''], ' mornings, recovery averaged ', [pct(INS.lateRec)], ' after a 2 am or later bedtime and ', [pct(INS.earlyRec)], ' when you were asleep before 1 am. Under 6 hours of sleep it averaged ', [pct(INS.shortRec)], ', against ', [pct(INS.okRec)], ' for 7 hours or more. After a day with Strain over 14 it averaged ', [pct(INS.hardRec)], '.'];
  parts.forEach(x => p.append(Array.isArray(x) ? el('b', null, x[0]) : document.createTextNode(x)));
  const bk = (f, defs) => defs.map(([label, a, b]) => { const g = WD.filter(r => f(r) != null && f(r) >= a && f(r) < b); return {label, v: mean(g), n: g.length}; });
  hbars('h-bed', bk(r => r.bed, [['Before midnight', -99, 0], ['12–1 am', 0, 1], ['1–2 am', 1, 2], ['2 am or later', 2, 99]]));
  hbars('h-len', bk(r => r.asleep, [['Under 6 h', 0, 360], ['6–7 h', 360, 420], ['7–8 h', 420, 480], ['8 h or more', 480, 9999]]));
}

// ---------- layout ----------
const TILES = [...document.querySelectorAll('#board > .tile')].map(t => t.dataset.tile);
const DEFAULT = {order: TILES.slice(), span: {rec: 2, sleep: 1, strain: 1, stress: 1, brain: 3, why: 4, plan: 4, muscles: 4, log: 4, daylog: 4, trends: 4, patterns: 4}, hidden: []};
const MINSPAN = {rec: 1, sleep: 1, strain: 1, stress: 1};
const minSpan = id => MINSPAN[id] || 2;
function normLayout(l){
  const out = JSON.parse(JSON.stringify(DEFAULT));
  if (l && Array.isArray(l.order)) { const known = l.order.filter(id => TILES.includes(id)); out.order = known.concat(TILES.filter(id => !known.includes(id))); }
  if (l && l.span) TILES.forEach(id => { const v = Number(l.span[id]); if (v >= 1 && v <= 4) out.span[id] = Math.max(minSpan(id), Math.round(v)); });
  if (l && Array.isArray(l.hidden)) out.hidden = l.hidden.filter(id => TILES.includes(id));
  return out;
}
S.layout = normLayout(null);
const cols = () => window.matchMedia('(max-width: 760px)').matches ? 2 : 4;
const effSpan = id => Math.min(cols(), S.layout.span[id] || 4);
const tileEl = id => document.querySelector('#board > .tile[data-tile="' + id + '"]');
function applyLayout(){
  const board = $('board');
  S.layout.order.forEach(id => { const t = tileEl(id); if (t) board.appendChild(t); });
  const r = BYDATE[S.sel], whyNA = !r || r.recovery >= 67;
  TILES.forEach(id => {
    const t = tileEl(id); if (!t) return;
    t.style.gridColumn = 'span ' + effSpan(id);
    t.hidden = S.layout.hidden.includes(id) || (id === 'why' && whyNA && !S.editing);
    const badge = t.querySelector('.spanbadge'); if (badge) badge.textContent = effSpan(id) + ' of ' + cols() + ' columns';
  });
  const hl = $('hiddenList'); hl.replaceChildren();
  S.layout.hidden.forEach(id => { const b = el('button', 'pill', 'Show ' + tileEl(id).dataset.name); b.type = 'button'; b.onclick = () => { S.layout.hidden = S.layout.hidden.filter(x => x !== id); layoutChanged(id); }; hl.appendChild(b); });
  $('hiddenLabel').textContent = S.layout.hidden.length ? 'Hidden tiles:' : 'No hidden tiles.';
}
function layoutChanged(id){
  applyLayout();
  if (!id || ['rec', 'sleep', 'strain', 'stress'].includes(id)) renderWidgets();
  scheduleCharts(); renderPatternsSoon(); savePrefs();
}
const GRIP = '<svg viewBox="0 0 12 12" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="2" r="1.2"/><circle cx="9" cy="2" r="1.2"/><circle cx="3" cy="6" r="1.2"/><circle cx="9" cy="6" r="1.2"/><circle cx="3" cy="10" r="1.2"/><circle cx="9" cy="10" r="1.2"/></g></svg>';
TILES.forEach(id => {
  const t = tileEl(id), name = t.dataset.name;
  const chrome = el('div', 'tchrome');
  const grip = el('button', 'grip'); grip.type = 'button'; grip.innerHTML = GRIP + '<span>Move</span>'; grip.setAttribute('aria-label', 'Move ' + name + '. Use arrow keys to move earlier or later.');
  const hide = el('button', null, 'Hide'); hide.type = 'button'; hide.setAttribute('aria-label', 'Hide ' + name);
  hide.onclick = () => { if (!S.layout.hidden.includes(id)) S.layout.hidden.push(id); layoutChanged(id); };
  chrome.append(grip, hide);
  const rsz = el('div', 'rsz'); rsz.tabIndex = 0; rsz.setAttribute('role', 'slider'); rsz.setAttribute('aria-label', 'Width of ' + name);
  const badge = el('span', 'spanbadge');
  t.append(chrome, rsz, badge);

  // drag to reorder: the tile lifts off the grid and floats under the pointer as live liquid glass,
  // bending whatever it passes over, while a placeholder shows where it will land
  let drag = null;
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // spring-driven warp: the pane stretches along its motion, squashes when it lands,
  // and its contents ripple through a displacement filter for the whole drag
  const warpFilter = () => {
    let f = document.getElementById('lg-warp'); if (f) return f;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML = '<filter id="lg-warp" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.0045 0.006" numOctaves="1" seed="7" result="n"/><feGaussianBlur in="n" stdDeviation="6" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.appendChild(svg); return document.getElementById('lg-warp');
  };
  const W = {p: [0, 0], v: [0, 0], run: false, t: null, k: 1, tilt: 0};
  // only the glass layer warps; the tile's text and controls stay crisp and still
  const gfxOf = () => t.classList.contains('glass') ? [...t.querySelectorAll(':scope > .gfx')] : [...t.querySelectorAll('.gfx')];
  const setGfx = (tf, origin, filter) => gfxOf().forEach(g => { g.style.transform = tf; g.style.transformOrigin = origin; if (filter !== undefined) g.style.filter = filter; });
  const boostAll = (k, blur) => { if (window.LG) gfxOf().forEach(g => LG.boost(g.parentElement, k, blur)); };
  const warpTick = now => {
    const st = W; if (!st.run) return;
    if (st.mode === 'resize') {
      // widening: the pane stretches toward the pointer like liquid, snaps and jiggles at each column
      const dt = Math.min(0.033, Math.max(0.004, (now - (st.last || now - 16)) / 1000)); st.last = now;
      const w = t.offsetWidth || 1, tgt = rs ? clamp((rs.want - w) / w, -0.28, 0.28) : 0;
      const acc = -190 * (st.p[0] - tgt) - 13 * st.v[0]; st.v[0] += acc * dt; st.p[0] += st.v[0] * dt;
      const p = st.p[0];
      setGfx(RM ? '' : `scale(${(1 + p).toFixed(4)}, ${(1 - p * 0.16).toFixed(4)})`, 'left center');
      const f = warpFilter(), ts = now / 1000;
      f.firstChild.setAttribute('baseFrequency', (0.0045 + 0.0012 * Math.sin(ts * 2.1)).toFixed(4) + ' ' + (0.006 + 0.0012 * Math.cos(ts * 1.7)).toFixed(4));
      f.lastChild.setAttribute('scale', RM ? 0 : Math.min(22, (rs ? 3 : 0) + Math.abs(st.v[0]) * 10 + Math.abs(p) * 50).toFixed(1));
      st.k += ((rs ? 1.35 : 1) + Math.abs(p) * 3 - st.k) * 0.25;
      boostAll(st.k, rs ? 3 : (st.k > 1.05 ? 4 : null));
      if (!rs && Math.abs(p) < 0.002 && Math.abs(st.v[0]) < 0.01 && st.k < 1.02) { st.run = false; st.mode = 'drag'; st.p = [0, 0]; st.v = [0, 0]; setGfx('', '', ''); boostAll(1, null); return; }
      requestAnimationFrame(warpTick); return;
    }
    const d = drag, vx = d ? d.vx : 0, vy = d ? d.vy : 0;
    const tx = clamp(vx * 0.009, -0.16, 0.16), ty = clamp(vy * 0.009, -0.16, 0.16);
    const dt = Math.min(0.033, Math.max(0.004, (now - (st.last || now - 16)) / 1000)); st.last = now;
    for (let i = 0; i < 2; i++) { const tgt = i ? ty : tx; const acc = -170 * (st.p[i] - tgt) - 14 * st.v[i]; st.v[i] += acc * dt; st.p[i] += st.v[i] * dt; }
    const m = Math.min(0.3, Math.hypot(st.p[0], st.p[1])), ang = Math.atan2(st.p[1], st.p[0]) * 180 / Math.PI;
    st.tilt = 0;
    // the whole card tilts in 3D into the direction it is dragged, like a held card, and levels out when it stops
    const dtr = Math.min(0.1, Math.max(0.004, (now - (st.lastR || now - 16)) / 1000)); st.lastR = now;
    const tRy = d && !RM ? clamp(vx * 1.1, -16, 16) : 0, tRx = d && !RM ? clamp(-vy * 0.9, -12, 12) : 0, al = 1 - Math.exp(-dtr * 10);
    st.ry = (st.ry || 0) + (tRy - (st.ry || 0)) * al; st.rx = (st.rx || 0) + (tRx - (st.rx || 0)) * al;
    const tilting = Math.abs(st.rx) + Math.abs(st.ry) > 0.03;
    t.style.transform = tilting || d ? `perspective(900px) rotateX(${st.rx.toFixed(2)}deg) rotateY(${st.ry.toFixed(2)}deg)` : '';
    if (t.classList.contains('w')) { t.style.setProperty('--px', (st.ry * 0.35).toFixed(2) + 'px'); t.style.setProperty('--py', (-st.rx * 0.35).toFixed(2) + 'px'); t.style.setProperty('--sx', (-st.ry * 1.2).toFixed(1)); t.style.setProperty('--sy', (st.rx * 1.2).toFixed(1)); }
    const gl = t.querySelector(':scope > .glare');
    if (gl) { gl.style.setProperty('--gx', (50 + st.ry * 3).toFixed(1) + '%'); gl.style.setProperty('--gy', (45 - st.rx * 3).toFixed(1) + '%'); gl.style.opacity = d ? Math.min(1, 0.35 + (Math.abs(st.rx) + Math.abs(st.ry)) / 10).toFixed(3) : Math.min(1, (Math.abs(st.rx) + Math.abs(st.ry)) / 8).toFixed(3); }
    if (d) { d.vx *= 0.82; d.vy *= 0.82; t.style.left = d.tx + 'px'; t.style.top = d.ty + 'px'; }
    const lift = d ? 1.035 : 1;
    setGfx(RM ? (d ? 'scale(1.02)' : '') : `rotate(${ang.toFixed(1)}deg) scale(${(1 + m).toFixed(4)}, ${(1 / (1 + m)).toFixed(4)}) rotate(${(-ang).toFixed(1)}deg) scale(${lift})`, 'center');
    const speed = Math.min(40, Math.abs(vx) + Math.abs(vy));
    const f = warpFilter(), turb = f.firstChild, disp = f.lastChild, ts = now / 1000;
    turb.setAttribute('baseFrequency', (0.0045 + 0.0012 * Math.sin(ts * 2.1)).toFixed(4) + ' ' + (0.006 + 0.0012 * Math.cos(ts * 1.7)).toFixed(4));
    disp.setAttribute('scale', RM ? 0 : Math.min(22, d ? 4 + speed * 0.4 + m * 45 : m * 60).toFixed(1));
    const target = d ? 1.55 + Math.min(0.7, speed * 0.035) + m * 2 : 1; st.k += (target - st.k) * 0.25;
    boostAll(st.k, d ? 2 : (st.k > 1.05 ? 3 : null));
    if (!d && Math.hypot(st.p[0], st.p[1]) < 0.002 && Math.hypot(st.v[0], st.v[1]) < 0.01 && st.k < 1.02 && Math.abs(st.rx) + Math.abs(st.ry) < 0.05) { st.run = false; st.rx = st.ry = 0; setGfx('', '', ''); boostAll(1, null); t.style.transform = ''; ['--px', '--py', '--sx', '--sy'].forEach(p => t.style.removeProperty(p)); if (gl) gl.style.opacity = 0; return; }
    requestAnimationFrame(warpTick);
  };
  const startWarp = (impulse) => { W.v[0] += impulse[0]; W.v[1] += impulse[1]; if (!W.run) { W.run = true; W.last = 0; W.lastR = 0; warpFilter(); gfxOf().forEach(g => g.style.filter = RM ? '' : 'url(#lg-warp)'); requestAnimationFrame(warpTick); } };
  const onMove = e => {
    if (!drag) return;
    drag.vx = e.clientX - drag.px; drag.vy = e.clientY - drag.py; drag.px = e.clientX; drag.py = e.clientY;
    drag.tx = e.clientX - drag.ox; drag.ty = e.clientY - drag.oy;
    if (e.clientY < 70) window.scrollBy(0, -14); else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
    const under = document.elementsFromPoint(e.clientX, e.clientY).map(n => n.closest && n.closest('#board > .tile')).find(n => n && n !== t && n !== drag.ph);
    if (!under) return;
    const r = under.getBoundingClientRect(), pr = drag.ph.getBoundingClientRect(), sameRow = Math.abs(r.top - pr.top) < 20;
    const before = sameRow ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
    const ref = before ? under : under.nextElementSibling;
    if (ref !== drag.ph && drag.ph.nextElementSibling !== ref) $('board').insertBefore(drag.ph, ref);
  };
  const endDrag = () => {
    if (!drag) return; const d = drag; drag = null;
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', endDrag); window.removeEventListener('pointercancel', endDrag);
    grip.style.cursor = '';
    const pr = d.ph.getBoundingClientRect();
    t.classList.add('settling'); t.style.left = pr.left + 'px'; t.style.top = pr.top + 'px';
    startWarp([0, 2.6]); // squash on landing, then jiggle back
    setTimeout(() => {
      t.classList.remove('lifted', 'settling'); ['position', 'left', 'top', 'width', 'height', 'zIndex'].forEach(p => t.style[p] = '');
      $('board').insertBefore(t, d.ph); d.ph.remove();
      S.layout.order = [...document.querySelectorAll('#board > .tile')].map(n => n.dataset.tile).filter(Boolean); layoutChanged();
    }, 270);
  };
  const startDrag = (x, y) => {
    if (drag) return;
    t.style.transform = ''; t.style.removeProperty('--px'); t.style.removeProperty('--py');
    const r = t.getBoundingClientRect();
    const ph = el('div', 'tile ph'); ph.style.gridColumn = t.style.gridColumn; ph.style.height = r.height + 'px'; ph.setAttribute('aria-hidden', 'true');
    $('board').insertBefore(ph, t);
    drag = {id, ph, ox: x - r.left, oy: y - r.top, tx: r.left, ty: r.top, px: x, py: y, vx: 0, vy: 0};
    Object.assign(t.style, {position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: 40});
    t.classList.add('lifted'); grip.style.cursor = 'grabbing';
    W.mode = 'drag';
    startWarp([0, -2.2]); // a wobble every time it is picked up
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);
  };
  grip.addEventListener('pointerdown', e => { if (!S.editing) return; e.preventDefault(); startDrag(e.clientX, e.clientY); });
  {
    // press and hold any tile to pick it up; that also turns on arranging for every tile.
    // While arranging, a tile drags straight away from anywhere on it.
    let hold = null, suppressClick = false;
    const INTERACTIVE = 'button,a,input,select,textarea,label,video,summary,.rsz,.tchrome,.mus,.chart,.dayb,.drow,.item,#h-bed,#h-len,.causes,.sheet';
    if (['rec', 'sleep', 'strain', 'stress'].includes(id)) t.title = 'Press and hold to move';
    t.addEventListener('pointerdown', e => {
      if (drag || (e.button && e.button !== 0) || e.target.closest('.rsz,.tchrome')) return;
      const sx = e.clientX, sy = e.clientY; let lx = sx, ly = sy;
      if (S.editing) {
        e.preventDefault();
        const mv = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) { done(); startDrag(sx, sy); onMove(ev); } };
        const done = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', done); window.removeEventListener('pointercancel', done); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', done); window.addEventListener('pointercancel', done);
        return;
      }
      if (e.target.closest(INTERACTIVE) && !e.target.closest('.gauge')) return;
      const off = () => { window.removeEventListener('pointermove', cancel); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointercancel', cancel); $('board').classList.remove('holding'); };
      const cancel = ev => { if (!hold) return; if (ev.type === 'pointermove') { lx = ev.clientX; ly = ev.clientY; if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return; } clearTimeout(hold); hold = null; off(); };
      $('board').classList.add('holding');
      hold = setTimeout(() => { hold = null; off(); suppressClick = true; setEditing(true); startDrag(lx, ly); if (navigator.vibrate) navigator.vibrate(12); }, 380);
      window.addEventListener('pointermove', cancel); window.addEventListener('pointerup', cancel); window.addEventListener('pointercancel', cancel);
    });
    t.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, {passive: false});
    t.addEventListener('contextmenu', e => { if (drag || hold) e.preventDefault(); });
    t.addEventListener('click', e => { if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); } }, true);
  }
  grip.addEventListener('keydown', e => {
    const k = e.key, o = S.layout.order, i = o.indexOf(id);
    let j = null; if (k === 'ArrowLeft' || k === 'ArrowUp') j = i - 1; if (k === 'ArrowRight' || k === 'ArrowDown') j = i + 1;
    if (j == null || j < 0 || j >= o.length) return; e.preventDefault();
    o.splice(i, 1); o.splice(j, 0, id); layoutChanged(); grip.focus();
  });

  // drag the right edge to resize
  let rs = null;
  rsz.addEventListener('pointerdown', e => {
    if (!S.editing) return; e.preventDefault(); 
    const bw = $('board').clientWidth, gap = 18, c = cols();
    rs = {x: e.clientX, span: effSpan(id), colW: (bw - gap * (c - 1)) / c + gap, w0: t.offsetWidth, want: t.offsetWidth}; t.classList.add('resizing');
    W.mode = 'resize'; startWarp([0.8, 0]);
    // window listeners: re-ordering tiles in the DOM would drop pointer capture mid-resize
    window.addEventListener('pointermove', rsMove); window.addEventListener('pointerup', endRs); window.addEventListener('pointercancel', endRs);
  });
  const rsMove = e => {
    if (!rs) return;
    rs.want = rs.w0 + (e.clientX - rs.x);
    const n = clamp(Math.round(rs.span + (e.clientX - rs.x) / rs.colW), Math.min(minSpan(id), cols()), cols());
    if (n !== effSpan(id)) { S.layout.span[id] = n; applyLayout(); if (['rec', 'sleep', 'strain', 'stress'].includes(id)) renderWidgets(); }
  };
  const endRs = () => { if (!rs) return; rs = null; window.removeEventListener('pointermove', rsMove); window.removeEventListener('pointerup', endRs); window.removeEventListener('pointercancel', endRs); t.classList.remove('resizing'); layoutChanged(id); };
  rsz.addEventListener('keydown', e => {
    let d = 0; if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -1; if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = 1; if (!d) return;
    e.preventDefault(); const before = effSpan(id); S.layout.span[id] = clamp(before + d, Math.min(minSpan(id), cols()), cols()); layoutChanged(id);
    if (effSpan(id) !== before) { W.mode = 'resize'; startWarp([-d * 1.6, 0]); }
  });
});
function setEditing(on){
  S.editing = on; $('board').classList.toggle('editing', on); $('editbar').hidden = !on;
  $('edit').setAttribute('aria-pressed', String(on)); $('edit').textContent = on ? 'Done arranging' : 'Arrange tiles';
  applyLayout(); renderWhy();
}
$('edit').onclick = () => setEditing(!S.editing);
$('doneEdit').onclick = () => setEditing(false);
$('resetLayout').onclick = () => { S.layout = normLayout(null); layoutChanged(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.editing) setEditing(false); });
// tap empty space to stop arranging
document.addEventListener('pointerdown', e => { if (S.editing && !e.target.closest('#board > .tile, #editbar, #edit, .sheet')) setEditing(false); });
let lastCols = cols();
window.addEventListener('resize', () => { if (cols() !== lastCols) { lastCols = cols(); applyLayout(); renderWidgets(); } });
let patTimer = null;
function renderPatternsSoon(){ clearTimeout(patTimer); patTimer = setTimeout(renderPatterns, 150); }


// ---------- hover tilt with glare (score widgets) ----------
(function(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  ['rec', 'sleep', 'strain', 'stress'].forEach(id => {
    const t = tileEl(id); if (!t) return;
    const glare = el('div', 'glare'); glare.setAttribute('aria-hidden', 'true'); t.appendChild(glare);
    const st = {x: 0, y: 0, tx: 0, ty: 0, gx: 50, gy: 30, on: false, raf: 0, rect: null};
    const reset = () => { t.style.transform = ''; ['--px', '--py', '--sx', '--sy'].forEach(p => t.style.removeProperty(p)); glare.style.opacity = 0; };
    const tick = () => {
      st.raf = 0;
      if (t.classList.contains('lifted') || t.classList.contains('settling')) { st.x = st.y = 0; return; } // the drag owns the tilt
      if (S.editing || $('board').classList.contains('holding')) { st.x = st.y = 0; reset(); return; }
      const now = performance.now(), dt = Math.min(0.05, (now - (st.last || now - 16)) / 1000); st.last = now; const al = 1 - Math.exp(-dt * 9);
      st.x += (st.tx - st.x) * al; st.y += (st.ty - st.y) * al;
      const m = Math.hypot(st.x, st.y), lift = st.on ? 1.025 : 1 + 0.025 * Math.min(1, m * 2);
      t.style.transform = `perspective(1000px) rotateX(${(-st.y * 7).toFixed(2)}deg) rotateY(${(st.x * 9).toFixed(2)}deg) scale(${lift.toFixed(4)})`;
      t.style.setProperty('--sx', (-st.x * 16).toFixed(1)); t.style.setProperty('--sy', (-st.y * 12).toFixed(1));
      t.style.setProperty('--px', (st.x * 6).toFixed(2) + 'px'); t.style.setProperty('--py', (st.y * 5).toFixed(2) + 'px');
      glare.style.setProperty('--gx', st.gx.toFixed(1) + '%'); glare.style.setProperty('--gy', st.gy.toFixed(1) + '%');
      glare.style.opacity = (st.on ? 0.6 + 0.4 * Math.min(1, m) : Math.min(1, m * 1.6)).toFixed(3);
      if (Math.abs(st.tx - st.x) > 0.0015 || Math.abs(st.ty - st.y) > 0.0015) st.raf = requestAnimationFrame(tick);
      else if (!st.on) reset();
    };
    const kick = () => { if (!st.raf) { st.last = 0; st.raf = requestAnimationFrame(tick); } };
    t.addEventListener('pointerenter', e => { if (e.pointerType === 'touch') return; st.on = true; t.style.transform = ''; st.rect = t.getBoundingClientRect(); kick(); });
    t.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch' || !st.on) return;
      const r = st.rect || t.getBoundingClientRect(), fx = clamp((e.clientX - r.left) / r.width, 0, 1), fy = clamp((e.clientY - r.top) / r.height, 0, 1);
      st.tx = fx * 2 - 1; st.ty = fy * 2 - 1; st.gx = fx * 100; st.gy = fy * 100; kick();
    });
    t.addEventListener('pointerleave', () => { st.on = false; st.tx = st.ty = 0; kick(); });
    window.addEventListener('scroll', () => { if (st.on) { const tf = t.style.transform; t.style.transform = ''; st.rect = t.getBoundingClientRect(); t.style.transform = tf; } }, {passive: true});
  });
})();

// ---------- connections ----------
const nOf = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
function parseCSV(text){
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.replace(/^\uFEFF/, '').trim());
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? '' : r[i]])));
}
function whoopFromFiles(files){
  const find = re => { const k = Object.keys(files).find(n => re.test(n)); return k ? parseCSV(files[k]) : null; };
  const cyc = find(/physiological_cycles\.csv$/i);
  if (!cyc) throw new Error('No physiological_cycles.csv found. Upload the WHOOP ZIP or that file.');
  const wk = find(/workouts\.csv$/i) || [], jr = find(/journal_entries\.csv$/i) || [];
  const KEEP = {'Have any alcoholic drinks?': 'alcohol', 'Consumed caffeine?': 'caffeine', 'Ate food close to bedtime?': 'lateMeal', 'Consumed dairy?': 'dairy'};
  const J = {}; jr.forEach(r => { const k = KEEP[r['Question text']]; if (k) (J[r['Cycle start time']] = J[r['Cycle start time']] || {})[k] = String(r['Answered yes']).toLowerCase() === 'true'; });
  const n = v => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
  const hour = x => { if (!x || x.length < 16) return null; const h = Number(x.slice(11, 13)) + Number(x.slice(14, 16)) / 60; return Math.round((h >= 12 ? h - 24 : h) * 1000) / 1000; };
  const byDate = {};
  cyc.filter(r => r['Recovery score %'] !== '' && r['Wake onset']).forEach(r => { const j = J[r['Cycle start time']] || {};
    byDate[r['Wake onset'].slice(0, 10)] = {date: r['Wake onset'].slice(0, 10), recovery: n(r['Recovery score %']), rhr: n(r['Resting heart rate (bpm)']), hrv: n(r['Heart rate variability (ms)']), temp: n(r['Skin temp (celsius)']), resp: n(r['Respiratory rate (rpm)']), strain: n(r['Day Strain']), sleepPerf: n(r['Sleep performance %']), asleep: n(r['Asleep duration (min)']), light: n(r['Light sleep duration (min)']), deep: n(r['Deep (SWS) duration (min)']), rem: n(r['REM duration (min)']), awake: n(r['Awake duration (min)']), need: n(r['Sleep need (min)']), debt: n(r['Sleep debt (min)']), eff: n(r['Sleep efficiency %']), bed: hour(r['Sleep onset']), alcohol: j.alcohol ?? null, caffeine: j.caffeine ?? null, lateMeal: j.lateMeal ?? null, dairy: j.dairy ?? null}; });
  const rows = Object.values(byDate).sort((a, b) => a.date < b.date ? -1 : 1);
  if (!rows.length) throw new Error('That file has no recovery rows.');
  const sessions = wk.filter(w => /powerlifting|weightlifting|strength|functional fitness/i.test(w['Activity name'] || '') && w['Workout start time']).map(w => ({date: w['Workout start time'].slice(0, 10), strain: n(w['Activity Strain']) || 0, minutes: n(w['Duration (min)']) || 0}));
  return {rows, sessions, from: rows[0].date, to: rows[rows.length - 1].date, at: new Date().toISOString()};
}
async function readWhoopInput(fileList){
  const files = {};
  for (const f of fileList) {
    if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
      if (!window.JSZip) throw new Error('The ZIP reader didn\u2019t load. Unzip the export and upload the CSV files instead.');
      const zip = await JSZip.loadAsync(f);
      for (const name of Object.keys(zip.files)) if (/\.csv$/i.test(name)) files[name] = await zip.files[name].async('string');
    } else if (/\.csv$/i.test(f.name)) files[f.name] = await f.text();
  }
  return whoopFromFiles(files);
}
const hkISO = x => x.slice(0, 10) + 'T' + x.slice(11, 19) + (x.length >= 25 ? x.slice(20, 23) + ':' + x.slice(23, 25) : '');
const hkHour = x => { const h = Number(x.slice(11, 13)) + Number(x.slice(14, 16)) / 60; return h >= 12 ? h - 24 : h; };
async function readApple(file, onProgress){
  const WANT = {HKQuantityTypeIdentifierStepCount: 'steps', HKQuantityTypeIdentifierActiveEnergyBurned: 'activeKcal', HKQuantityTypeIdentifierDietaryEnergyConsumed: 'kcal', HKQuantityTypeIdentifierDietaryProtein: 'protein', HKQuantityTypeIdentifierDietaryCarbohydrates: 'carbs', HKQuantityTypeIdentifierDietaryFatTotal: 'fat', HKQuantityTypeIdentifierDietaryFiber: 'fiber', HKQuantityTypeIdentifierDietarySodium: 'sodium', HKQuantityTypeIdentifierDietaryWater: 'water', HKQuantityTypeIdentifierDietaryCaffeine: 'caffeine', HKQuantityTypeIdentifierNumberOfAlcoholicBeverages: 'alcohol'};
  const FOOD = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'water', 'caffeine', 'alcohol'];
  const cutoff = addDays(TODAY, -400);
  const qty = {}, rhr = {}, hrv = {}, sleep = {}, cafLate = {}, workouts = [];
  const attr = (tag, name) => { const i = tag.indexOf(' ' + name + '="'); if (i < 0) return null; const st = i + name.length + 3; return tag.slice(st, tag.indexOf('"', st)); };
  const conv = (metric, v, unit) => { if (!unit) return v;
    if ((metric === 'kcal' || metric === 'activeKcal') && unit === 'kJ') return v / 4.184;
    if (metric === 'sodium' || metric === 'caffeine') return unit === 'g' ? v * 1000 : unit === 'mcg' ? v / 1000 : v;
    if (metric === 'water') return unit === 'L' ? v * 1000 : unit === 'fl_oz_us' ? v * 29.5735 : unit === 'fl_oz_imp' ? v * 28.413 : v;
    if (['protein', 'carbs', 'fat', 'fiber'].includes(metric) && unit === 'mg') return v / 1000;
    return v; };
  function handle(tag){
    if (tag.charCodeAt(1) === 87) { // <Workout
      if (!tag.startsWith('<Workout ')) return;
      const srcN = attr(tag, 'sourceName') || ''; if (/whoop/i.test(srcN)) return;
      const sd = attr(tag, 'startDate'); if (!sd || sd.slice(0, 10) < cutoff) return;
      let dur = Number(attr(tag, 'duration')) || 0; const du = attr(tag, 'durationUnit') || 'min'; if (du === 's') dur /= 60; if (du === 'hr') dur *= 60;
      if (!dur && attr(tag, 'endDate')) dur = (Date.parse(hkISO(attr(tag, 'endDate'))) - Date.parse(hkISO(sd))) / 60000;
      workouts.push({date: sd.slice(0, 10), type: (attr(tag, 'workoutActivityType') || '').replace('HKWorkoutActivityType', ''), minutes: Math.round(dur)});
      return;
    }
    if (!tag.startsWith('<Record ')) return;
    const type = attr(tag, 'type'); if (!type) return;
    const metric = WANT[type], isSleep = type === 'HKCategoryTypeIdentifierSleepAnalysis', isRhr = type === 'HKQuantityTypeIdentifierRestingHeartRate', isHrv = type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN';
    if (!metric && !isSleep && !isRhr && !isHrv) return;
    const srcN = attr(tag, 'sourceName') || '?'; if (/whoop/i.test(srcN)) return;
    const sd = attr(tag, 'startDate'), ed = attr(tag, 'endDate'); if (!sd || !ed) return;
    const date = (isSleep ? ed : sd).slice(0, 10); if (date < cutoff) return;
    if (isSleep) {
      const v = attr(tag, 'value') || '', mins = (Date.parse(hkISO(ed)) - Date.parse(hkISO(sd))) / 60000; if (!(mins > 0) || mins > 1000) return;
      const st = /AsleepDeep/.test(v) ? 'deep' : /AsleepREM/.test(v) ? 'rem' : /Asleep/.test(v) ? 'core' : /Awake/.test(v) ? 'awake' : 'inbed';
      const o = ((sleep[date] = sleep[date] || {})[srcN] = sleep[date][srcN] || {deep: 0, rem: 0, core: 0, awake: 0, inbed: 0, bed: null, bedTs: Infinity});
      o[st] += mins;
      if (st !== 'awake' && st !== 'inbed') { const ts = Date.parse(hkISO(sd)); if (ts < o.bedTs) { o.bedTs = ts; o.bed = hkHour(sd); } }
      return;
    }
    let v = Number(attr(tag, 'value')); if (!isFinite(v)) return;
    if (isRhr) { (rhr[date] = rhr[date] || []).push(v); return; }
    if (isHrv) { (hrv[date] = hrv[date] || []).push(v); return; }
    v = conv(metric, v, attr(tag, 'unit'));
    const d = (qty[date] = qty[date] || {}), m = (d[metric] = d[metric] || {}); m[srcN] = (m[srcN] || 0) + v;
    if (metric === 'caffeine' && v > 0 && Number(sd.slice(11, 13)) >= 14) cafLate[date] = true;
  }
  let buf = '';
  function feed(chunk){
    buf += chunk; let i = 0;
    for (;;) {
      const a = buf.indexOf('<', i); if (a < 0) { buf = ''; return; }
      const b = buf.indexOf('>', a); if (b < 0) { buf = buf.slice(a); return; }
      const c = buf.charCodeAt(a + 1); if (c === 82 || c === 87) handle(buf.slice(a, b + 1));
      i = b + 1;
    }
  }
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
    if (!window.JSZip) throw new Error('The ZIP reader didn\u2019t load. Unzip the export and upload export.xml instead.');
    onProgress(0.02, 'Opening the ZIP…');
    const zip = await JSZip.loadAsync(file);
    const name = Object.keys(zip.files).find(n => /(^|\/)export\.xml$/i.test(n));
    if (!name) throw new Error('No export.xml inside that ZIP. Make sure it\u2019s the file Health created.');
    await new Promise((res, rej) => {
      zip.files[name].internalStream('string').on('data', (chunk, meta) => { feed(chunk); onProgress(0.05 + 0.9 * (meta.percent || 0) / 100, 'Reading your health data…'); })
        .on('error', rej).on('end', res).resume();
    });
  } else {
    const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader(); let done = 0;
    for (;;) { const {value, done: end} = await reader.read(); if (end) break; feed(value); done += value.length; onProgress(Math.min(0.95, done / Math.max(1, file.size)), 'Reading your health data…'); }
  }
  const days = {}, put = (d, k, v) => { (days[d] = days[d] || {})[k] = v; };
  const r1 = x => Math.round(x * 10) / 10;
  Object.entries(qty).forEach(([d, ms]) => {
    Object.entries(ms).forEach(([m, bySrc]) => { const best = Math.max(...Object.values(bySrc));
      if (m === 'steps' || m === 'activeKcal') put(d, m, Math.round(best));
      else { const f = (days[d] = days[d] || {}).food = (days[d].food || {}); f[m] = m === 'alcohol' ? r1(best) : Math.round(best); } });
  });
  Object.entries(cafLate).forEach(([d]) => { const f = (days[d] = days[d] || {}).food = (days[d].food || {}); f.caffeineLate = true; });
  Object.entries(rhr).forEach(([d, v]) => put(d, 'rhr', r1(v.reduce((a, b) => a + b, 0) / v.length)));
  Object.entries(hrv).forEach(([d, v]) => put(d, 'hrv', r1(v.reduce((a, b) => a + b, 0) / v.length)));
  Object.entries(sleep).forEach(([d, bySrc]) => {
    const best = Object.values(bySrc).sort((a, b) => (b.deep + b.rem + b.core) - (a.deep + a.rem + a.core))[0];
    const asleep = best.deep + best.rem + best.core; if (asleep < 60) return;
    put(d, 'sleep', {asleep: Math.round(asleep), deep: Math.round(best.deep), rem: Math.round(best.rem), core: Math.round(best.core), awake: Math.round(best.awake), bed: best.bed == null ? null : Math.round(best.bed * 1000) / 1000});
  });
  const kindOf = t => /StrengthTraining|CrossTraining|CoreTraining/.test(t) ? 'strength' : /Running|Cycling|Walking|Rowing|Elliptical|Swimming|Hiking|StairClimbing|HighIntensity|MixedCardio|JumpRope/.test(t) ? 'cardio' : /Soccer|Basketball|Tennis|Badminton|Volleyball|Football|Rugby|Hockey|Baseball|Squash|Boxing|MartialArts|Climbing|Golf|Pickleball|TableTennis/.test(t) ? 'sport' : 'other';
  const wo = workouts.filter(w => w.minutes > 0).map(w => ({date: w.date, kind: kindOf(w.type), name: w.type.replace(/([a-z])([A-Z])/g, '$1 $2') || 'Workout', minutes: w.minutes, effort: 5, source: 'apple'}));
  const dates = Object.keys(days).concat(wo.map(w => w.date)).sort();
  if (!dates.length) throw new Error('No recent steps, sleep, heart, nutrition or workout data found in that export.');
  return {days, workouts: wo, from: dates[0], to: dates[dates.length - 1], at: new Date().toISOString()};
}
function splitMonths(data, kind){
  const months = {};
  const bucket = m => (months[m] = months[m] || (kind === 'whoop' ? {month: m, rows: [], sessions: []} : {month: m, days: {}, workouts: []}));
  if (kind === 'whoop') { data.rows.forEach(r => bucket(r.date.slice(0, 7)).rows.push(COLS.map(c => r[c] === undefined ? null : r[c]))); data.sessions.forEach(x => bucket(x.date.slice(0, 7)).sessions.push([x.date, x.strain, x.minutes])); }
  else { Object.entries(data.days).forEach(([d, v]) => { bucket(d.slice(0, 7)).days[d] = v; }); data.workouts.forEach(w => bucket(w.date.slice(0, 7)).workouts.push(w)); }
  Object.values(months).forEach(m => { m.from = data.from; m.to = data.to; m.at = data.at; });
  return months;
}
function joinMonths(docs, kind){
  if (kind === 'whoop') { const rows = pack(docs.flatMap(d => d.rows || [])).sort((a, b) => a.date < b.date ? -1 : 1); const sessions = docs.flatMap(d => (d.sessions || []).map(([date, strain, minutes]) => ({date, strain, minutes})));
    return rows.length ? {rows, sessions, from: rows[0].date, to: rows[rows.length - 1].date, at: docs[0].at} : null; }
  const days = {}, workouts = []; docs.forEach(d => { Object.assign(days, d.days || {}); workouts.push(...(d.workouts || [])); });
  return {days, workouts, from: docs[0].from, to: docs[0].to, at: docs[0].at};
}
async function persistSource(kind, data){
  await ensureDb();
  if (!S.srcCols) return false;
  const col = S.srcCols[kind], months = splitMonths(data, kind);
  const old = await col.get();
  await Promise.all(Object.entries(months).map(([m, body]) => col.doc(m).set(body)));
  await Promise.all(old.docs.filter(d => !months[d.id]).map(d => col.doc(d.id).delete()));
  return true;
}
async function removeSource(kind){
  if (S.srcCols) { const old = await S.srcCols[kind].get(); await Promise.all(old.docs.map(d => S.srcCols[kind].doc(d.id).delete())); }
  IMPORT[kind] = null; dataChanged();
}
function dataChanged(){
  buildData();
  if (!DAYS.includes(S.sel)) S.sel = LASTW;
  renderAll(); renderPatterns(); renderConnections();
}
function renderConnections(){
  renderCalState();
  const w = IMPORT.whoop, a = IMPORT.apple;
  const ws = $('whoopState'), as = $('appleState');
  ws.className = 'cstate on'; ws.querySelector('span').textContent = w ? 'Imported · ' + fmtShort(w.from) + ' – ' + fmtShort(w.to) + ', ' + w.rows.length + ' days' : 'Built-in export · ' + fmtShort(BUILTIN.rows[0].date) + ' – ' + fmtShort(BUILTIN.rows[BUILTIN.rows.length - 1].date);
  $('whoopRemove').hidden = !w;
  as.className = 'cstate' + (a ? ' on' : ''); as.querySelector('span').textContent = a ? 'Imported · ' + fmtShort(a.from) + ' – ' + fmtShort(a.to) + ', ' + nOf(Object.keys(a.days).length, 'day') + ', ' + nOf(a.workouts.length, 'workout') : 'Not connected';
  $('appleRemove').hidden = !a;
}
function confirmButton(btn, label, action){
  let armed = false;
  btn.onclick = async () => { if (!armed) { armed = true; btn.textContent = 'Tap again to remove'; setTimeout(() => { armed = false; btn.textContent = label; }, 3000); return; }
    btn.disabled = true; try { await action(); } catch (e) {} btn.disabled = false; btn.textContent = label; };
}
confirmButton($('whoopRemove'), 'Remove imported WHOOP data', () => removeSource('whoop'));
confirmButton($('appleRemove'), 'Remove Apple Health data', () => removeSource('apple'));
$('whoopFile').addEventListener('change', async e => {
  const files = [...e.target.files]; if (!files.length) return;
  flash('whoopMsg', 'Reading your WHOOP export…');
  try {
    const data = await readWhoopInput(files);
    IMPORT.whoop = data; dataChanged();
    let saved = false; try { saved = await persistSource('whoop', data); } catch (err) { flash('whoopMsg', 'Imported, but couldn\u2019t save it to your account. It will reset when you reload.', true); e.target.value = ''; return; }
    flash('whoopMsg', 'Imported ' + data.rows.length + ' days (' + fmtShort(data.from) + ' – ' + fmtShort(data.to) + ')' + (saved ? ' and saved to your account.' : '. Saving is off in this view.'));
  } catch (err) { flash('whoopMsg', err.message || 'Couldn\u2019t read that file.', true); }
  e.target.value = '';
});
$('appleFile').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  const bar = $('appleProg'), fill = bar.querySelector('i'); bar.hidden = false; fill.style.width = '0%';
  const prog = (p, msg) => { fill.style.width = Math.round(p * 100) + '%'; $('appleMsg').textContent = msg + ' ' + Math.round(p * 100) + '%'; $('appleMsg').classList.remove('err'); };
  try {
    const data = await readApple(file, prog);
    IMPORT.apple = data; dataChanged(); fill.style.width = '100%';
    let saved = false; try { saved = await persistSource('apple', data); } catch (err) { flash('appleMsg', 'Imported, but couldn\u2019t save it to your account. It will reset when you reload.', true); bar.hidden = true; e.target.value = ''; return; }
    flash('appleMsg', 'Imported ' + nOf(Object.keys(data.days).length, 'day') + ' and ' + nOf(data.workouts.length, 'workout') + (saved ? ', saved to your account.' : '. Saving is off in this view.'));
  } catch (err) { flash('appleMsg', (err && err.message) || 'Couldn\u2019t read that file.', true); }
  bar.hidden = true; e.target.value = '';
});

// ---------- calendar + import/connect modes ----------
/* Every source card has an Import / Connect toggle. WHOOP and Apple Health have no live
   link a web page can use, so their Connect side says so. Google Calendar connects live
   through the viewer's Claude connector, or imports an .ics file. Only start and end
   times are kept from a calendar: never titles, places or guests. */
S.modes = {whoop: 'import', apple: 'import', calendar: 'import'};
S.planDay = null;
const CAL = {imported: null, live: null, liveAt: 0, ver: 0, memo: new Map(), added: new Set(), busy: false};
const CAL_SERVER = 'Google Calendar';
const calSrc = () => S.modes.calendar === 'connect' ? CAL.live : CAL.imported;
const calLabel = () => S.modes.calendar === 'connect' ? 'Google Calendar' : 'Your calendar';
const dayStartMs = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).getTime(); };
const dayEndMs = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd + 1).getTime(); };
const localDate = ms => { const t = new Date(ms); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
const localStamp = ms => { const t = new Date(ms); return localDate(ms) + 'T' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ':00'; };
const hourOf = (ms, d) => (ms - dayStartMs(d)) / 3600000;
function mergeIv(iv){
  const s = iv.slice().sort((a, b) => a[0] - b[0]), out = [];
  s.forEach(([a, b]) => { const l = out[out.length - 1]; if (l && a <= l[1]) l[1] = Math.max(l[1], b); else out.push([a, b]); });
  return out;
}
/* one day of the calendar: minutes booked (overlaps merged), how many events, the first start and the last end */
function calDay(d){
  const src = calSrc(); if (!src || d < src.from || d > src.to) return null;
  const key = CAL.ver + ':' + S.modes.calendar + ':' + d; if (CAL.memo.has(key)) return CAL.memo.get(key);
  const a = dayStartMs(d), b = dayEndMs(d), iv = [];
  src.events.forEach(e => { if (e.e > a && e.s < b) iv.push([Math.max(a, e.s), Math.min(b, e.e)]); });
  const m = mergeIv(iv), mins = m.reduce((t, [x, y]) => t + (y - x) / 60000, 0);
  const out = {mins, n: iv.length, first: m.length ? hourOf(m[0][0], d) : null, last: m.length ? hourOf(m[m.length - 1][1], d) : null, iv: m};
  CAL.memo.set(key, out); return out;
}
/* busyness, 0..1: hours booked past four (full at nine), a last event after 9 pm, a start before 7:30 am */
function calScore(st){
  if (!st || !st.n) return 0;
  const busy = clamp((st.mins / 60 - 4) / 5, 0, 1), late = st.last != null && st.last > 21 ? clamp((st.last - 21) / 2, 0, 1) : 0, early = st.first != null && st.first < 7.5 ? 0.5 : 0;
  return clamp(0.6 * busy + 0.4 * late + 0.2 * early, 0, 1);
}
const calText = st => hm(st.mins) + ' booked across ' + nOf(st.n, 'event') + (st.last != null && st.last > 21 ? ', the last ending ' + clock(st.last) : '') + (st.first != null && st.first < 7.5 ? ', the first at ' + clock(st.first) : '');
function calEvidence(){
  const busy = [], calm = [];
  WD.forEach(r => { if (r.recovery == null) return; const st = calDay(addDays(r.date, -1)); if (!st) return; const v = calScore(st); if (v >= 0.45) busy.push(r.recovery); else if (v < 0.2) calm.push(r.recovery); });
  const m = a => a.reduce((x, y) => x + y, 0) / a.length;
  if (busy.length >= 3 && calm.length >= 3) return 'After your busiest days your recovery averages ' + pct(m(busy)) + ', against ' + pct(m(calm)) + ' after lighter ones (' + (busy.length + calm.length) + ' days).';
  return 'Long, late days keep stress hormones up into the evening, which can lower HRV overnight.';
}
function calCause(d){
  const st = calDay(addDays(d, -1)), v = calScore(st); if (v < 0.45) return null;
  return {sev: v >= 0.75 ? 2.2 : 1.5, src: calLabel(), t: 'Packed schedule yesterday', now: 'Yesterday you had ' + calText(st) + '.', ev: calEvidence(),
    fix: st.last != null && st.last > 21 ? 'Keep tonight clear after 9 pm and give yourself an hour to wind down.' : 'Block a 15-minute break between commitments today and keep training lighter.'};
}

// ---- .ics import: start and end times only ----
function icsTime(prop, val){
  const tz = /;TZID=/i.test(prop), date = /VALUE=DATE(?!-)/i.test(prop) || /^\d{8}$/.test(val);
  const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/); if (!m) return null;
  const [, Y, Mo, D, h = '0', mi = '0', s = '0', z] = m;
  if (date) return {ms: new Date(+Y, +Mo - 1, +D).getTime(), all: true};
  /* a TZID time is read as the viewer's own clock: close enough for a day's load */
  return {ms: z ? Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +s) : new Date(+Y, +Mo - 1, +D, +h, +mi, +s).getTime(), all: false, tz};
}
function icsDur(v){ const m = v.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/); if (!m) return 0; return ((+m[1] || 0) * 604800 + (+m[2] || 0) * 86400 + (+m[3] || 0) * 3600 + (+m[4] || 0) * 60 + (+m[5] || 0)) * 1000; }
function parseICS(text){
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const lo = dayStartMs(addDays(TODAY, -400)), hi = dayEndMs(addDays(TODAY, 60)), out = [];
  let ev = null;
  const DOW = {SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6};
  const push = (s, e) => { if (e > lo && s < hi && e > s && e - s <= 86400000) out.push({s, e}); };
  for (const ln of lines) {
    if (ln === 'BEGIN:VEVENT') { ev = {ex: []}; continue; }
    if (ln === 'END:VEVENT') {
      if (ev && ev.start && !ev.start.all && ev.status !== 'CANCELLED' && ev.transp !== 'TRANSPARENT') {
        const s0 = ev.start.ms, dur = ev.end ? ev.end.ms - s0 : (ev.dur || 3600000), ex = new Set(ev.ex);
        if (!ev.rrule) push(s0, s0 + dur);
        else {
          const r = Object.fromEntries(ev.rrule.split(';').map(p => p.split('=')));
          const freq = r.FREQ, step = Math.max(1, +r.INTERVAL || 1), until = r.UNTIL ? (icsTime('', r.UNTIL) || {}).ms : Infinity, count = +r.COUNT || Infinity;
          const byday = r.BYDAY ? r.BYDAY.split(',').map(x => DOW[x.slice(-2)]).filter(x => x != null) : null;
          const t0 = new Date(s0); let n = 0;
          for (let i = 0; i < 3000 && n < count; i++) {
            let t;
            if (freq === 'DAILY') t = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + i * step, t0.getHours(), t0.getMinutes());
            else if (freq === 'WEEKLY') { const wk = Math.floor(i / 7), dd = i % 7; if (wk % step) continue; t = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + i, t0.getHours(), t0.getMinutes()); if (byday ? !byday.includes(t.getDay()) : dd !== 0) continue; }
            else if (freq === 'MONTHLY') t = new Date(t0.getFullYear(), t0.getMonth() + i * step, t0.getDate(), t0.getHours(), t0.getMinutes());
            else if (freq === 'YEARLY') t = new Date(t0.getFullYear() + i * step, t0.getMonth(), t0.getDate(), t0.getHours(), t0.getMinutes());
            else break;
            const ms = t.getTime(); if (ms > until || ms > hi) break;
            n++; if (!ex.has(ms)) push(ms, ms + dur);
          }
        }
      }
      ev = null; continue;
    }
    if (!ev) continue;
    const c = ln.indexOf(':'); if (c < 0) continue;
    const prop = ln.slice(0, c), val = ln.slice(c + 1).trim(), name = prop.split(';')[0].toUpperCase();
    if (name === 'DTSTART') ev.start = icsTime(prop, val);
    else if (name === 'DTEND') ev.end = icsTime(prop, val);
    else if (name === 'DURATION') ev.dur = icsDur(val);
    else if (name === 'RRULE') ev.rrule = val;
    else if (name === 'EXDATE') val.split(',').forEach(v => { const t = icsTime(prop, v); if (t) ev.ex.push(t.ms); });
    else if (name === 'STATUS') ev.status = val.toUpperCase();
    else if (name === 'TRANSP') ev.transp = val.toUpperCase();
  }
  out.sort((a, b) => a.s - b.s);
  if (!out.length) throw new Error('No timed events in that file from the last year. Check it’s an .ics calendar export.');
  return {events: out, from: localDate(out[0].s), to: localDate(out[out.length - 1].s)};
}
async function calPersist(data){
  await ensureDb();
  if (!S.srcCols || !S.srcCols.calendar) return false;
  const col = S.srcCols.calendar, by = {};
  data.events.forEach(e => { const m = localDate(e.s).slice(0, 7); (by[m] = by[m] || []).push([e.s, e.e]); });
  const old = await col.get(); await Promise.all(old.docs.filter(d => !by[d.id]).map(d => col.doc(d.id).delete()));
  await Promise.all(Object.entries(by).map(([m, ev]) => col.doc(m).set({ev, from: data.from, to: data.to})));
  return true;
}
function calJoin(docs){
  if (!docs.length) return null;
  const events = []; let from = null, to = null;
  docs.forEach(d => { (d.ev || []).forEach(([s, e]) => events.push({s, e})); if (!from || d.from < from) from = d.from; if (!to || d.to > to) to = d.to; });
  events.sort((a, b) => a.s - b.s);
  return {events, from, to};
}

// ---- live: the viewer's Google Calendar connector ----
const calUse = name => window.claude && window.claude.use ? window.claude.use(name) : Promise.resolve(null);
function calErr(e){
  const c = e && e.code;
  if (c === 'server_not_connected' || c === 'server_not_found' || c === 'selection_required') return 'Add Google Calendar in claude.ai Settings → Connectors, then tap Connect again.';
  if (c === 'needs_reauth') return 'Reconnect Google Calendar in claude.ai Settings → Connectors, then tap Connect again.';
  if (c === 'not_in_manifest' || c === 'approval_required' || c === 'consent_required') return 'Calendar access wasn’t allowed for this page. Tap Connect to be asked again.';
  if (c === 'blocked_by_policy') return 'Your organization doesn’t allow this page to use Google Calendar.';
  if (c === 'not_granted' || c === 'capability_disabled' || c === 'capability_removed') return 'Connecting works when this page is open in Claude.';
  if (c === 'server_unavailable' || c === 'rate_limited') return 'Google Calendar didn’t answer just now. Try Refresh in a minute.';
  if (c === 'tool_error') return 'Google Calendar returned an error: ' + (e.message || 'unknown') + '.';
  return 'Couldn’t reach Google Calendar. Try again in a moment.';
}
function liveEvent(x){
  if (!x || x.status === 'cancelled' || x.transparency === 'transparent') return null;
  if (['WORKING_LOCATION', 'BIRTHDAY', 'workingLocation', 'birthday'].includes(x.eventType)) return null;
  if ((x.attendees || []).some(a => a.self && a.responseStatus === 'declined')) return null;
  const s = x.start && x.start.dateTime ? Date.parse(x.start.dateTime) : NaN, e = x.end && x.end.dateTime ? Date.parse(x.end.dateTime) : NaN;
  return isFinite(s) && isFinite(e) && e > s ? {s, e} : null;   // all-day events don't count as booked time
}
async function calFetch(manual){
  if (CAL.busy) return; CAL.busy = true; renderConnections();
  const msg = t => { $('calLive').textContent = t; $('calLive').classList.remove('err'); };
  const fail = t => { $('calLive').textContent = t; $('calLive').classList.add('err'); };
  try {
    const mcp = await calUse('mcp');
    if (!mcp) { fail(SB_CFG ? 'Live Google Calendar works in the Claude version of this dashboard. Here, use Import with an .ics file.' : 'Connecting works when this page is open in Claude.'); return; }
    msg('Reading your calendar…');
    const from = addDays(TODAY, -42), to = addDays(TODAY, 14), events = [];
    let token = null, stamp = null;
    for (let page = 0; page < 8; page++) {
      const input = {startTime: from + 'T00:00:00', endTime: addDays(to, 1) + 'T00:00:00', pageSize: 250, orderBy: 'startTime'};
      if (token) input.pageToken = token;
      let res;
      try { res = await mcp.callTool(CAL_SERVER, 'list_events', input, {cache: {staleTime: 120000, gcTime: 600000, refresh: !!manual}}); }
      catch (e) {
        if (!e || !e.retryable) throw e;
        await new Promise(r => setTimeout(r, (e.retryAfterMs || 1200) + Math.random() * 600));
        res = await mcp.callTool(CAL_SERVER, 'list_events', input, {cache: {staleTime: 120000, gcTime: 600000, refresh: true}});
      }
      if (res.cache && stamp == null) stamp = res.cache.storedAt;
      const p = res.payload || {};
      (p.events || []).forEach(x => { const v = liveEvent(x); if (v) events.push(v); });
      token = p.nextPageToken; if (!token) break;
    }
    events.sort((a, b) => a.s - b.s);
    CAL.live = {events, from, to}; CAL.liveAt = stamp || Date.now(); CAL.ver++; CAL.memo.clear();
    msg('Read ' + nOf(events.length, 'event') + ' from ' + fmtShort(from) + ' to ' + fmtShort(to) + '.');
    renderAll();
  } catch (e) { fail(calErr(e)); }
  finally { CAL.busy = false; renderConnections(); syncCalRow(); }
}
async function calAutoLoad(){
  if (S.modes.calendar !== 'connect' || CAL.live) return;
  const perms = await calUse('permissions');
  const st = perms ? await perms.state('mcp:' + CAL_SERVER).catch(() => 'unavailable') : 'unavailable';
  if (st === 'granted') calFetch(false);
  else if (st === 'unavailable') { $('calLive').textContent = SB_CFG ? 'Live Google Calendar works in the Claude version of this dashboard. Here, use Import with an .ics file.' : 'Connecting works when this page is open in Claude.'; }
  else $('calLive').textContent = 'Tap Connect to load your calendar.';
}
async function calCreate(summary, startMs, endMs, description){
  const mcp = await calUse('mcp'); if (!mcp) throw {code: 'not_granted'};
  const res = await mcp.callTool(CAL_SERVER, 'create_event', {summary, startTime: localStamp(startMs), endTime: localStamp(endMs), description});
  mcp.invalidate(CAL_SERVER, 'list_events').catch(() => {});
  return res.payload || {};
}
const calWriteErr = e => (e && (e.code === 'server_unavailable' || e.code === 'upstream_error' || e.code === 'cancelled')) ? 'It may have been added anyway. Check your calendar before trying again.' : calErr(e);
const calLive = () => S.modes.calendar === 'connect' && !!CAL.live;

// ---- the toggles ----
function syncModes(){
  document.querySelectorAll('.modeseg').forEach(seg => {
    const src = seg.dataset.src, mode = S.modes[src];
    seg.dataset.mode = mode;
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    ['import', 'connect'].forEach(m => { const p = document.querySelector('[data-pane="' + src + '-' + m + '"]'); if (p) p.hidden = m !== mode; });
  });
}
function setMode(src, mode){
  if (S.modes[src] === mode) return;
  S.modes[src] = mode; syncModes(); savePrefs();
  if (src === 'calendar') { CAL.ver++; CAL.memo.clear(); renderAll(); renderConnections(); syncCalRow(); calAutoLoad(); }
}
document.querySelectorAll('.modeseg button').forEach(b => b.addEventListener('click', () => setMode(b.closest('.modeseg').dataset.src, b.dataset.mode)));
function renderCalState(){
  const cs = $('calState'), live = S.modes.calendar === 'connect';
  const span = cs.querySelector('span');
  if (live) {
    cs.className = 'cstate' + (CAL.live ? ' on' : '');
    span.textContent = CAL.busy ? 'Connecting…' : CAL.live ? 'Connected · updated ' + new Date(CAL.liveAt).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : 'Not connected';
  } else {
    cs.className = 'cstate' + (CAL.imported ? ' on' : '');
    span.textContent = CAL.imported ? 'Imported · ' + fmtShort(CAL.imported.from) + ' – ' + fmtShort(CAL.imported.to) + ', ' + nOf(CAL.imported.events.length, 'event') : 'Not imported';
  }
  $('calConnect').hidden = !!CAL.live; $('calConnect').disabled = CAL.busy;
  $('calRefresh').hidden = !CAL.live; $('calRefresh').disabled = CAL.busy; $('calOff').hidden = !CAL.live;
  $('calRemove').hidden = !CAL.imported;
}
$('calConnect').addEventListener('click', () => calFetch(true));
$('calRefresh').addEventListener('click', () => calFetch(true));
$('calOff').addEventListener('click', () => {
  CAL.live = null; CAL.ver++; CAL.memo.clear(); renderAll(); renderConnections(); syncCalRow();
  $('calLive').textContent = 'Disconnected on this page. To take away its access completely, use the page’s Permissions menu.'; $('calLive').classList.remove('err');
});
$('calFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  flash('calMsg', 'Reading your calendar…');
  try {
    const data = parseICS(await f.text());
    CAL.imported = data; CAL.ver++; CAL.memo.clear(); renderAll(); renderConnections();
    let saved = false; try { saved = await calPersist(data); } catch (err) { flash('calMsg', 'Imported, but couldn’t save it to your account. It will reset when you reload.', true); e.target.value = ''; return; }
    flash('calMsg', 'Imported ' + nOf(data.events.length, 'event') + ' (' + fmtShort(data.from) + ' – ' + fmtShort(data.to) + ')' + (saved ? ', saved to your account.' : '. Saving is off in this view.'));
  } catch (err) { flash('calMsg', (err && err.message) || 'Couldn’t read that file.', true); }
  e.target.value = '';
});
confirmButton($('calRemove'), 'Remove imported calendar', async () => {
  if (S.srcCols && S.srcCols.calendar) { const old = await S.srcCols.calendar.get(); await Promise.all(old.docs.map(d => S.srcCols.calendar.doc(d.id).delete())); }
  CAL.imported = null; CAL.ver++; CAL.memo.clear(); renderAll(); renderConnections(); flash('calMsg', 'Removed.');
});
function syncCalRow(){
  const row = $('w-calrow'); if (!row) return;
  const w = S.sheet && S.sheet.kind === 'workout' ? S.sheet.item : null;
  row.hidden = !calLive();
  const cb = $('w-cal'); cb.disabled = !!(w && w.calAdded); if (w && w.calAdded) cb.checked = true;
  row.querySelector('span').textContent = w && w.calAdded ? 'On your Google Calendar' : 'Add to Google Calendar';
}

// ---- training times ----
const SESSIONS = [
  {min: 67, name: 'Heavy session', mins: 90, note: 'You’re recovered. A good day for heavy compounds or a top set.'},
  {min: 34, name: 'Moderate session', mins: 60, note: 'Keep working sets around RPE 7 and skip the top single.'},
  {min: -1, name: 'Light session', mins: 40, note: 'Technique work, mobility or an easy walk, so your body can catch up.'}
];
function latestReadiness(){
  const t = BYDATE[TODAY]; if (t && t.recovery != null) return {v: t.recovery, d: TODAY};
  for (let i = WD.length - 1; i >= 0; i--) if (WD[i].recovery != null) return {v: WD[i].recovery, d: WD[i].date};
  return null;
}
function usualBed(){
  const b = avg(WD.slice(-30), 'bed'); if (b == null) return 23.5;
  return b < 12 ? 24 + b : b;   // after-midnight bedtimes count past 24
}
function freeSlots(d, mins){
  const st = calDay(d); if (!st) return null;
  const a = dayStartMs(d), H = h => a + h * 3600000, buf = 20 * 60000;
  let lo = H(6); const hi = H(clamp(usualBed() - 2, 19, 22));
  if (d === TODAY) { const now = Date.now() + 30 * 60000; lo = Math.max(lo, Math.ceil(now / 900000) * 900000); }
  if (hi - lo < mins * 60000) return [];
  const busy = mergeIv(st.iv.map(([s, e]) => [s - buf, e + buf]));
  const gaps = []; let cur = lo;
  busy.forEach(([s, e]) => { if (s > cur) gaps.push([cur, Math.min(s, hi)]); cur = Math.max(cur, e); });
  if (cur < hi) gaps.push([cur, hi]);
  const need = mins * 60000, target = H(16.5);
  return gaps.filter(([s, e]) => e - s >= need).map(([s, e]) => {
    const start = Math.round(clamp(target, s, e - need) / 900000) * 900000, st2 = clamp(start, s, e - need);
    const mid = hourOf(st2 + need / 2, d);
    return {s: st2, e: st2 + need, gs: s, ge: e, mid, score: -Math.abs(mid - 17.5) + Math.min(2, (e - s - need) / 3600000) * 0.2};
  }).sort((x, y) => y.score - x.score).slice(0, 3).sort((x, y) => x.s - y.s);
}
const tclock = ms => new Date(ms).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
function renderPlan(){
  const daysEl = $('planDays'), sessEl = $('planSess'), slotsEl = $('planSlots');
  if (!daysEl) return;
  const opts = []; if (new Date().getHours() < 20) opts.push([TODAY, 'Today']); opts.push([addDays(TODAY, 1), 'Tomorrow']); opts.push([addDays(TODAY, 2), fmtShort(addDays(TODAY, 2))]);
  if (!opts.some(o => o[0] === S.planDay)) S.planDay = opts[0][0];
  daysEl.replaceChildren(...opts.map(([d, lab]) => { const b = el('button', 'pill', lab); b.type = 'button'; b.setAttribute('aria-pressed', String(d === S.planDay)); b.onclick = () => { S.planDay = d; renderPlan(); }; return b; }));
  const rd = latestReadiness(), ses = rd ? SESSIONS.find(s => rd.v >= s.min) : SESSIONS[1];
  sessEl.replaceChildren();
  const chip = el('span', 'tag', rd ? Math.round(rd.v) + '% Readiness' : 'No Readiness yet'); chip.style.background = rd ? heatColor(rd.v) : 'rgba(255,255,255,.3)';
  const txt = el('div'); txt.append(el('b', null, ses.name + ' · ' + ses.mins + ' min'), el('span', 'muted', ses.note + (rd && rd.d !== TODAY ? ' Based on your latest Readiness, ' + fmtShort(rd.d) + '.' : '')));
  sessEl.append(chip, txt);
  slotsEl.replaceChildren();
  const src = calSrc();
  if (!src) { slotsEl.appendChild(el('p', 'empty', 'Connect or import your calendar in Connections to see free times.')); $('planSub').textContent = 'Free slots in your calendar, matched to how ready you are.'; return; }
  $('planSub').textContent = 'Free slots from ' + calLabel().replace('Your', 'your') + ', matched to how ready you are.';
  const slots = freeSlots(S.planDay, ses.mins);
  if (slots == null) { slotsEl.appendChild(el('p', 'empty', 'Your calendar data doesn’t reach this day yet. ' + (S.modes.calendar === 'connect' ? 'Tap Refresh in Connections.' : 'Import a newer export.'))); return; }
  if (!slots.length) { slotsEl.appendChild(el('p', 'empty', 'No ' + ses.mins + '-minute gap between 6 am and two hours before your usual bedtime. Try another day, or a shorter session.')); return; }
  slots.forEach(sl => {
    const card = el('div', 'slot'), key = sl.s + ':' + sl.e;
    const why = sl.mid >= 15 && sl.mid <= 19.5 ? 'Late afternoon, when strength tends to peak' : sl.mid < 10.5 ? 'Morning, before your day fills up' : 'Midday gap';
    card.append(el('b', null, tclock(sl.s) + ' – ' + tclock(sl.e)), el('span', 'muted', why + ' · free ' + tclock(sl.gs) + ' – ' + tclock(sl.ge)));
    if (calLive()) {
      const btn = el('button', 'ghost', CAL.added.has(key) ? 'Added ✓' : 'Add to Google Calendar'); btn.type = 'button'; btn.disabled = CAL.added.has(key);
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = 'Adding…';
        try {
          await calCreate('Training · ' + ses.name, sl.s, sl.e, 'Planned in Recovery Dashboard' + (rd ? ' from Readiness ' + Math.round(rd.v) + '%' : '') + '. ' + ses.note);
          CAL.added.add(key); btn.textContent = 'Added ✓'; flash('planMsg', ses.name + ' added to Google Calendar for ' + tclock(sl.s) + '.');
          calFetch(true);
        } catch (e) { btn.disabled = false; btn.textContent = 'Add to Google Calendar'; flash('planMsg', calWriteErr(e), true); }
      };
      card.appendChild(btn);
    } else card.appendChild(el('span', 'muted sm', 'Connect Google Calendar to add it'));
    slotsEl.appendChild(card);
  });
}

// ---------- render ----------
function renderAll(){
  const i = DAYS.indexOf(S.sel);
  $('dayLabel').textContent = fmtDay(S.sel); $('prev').disabled = i <= 0; $('next').disabled = i >= DAYS.length - 1;
  $('latest').disabled = S.sel === LASTW; $('today').disabled = i === DAYS.length - 1;
  drawScene(); applyLayout(); renderWidgets(); renderWhy(); renderMuscles(); renderBrain(); renderLog(); renderCharts(); renderPlan();
}
document.querySelectorAll('.thpick').forEach(thermalPicker);
syncModes();
renderAll(); renderPatterns(); renderConnections(); syncWorkoutUI();
let pw = window.innerWidth; window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - pw) > 40) { pw = window.innerWidth; renderPatterns(); } });
boot();
})();
// ---------- liquid glass ----------
(function(){
  const isChromium = !!(navigator.userAgentData && navigator.userAgentData.brands && navigator.userAgentData.brands.some(b => /Chromium/.test(b.brand))) || (/Chrome\//.test(navigator.userAgent) && !/Firefox|FxiOS/.test(navigator.userAgent));
  const reduceT = window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
  // rim light follows the pointer
  let px = -1e4, py = -1e4, queued = false;
  const lightAll = () => { queued = false; document.querySelectorAll('.glass').forEach(g => { const r = g.getBoundingClientRect(); if (r.bottom < -200 || r.top > innerHeight + 200) return; g.style.setProperty('--mx', (px - r.left) + 'px'); g.style.setProperty('--my', (py - r.top) + 'px'); }); };
  window.addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; if (!queued) { queued = true; requestAnimationFrame(lightAll); } }, {passive: true});
  window.addEventListener('scroll', () => { if (px > -1e4 && !queued) { queued = true; requestAnimationFrame(lightAll); } }, {passive: true});
  window.LG = {boost(){}};
  // every glass panel gets its own material layer; warping touches only that layer
  const ensureGfx = el => { let g = el.querySelector(':scope > .gfx'); if (!g) { g = document.createElement('div'); g.className = 'gfx'; g.setAttribute('aria-hidden', 'true'); el.prepend(g); el.classList.add('has-gfx'); } return g; };
  window.LG.gfx = ensureGfx;
  const gfxAll = () => document.querySelectorAll('.glass').forEach(ensureGfx);
  gfxAll(); let gq = false; new MutationObserver(() => { if (!gq) { gq = true; requestAnimationFrame(() => { gq = false; gfxAll(); }); } }).observe(document.body, {childList: true, subtree: true});
  if (!isChromium || reduceT) return; // other browsers keep the frosted blur from CSS
  document.documentElement.classList.add('lg-on');
  const NSX = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(NSX, 'svg'); defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; document.body.appendChild(defs);
  // displacement map: pixels near the rounded edge push inward, like light bending through a curved glass rim
  function mapFor(w, h, radius, bezel){
    const s = 0.5, W = Math.max(2, Math.round(w * s)), H = Math.max(2, Math.round(h * s)), r = radius * s, b = bezel * s;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); const img = g.createImageData(W, H), d = img.data;
    const cx = W / 2, cy = H / 2, hx = W / 2 - r, hy = H / 2 - r;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ax = Math.abs(x + .5 - cx) - hx, ay = Math.abs(y + .5 - cy) - hy;
      const ox = Math.max(ax, 0), oy = Math.max(ay, 0), sd = Math.hypot(ox, oy) + Math.min(Math.max(ax, ay), 0) - r; // signed distance, negative inside
      const depth = -sd; let nx = 0, ny = 0, k = 0;
      if (depth >= 0 && depth < b) {
        k = Math.pow(1 - depth / b, 2.2);
        if (ax > 0 && ay > 0) { const l = Math.hypot(ax, ay) || 1; nx = ax / l; ny = ay / l; } else if (ax > ay) nx = 1; else ny = 1;
        nx *= Math.sign(x + .5 - cx); ny *= Math.sign(y + .5 - cy);
      }
      const i = (y * W + x) * 4; d[i] = 128 - nx * k * 127; d[i + 1] = 128 - ny * k * 127; d[i + 2] = 128; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); return cv.toDataURL();
  }
  let n = 0; const state = new WeakMap();
  function build(el){
    const w = el.offsetWidth, h = el.offsetHeight; if (w < 20 || h < 20) return;
    const st = state.get(el) || {id: 'lg' + (n++)}; if (st.w && Math.abs(st.w - w) < 6 && Math.abs(st.h - h) < 6) return;
    st.w = w; st.h = h; state.set(el, st);
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 24, bezel = Math.min(28, Math.max(14, Math.min(w, h) * 0.12));
    const scale = el.classList.contains('dense') ? 46 : 64, url = mapFor(w, h, radius, bezel);
    let f = defs.querySelector('#' + st.id);
    if (!f) { f = document.createElementNS(NSX, 'filter'); f.id = st.id; defs.appendChild(f); }
    f.setAttribute('filterUnits', 'userSpaceOnUse'); f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', w); f.setAttribute('height', h); f.setAttribute('color-interpolation-filters', 'sRGB');
    f.innerHTML = `<feImage href="${url}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="dR"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale * 0.92}" xChannelSelector="R" yChannelSelector="G" result="dG"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale * 0.84}" xChannelSelector="R" yChannelSelector="G" result="dB"/>
      <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
      <feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>`;
    const blur = el.classList.contains('dense') ? 10 : 5; st.scale = scale; st.blur = blur;
    ensureGfx(el).style.backdropFilter = `url(#${st.id}) blur(${blur}px) saturate(175%) brightness(1.04)`;
  }
  window.LG.boost = (el, k, blur) => {
    const st = state.get(el); if (!st || !st.scale) return; const f = defs.querySelector('#' + st.id); if (!f) return;
    f.querySelectorAll('feDisplacementMap').forEach((m, i) => m.setAttribute('scale', (st.scale * k * [1, 0.92, 0.84][i]).toFixed(1)));
    ensureGfx(el).style.backdropFilter = `url(#${st.id}) blur(${blur == null ? st.blur : blur}px) saturate(${blur == null ? 175 : 190}%) brightness(1.04)`;
  };
  const ro = new ResizeObserver(es => es.forEach(e => { clearTimeout(e.target._lgT); e.target._lgT = setTimeout(() => build(e.target), 120); }));
  const watch = () => document.querySelectorAll('.glass').forEach(el => { if (!el._lg) { el._lg = true; ro.observe(el); build(el); } });
  watch(); let wq = false; new MutationObserver(() => { if (!wq) { wq = true; requestAnimationFrame(() => { wq = false; watch(); }); } }).observe(document.body, {childList: true, subtree: true});
})();
