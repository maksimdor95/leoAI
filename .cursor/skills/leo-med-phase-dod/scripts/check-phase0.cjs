#!/usr/bin/env node
/**
 * LEO Med Phase 0 data gate (roles + sources).
 * Exit 0 = PASS, 1 = FAIL. Does not check feature-flag wiring or Jack isolation.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../../../services/job-matching/src/services/data/med');
const rolesPath = path.join(root, 'med_roles.json');
const sourcesPath = path.join(root, 'med_sources.json');

const WIFE_TG = [
  'superjob_medicina',
  'rabota_mediki',
  'rabota_medsestra',
  'Rabotat_v_meditsina1',
  'Med_Job_4_you',
  'csorglaborantmladpersonal',
  'job_in_med',
  'job_in_zdrav',
  'hh_vacancy_medicine',
  'med_vacancy',
  'rehabilitation_vacancies',
  'medsmena',
];

const BOARDS = ['hh.ru', 'superjob.ru', 'rabota.ru', 'zarplata.ru', 'avito_jobs'];
const DISCOVERY = ['trudvsem.ru', 'emed.market'];

function fail(msg, gaps) {
  console.error('FAIL:', msg);
  for (const g of gaps) console.error(' -', g);
  process.exit(1);
}

if (!fs.existsSync(rolesPath) || !fs.existsSync(sourcesPath)) {
  fail('missing med data files', [rolesPath, sourcesPath].filter((p) => !fs.existsSync(p)));
}

const roles = JSON.parse(fs.readFileSync(rolesPath, 'utf8'));
const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
const gaps = [];

const byLevel = { doctor: 0, mid: 0, junior: 0 };
const refs = new Set();
let junior434 = 0;
let extended = 0;
for (const r of roles.roles || []) {
  byLevel[r.level] = (byLevel[r.level] || 0) + 1;
  refs.add(r.nomenclature_ref);
  if (!r.id || !r.title) gaps.push(`role missing id/title: ${JSON.stringify(r)}`);
  if (String(r.nomenclature_ref || '').startsWith('12.')) junior434 += 1;
  if (String(r.nomenclature_ref || '').startsWith('ext:')) extended += 1;
}

for (let i = 1; i <= 124; i++) {
  if (!refs.has(`5.1.${i}`)) gaps.push(`missing doctor ref 5.1.${i}`);
}
if (!refs.has('5.2')) gaps.push('missing doctor ref 5.2');
for (let i = 1; i <= 10; i++) {
  if (!refs.has(`6.${i}`)) gaps.push(`missing mid ref 6.${i}`);
}
for (let i = 1; i <= 57; i++) {
  if (!refs.has(`9.${i}`)) gaps.push(`missing mid ref 9.${i}`);
}
for (let i = 1; i <= 4; i++) {
  if (!refs.has(`12.${i}`)) gaps.push(`missing junior ref 12.${i}`);
}

if (byLevel.doctor < 120) gaps.push(`doctor count low: ${byLevel.doctor}`);
if (byLevel.mid < 60) gaps.push(`mid count low: ${byLevel.mid}`);
if (junior434 !== 4) gaps.push(`434н junior (12.*) count: ${junior434} (want 4)`);
if (byLevel.junior < 4) gaps.push(`junior total low: ${byLevel.junior}`);
if (extended < 30) gaps.push(`ext:* roles low: ${extended} (want pharma/leadership/extras)`);

// Required v1 extensions
for (const id of [
  'doctor_provizor',
  'mid_farmacevt',
  'doctor_glavnyj_vrach',
  'junior_sidelka',
  'junior_sanitar_voditel',
]) {
  if (!(roles.roles || []).some((r) => r.id === id)) gaps.push(`missing extended role ${id}`);
}

if (!String(roles.source?.title || '').includes('434н')) {
  gaps.push('roles.source.title should cite 434н');
}

const sourceIds = new Set((sources.sources || []).map((s) => s.id));
const tgUsers = new Set(
  (sources.sources || []).filter((s) => s.type === 'tg').map((s) => s.username)
);

for (const id of BOARDS) {
  if (!sourceIds.has(id)) gaps.push(`missing board ${id}`);
}
for (const id of DISCOVERY) {
  if (!sourceIds.has(id)) gaps.push(`missing discovery ${id}`);
}
for (const u of WIFE_TG) {
  if (!tgUsers.has(u)) gaps.push(`missing TG @${u}`);
}

const notPlanned = (sources.sources || []).filter(
  (s) => !['planned', 'active', 'paused'].includes(s.status)
);
if (notPlanned.length) {
  gaps.push(
    `invalid status: ${notPlanned.map((s) => s.id + '=' + s.status).join(', ')}`
  );
}

if (gaps.length) fail('Phase 0 data gate', gaps);

console.log('PASS Phase 0 data gate', {
  doctors: byLevel.doctor,
  mid: byLevel.mid,
  junior: byLevel.junior,
  junior434,
  extended,
  sources: sources.sources.length,
  tg: tgUsers.size,
});
process.exit(0);
