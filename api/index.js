// ClaimPack — carrier-ready claim documentation packages for restoration contractors
const express = require('express');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/claimpack-data' : path.join(__dirname, '..', 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'claimpack.db'));
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS packs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL, edit_key TEXT NOT NULL,
  contractor TEXT NOT NULL, claim_no TEXT DEFAULT '', insured TEXT NOT NULL, property TEXT DEFAULT '',
  carrier TEXT DEFAULT '', peril TEXT NOT NULL, loss_date TEXT DEFAULT '', inspected TEXT DEFAULT '',
  narrative TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, pack_id INTEGER NOT NULL, area TEXT NOT NULL, description TEXT NOT NULL, qty REAL DEFAULT 1, unit TEXT DEFAULT 'EA', unit_price REAL DEFAULT 0, photo_ref TEXT DEFAULT '', supplement INTEGER DEFAULT 0);
`);

const PERILS = {
  water: { label: 'Water / flood', checks: ['Moisture readings logged per affected room (meter + date)', 'Category & class of water documented (IICRC S500)', 'Dry-out logs: equipment counts, placement map, daily readings', 'Source of loss photographed before repair', 'Affected materials inventoried with moisture-map reference'] },
  fire: { label: 'Fire / smoke', checks: ['Origin area photographed from 4 angles', 'Smoke/soot migration documented per room', 'Contents inventory: restorable vs non-restorable', 'Odor treatment protocol documented', 'Structural engineer letter if load members charred'] },
  storm: { label: 'Wind / hail / storm', checks: ['Roof test squares photographed with chalk + tape measure', 'Slope-by-slope damage counts', 'Collateral damage documented (gutters, screens, AC fins)', 'Weather-event verification (date, station report)', 'Interior water intrusion mapped to exterior openings'] },
  mold: { label: 'Mold remediation', checks: ['Pre-remediation air/tape samples with lab results', 'Containment setup photographed', 'Protocol from IEP attached where required', 'Post-remediation verification documented', 'Moisture source correction documented'] },
};

const q = {
  bySlug: db.prepare('SELECT * FROM packs WHERE slug=?'),
  newPack: db.prepare('INSERT INTO packs (slug, edit_key, contractor, claim_no, insured, property, carrier, peril, loss_date, inspected, narrative) VALUES (?,?,?,?,?,?,?,?,?,?,?)'),
  items: db.prepare('SELECT * FROM items WHERE pack_id=? ORDER BY area, id'),
  addItem: db.prepare('INSERT INTO items (pack_id, area, description, qty, unit, unit_price, photo_ref, supplement) VALUES (?,?,?,?,?,?,?,?)'),
};

function seed() {
  if (q.bySlug.get('demo')) return;
  const id = q.newPack.run('demo', 'demo-key', 'BlueLine Restoration LLC', 'CLM-2026-088412', 'Harris residence', '482 Maplewood Dr, Naperville IL', 'State Farm', 'water', '2026-07-02', '2026-07-03',
    'Supply line failure at second-floor bathroom; Category 2 water migrated through kitchen ceiling into cabinetry and hardwood. Emergency mitigation began within 4 hours of call. Moisture readings and dry-out logs attached; cabinetry delamination discovered on tear-out (supplement items flagged).').lastInsertRowid;
  const I = [
    ['Bathroom 2F', 'Emergency water extraction', 1, 'EA', 485, 'IMG_0141', 0],
    ['Bathroom 2F', 'Remove & replace vanity base cabinet', 1, 'EA', 1240, 'IMG_0143', 0],
    ['Kitchen', 'Ceiling drywall: remove, hang, tape, texture', 96, 'SF', 6.8, 'IMG_0151', 0],
    ['Kitchen', 'Upper cabinet run — detach & reset', 12, 'LF', 58, 'IMG_0155', 0],
    ['Kitchen', 'Base cabinet replacement (delamination found on tear-out)', 8, 'LF', 310, 'IMG_0162', 1],
    ['Kitchen', 'Hardwood floor: R&R oak strip, sand & finish', 220, 'SF', 11.5, 'IMG_0158', 0],
    ['Whole home', 'Dehumidifier (LGR) — 4 units × 4 days', 16, 'DAY', 95, 'LOG-DRY1', 0],
    ['Whole home', 'Air mover — 12 units × 4 days', 48, 'DAY', 32, 'LOG-DRY1', 0],
  ];
  for (const [a, d, qy, u, p, ph, s] of I) q.addItem.run(id, a, d, qy, u, p, ph, s);
}
seed();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CSS = `
:root{--bg:#f2f6f7;--panel:#fff;--line:#d9e4e6;--ink:#132b31;--dim:#587076;--teal:#0e7c86;--teal-dark:#0a545b;--soft:#dff0f2;--green:#1e8e5a;--green-soft:#e2f5eb;--red:#c0392b;--red-soft:#fae7e4;--amber:#b7791f;--amber-soft:#fbf1dc;--font:"Avenir Next","Segoe UI",-apple-system,Helvetica,Arial,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);line-height:1.55}
a{color:var(--teal);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1000px;margin:0 auto;padding:0 22px}
nav{background:var(--teal-dark);color:#fff}nav .wrap{display:flex;align-items:center;gap:22px;height:60px}
.logo{font-weight:800;font-size:1.15rem;color:#fff;display:flex;align-items:center;gap:9px}.logo:hover{text-decoration:none}
.mark{width:25px;height:25px;border-radius:6px;background:#7fd6de;color:var(--teal-dark);display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem}
nav a.nl{color:#b8dde1}.spacer{flex:1}
.btn{display:inline-block;background:var(--teal);color:#fff;font-weight:700;padding:10px 18px;border-radius:8px;border:none;font-size:.95rem;cursor:pointer;font-family:var(--font)}
.btn:hover{filter:brightness(1.1);text-decoration:none}.btn.ghost{background:transparent;border:1.5px solid var(--line);color:var(--ink)}nav .btn.ghost{color:#fff;border-color:#28727a}.btn.small{padding:6px 12px;font-size:.85rem}
.hero{background:linear-gradient(160deg,var(--teal-dark),#0e7c86 140%);color:#fff;padding:74px 0 64px}
.hero h1{font-size:2.7rem;line-height:1.12;letter-spacing:-.02em;margin:0 0 16px;max-width:680px}.hero h1 em{font-style:normal;color:#7fd6de}
.hero p{color:#b8dde1;font-size:1.13rem;max-width:620px;margin:0 0 26px}
.statrow{display:flex;gap:40px;flex-wrap:wrap;margin-top:36px}.statrow b{display:block;font-size:1.6rem;color:#7fd6de}.statrow span{color:#b8dde1;font-size:.88rem}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:24px;margin-top:18px}.panel h3{margin-top:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:26px}
.kicker{text-transform:uppercase;letter-spacing:.12em;font-size:.75rem;font-weight:700;color:var(--teal);margin:40px 0 6px}
h2.t{font-size:1.7rem;margin:0 0 10px}
input,select,textarea{width:100%;padding:10px 12px;border:1.5px solid var(--line);border-radius:8px;font-size:.95rem;font-family:var(--font);background:#fff;color:var(--ink)}
textarea{min-height:90px;resize:vertical}input:focus,select:focus,textarea:focus{outline:none;border-color:var(--teal)}
label.f{display:block;font-weight:700;font-size:.85rem;margin:12px 0 5px;color:var(--dim)}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th{text-align:left;color:var(--dim);font-size:.74rem;text-transform:uppercase;letter-spacing:.06em;padding:8px 9px;border-bottom:1.5px solid var(--line)}
td{padding:9px;border-bottom:1px solid var(--line)}
.tag{display:inline-block;padding:2px 10px;border-radius:99px;font-size:.75rem;font-weight:700}
.tag.teal{background:var(--soft);color:var(--teal)}.tag.green{background:var(--green-soft);color:var(--green)}.tag.amber{background:var(--amber-soft);color:var(--amber)}
.checklist{list-style:none;padding:0;margin:10px 0 0;display:flex;flex-direction:column;gap:8px}
.checklist li{display:flex;gap:10px;align-items:flex-start;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px 13px;font-size:.9rem}
pre.doc{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:18px;white-space:pre-wrap;font-family:var(--font);font-size:.9rem;line-height:1.6}
.footer{color:var(--dim);font-size:.85rem;border-top:1px solid var(--line);margin-top:70px;padding:30px 0}
@media(max-width:640px){.hero h1{font-size:2rem}}`;
const page = (title, body) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="ClaimPack — restoration contractors: turn job details into a carrier-ready claim documentation package with per-peril checklists, line items, photo log, and supplement tracking.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%230a545b'/><path d='M6 4h8l4 4v12H6z' fill='%237fd6de'/><path d='M9 12h6M9 15h6M9 9h3' stroke='%230a545b' stroke-width='1.6' stroke-linecap='round'/></svg>">
<style>${CSS}</style></head><body>
<nav><div class="wrap"><a class="logo" href="/"><span class="mark">📋</span>ClaimPack</a>
<div class="spacer"></div><a class="nl" href="/whitepaper">Whitepaper</a><a class="btn ghost small" href="/#start">New package</a></div></nav>
${body}
<div class="footer"><div class="wrap"><b style="color:var(--ink)">ClaimPack</b> — the documentation the adjuster can't argue with. Demo deployment: illustrative pricing; data may reset periodically; not insurance advice. <a href="/p/demo">See the demo package →</a></div></div></body></html>`;

const app = express();
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => res.send(page('ClaimPack — claim documentation for restoration contractors', `
<div class="hero"><div class="wrap">
<h1>Underdocumented claims get <em>underpaid.</em></h1>
<p>Restoration contractors lose thousands per job to denied line items and unpaid supplements — not because the work wasn't done, but because the file didn't prove it. ClaimPack assembles a carrier-ready documentation package: peril-specific evidence checklists, structured line items, photo log, and supplement tracking, on one shareable link.</p>
<a class="btn" href="#start" style="background:#7fd6de;color:#0a545b">Build a claim package</a> &nbsp; <a class="btn ghost" href="/p/demo" style="color:#fff">See a live package</a>
<div class="statrow">
<div><b>30%+</b><span>of supplement value commonly shaved or denied</span></div>
<div><b>4 perils</b><span>water, fire, storm, mold — each with its own evidence standard</span></div>
<div><b>1 link</b><span>adjuster sees everything, organized</span></div>
</div></div></div>
<div class="wrap">
<div class="kicker">How it works</div><h2 class="t">From job notes to adjuster-ready in minutes</h2>
<div class="grid">
<div class="panel"><h3>1 · Open a package</h3><p style="color:var(--dim)">Claim number, insured, carrier, peril, loss date — the header every adjuster looks for first.</p></div>
<div class="panel"><h3>2 · Add line items + evidence refs</h3><p style="color:var(--dim)">Structured scope lines with quantities, units, prices and photo references; supplements flagged separately so they don't torpedo the original scope.</p></div>
<div class="panel"><h3>3 · Send one link</h3><p style="color:var(--dim)">A clean, printable package the desk adjuster can approve without a single "please resend" email. The peril checklist shows your evidence is complete per IICRC-grade standards.</p></div>
</div>
<div class="kicker" id="start">Start now</div><h2 class="t">Open a claim package</h2>
<div class="panel" style="max-width:640px">
<form method="post" action="/packs">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px">
<div><label class="f">Your company</label><input name="contractor" required placeholder="BlueLine Restoration LLC"></div>
<div><label class="f">Claim #</label><input name="claim_no" placeholder="CLM-2026-…"></div>
<div><label class="f">Insured (name/ref)</label><input name="insured" required placeholder="Harris residence"></div>
<div><label class="f">Property address</label><input name="property" placeholder="482 Maplewood Dr…"></div>
<div><label class="f">Carrier</label><input name="carrier" placeholder="State Farm"></div>
<div><label class="f">Peril</label><select name="peril">${Object.entries(PERILS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div>
<div><label class="f">Date of loss</label><input type="date" name="loss_date"></div>
<div><label class="f">Inspection date</label><input type="date" name="inspected"></div>
</div>
<label class="f">Loss narrative</label><textarea name="narrative" placeholder="Source, migration path, mitigation timeline, discoveries on tear-out…"></textarea>
<p style="color:var(--dim);font-size:.85rem">You'll get a private editing link and a shareable package link. Free in beta; $79/mo per company after.</p>
<button class="btn">Create package</button></form></div></div>`)));

app.post('/packs', (req, res) => {
  const b = req.body;
  if (!b.contractor || !b.insured || !PERILS[b.peril]) return res.redirect('/');
  const slug = crypto.randomBytes(4).toString('hex');
  const key = crypto.randomBytes(8).toString('hex');
  q.newPack.run(slug, key, b.contractor.slice(0, 80), (b.claim_no || '').slice(0, 40), b.insured.slice(0, 80), (b.property || '').slice(0, 120), (b.carrier || '').slice(0, 60), b.peril, (b.loss_date || '').slice(0, 10), (b.inspected || '').slice(0, 10), (b.narrative || '').slice(0, 3000));
  res.redirect(`/p/${slug}?key=${key}`);
});

app.get('/p/:slug', (req, res) => {
  const p = q.bySlug.get(req.params.slug);
  if (!p) return res.status(404).send(page('Not found', `<div class="wrap" style="padding-top:40px"><div class="panel">Package not found. <a href="/">Home</a></div></div>`));
  const canEdit = req.query.key === p.edit_key || p.slug === 'demo';
  const items = q.items.all(p.id);
  const orig = items.filter(i => !i.supplement), supp = items.filter(i => i.supplement);
  const sum = (arr) => arr.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const peril = PERILS[p.peril];
  res.send(page(`${p.insured} · ClaimPack`, `
<div class="wrap" style="padding-top:36px;max-width:880px">
<div class="kicker">Claim documentation package</div>
<h2 class="t">${esc(p.insured)} — ${peril.label.toLowerCase()} loss</h2>
<p style="color:var(--dim)">${esc(p.contractor)} · Claim ${esc(p.claim_no) || '—'} · ${esc(p.carrier) || 'carrier TBD'} · Loss ${esc(p.loss_date) || '—'} · Inspected ${esc(p.inspected) || '—'}<br>
${esc(p.property)}${canEdit && p.slug !== 'demo' ? `<br><span class="tag amber">private editor link — keep the ?key= URL safe; share /p/${esc(p.slug)} without the key</span>` : ''}</p>
${p.narrative ? `<div class="panel"><h3>Loss narrative</h3><p style="color:var(--dim);margin:0">${esc(p.narrative)}</p></div>` : ''}
<div class="panel"><h3>Evidence checklist — ${peril.label}</h3>
<p style="color:var(--dim);font-size:.9rem">These are the items desk adjusters look for on ${peril.label.toLowerCase()} files. A package with all boxes evidenced rarely gets the "insufficient documentation" treatment:</p>
<ul class="checklist">${peril.checks.map(c => `<li>☐ &nbsp;${c}</li>`).join('')}</ul></div>
<div class="panel"><h3>Scope of work — original estimate <span class="tag teal">${usd(sum(orig))}</span></h3>
<table><tr><th>Area</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit $</th><th>Total</th><th>Photo/log ref</th></tr>
${orig.map(i => `<tr><td>${esc(i.area)}</td><td>${esc(i.description)}</td><td>${i.qty}</td><td>${esc(i.unit)}</td><td>${usd(i.unit_price)}</td><td><b>${usd(i.qty * i.unit_price)}</b></td><td style="color:var(--dim)">${esc(i.photo_ref)}</td></tr>`).join('') || '<tr><td colspan="7" style="color:var(--dim)">No line items yet.</td></tr>'}</table></div>
${supp.length || canEdit ? `<div class="panel"><h3>Supplement — discovered on tear-out <span class="tag amber">${usd(sum(supp))}</span></h3>
${supp.length ? `<table><tr><th>Area</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit $</th><th>Total</th><th>Photo/log ref</th></tr>
${supp.map(i => `<tr><td>${esc(i.area)}</td><td>${esc(i.description)}</td><td>${i.qty}</td><td>${esc(i.unit)}</td><td>${usd(i.unit_price)}</td><td><b>${usd(i.qty * i.unit_price)}</b></td><td style="color:var(--dim)">${esc(i.photo_ref)}</td></tr>`).join('')}</table>` : '<p style="color:var(--dim)">No supplement items.</p>'}
<p style="color:var(--dim);font-size:.85rem;margin-bottom:0">Supplements tracked separately with their own evidence references — the #1 way to keep discovered damage from being lumped in and denied.</p></div>` : ''}
${canEdit ? `<div class="panel"><h3>Add line item</h3>
<form method="post" action="/p/${esc(p.slug)}/items?key=${esc(req.query.key || (p.slug === 'demo' ? 'demo-key' : ''))}" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
<div style="min-width:110px"><label class="f">Area</label><input name="area" required placeholder="Kitchen"></div>
<div style="flex:2;min-width:180px"><label class="f">Description</label><input name="description" required></div>
<div style="width:75px"><label class="f">Qty</label><input name="qty" type="number" step="0.1" value="1"></div>
<div style="width:80px"><label class="f">Unit</label><input name="unit" value="EA"></div>
<div style="width:95px"><label class="f">Unit $</label><input name="unit_price" type="number" step="0.01" value="0"></div>
<div style="width:110px"><label class="f">Photo ref</label><input name="photo_ref" placeholder="IMG_0162"></div>
<div><label class="f">Supplement?</label><select name="supplement"><option value="0">No</option><option value="1">Yes</option></select></div>
<button class="btn">Add</button></form></div>` : ''}
<div class="panel"><h3>Package summary <span class="tag green">${usd(sum(items))}</span></h3>
<p style="color:var(--dim);margin:0">Original scope ${usd(sum(orig))} + supplements ${usd(sum(supp))}. Print this page (⌘P) to attach to the carrier file, or share this link with the adjuster directly.</p></div>
</div>`));
});

app.post('/p/:slug/items', (req, res) => {
  const p = q.bySlug.get(req.params.slug);
  const canEdit = p && (req.query.key === p.edit_key || p.slug === 'demo');
  if (canEdit && req.body.area && req.body.description) {
    q.addItem.run(p.id, req.body.area.slice(0, 60), req.body.description.slice(0, 160), Math.max(parseFloat(req.body.qty) || 1, 0.1), (req.body.unit || 'EA').slice(0, 10), Math.max(parseFloat(req.body.unit_price) || 0, 0), (req.body.photo_ref || '').slice(0, 40), req.body.supplement === '1' ? 1 : 0);
  }
  res.redirect(`/p/${req.params.slug}${req.query.key ? '?key=' + req.query.key : ''}`);
});

const WHITEPAPER = `CLAIMPACK — WHITEPAPER
Claim documentation for the contractors who rebuild after disaster · July 2026

THE PROBLEM
The US restoration industry (~$80B: water, fire, storm, mold) gets paid almost entirely through insurance claims — and payment quality tracks documentation quality, not work quality. Desk adjusters deny or shave line items that lack photo references, moisture logs, or per-peril evidence; supplements (damage discovered on tear-out) are the most commonly reduced category, with contractors routinely reporting 30%+ haircuts on supplement value. The tooling gap is stark: estimating platforms (Xactimate) price the work, and a cottage industry of human "supplement services" exists precisely because contractors' claim files are chaos — photos in one phone, dry-logs on paper, scope in a PDF, narrative in an email thread.

THE SOLUTION
ClaimPack assembles the file the adjuster actually wants: a claim header (insured, carrier, peril, dates); a loss narrative; peril-specific evidence checklists encoding IICRC-grade documentation standards (moisture readings per room for water; test squares for hail; containment photos for mold); structured line items with quantities, units, prices, and photo/log references; and supplements tracked separately with their own evidence — the single best defense against lump-and-deny. Everything lives on one shareable, printable link. Production adds photo upload with auto-referencing, Xactimate ESX import, and LLM-drafted supplement justification letters.

WHY NOW
Climate volatility keeps catastrophe volume rising while carriers push harder on claim cost control — 2024-26 saw carriers systematize line-item review with their own AI. Contractors need symmetric weaponry: complete, structured, evidence-linked files. Nobody owns this wedge: estimating tools stop at pricing; job-management suites (ServiceTitan-class) aren't claim-native; supplement services are $150/claim humans.

MARKET
Tens of thousands of US restoration contractors (franchise networks alone: Servpro ~2,200, ServiceMaster ~1,900, plus thousands of independents). At $79-$199/mo the direct market supports $50M+ ARR, expanding into roofing/storm contractors and public adjusters.

BUSINESS MODEL
$79/mo per company (packages + checklists + share links), $199/mo pro (photo management, ESX import, supplement letters). Channel: restoration franchises, IICRC training networks, supplement-service partnerships.

SOURCES
- Claim Supplement Pro: supplement practice and denial patterns: claimsupplementpro.com/insurance-claim-supplements
- Docusketch (2026): reading Xactimate estimates: docusketch.com/post/how-to-read-an-xactimate-estimate
- CapOut (2026): restoration software landscape: capout.ai/resources/compare/best-insurance-restoration-software`;

app.get('/whitepaper', (req, res) => res.send(page('Whitepaper · ClaimPack', `<div class="wrap" style="padding-top:36px;max-width:760px"><div class="panel"><pre class="doc">${esc(WHITEPAPER)}</pre></div></div>`)));
app.use((req, res) => res.status(404).send(page('Not found', `<div class="wrap" style="padding-top:60px"><div class="panel">Page not found. <a href="/">Home</a></div></div>`)));

if (require.main === module) app.listen(process.env.PORT || 3015, () => console.log('ClaimPack on :' + (process.env.PORT || 3015)));
module.exports = app;
