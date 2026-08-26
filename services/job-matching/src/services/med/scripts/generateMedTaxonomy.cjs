#!/usr/bin/env node
/**
 * Parse docs/med/taxonomy_meditsina_rf.md → services/.../data/med/med_taxonomy.json
 * LEO Med Phase 2.
 */
const fs = require('fs');
const path = require('path');

// .../services/job-matching/src/services/med/scripts/generateMedTaxonomy.cjs
const JM_ROOT = path.resolve(__dirname, '../../../..'); // services/job-matching
const REPO_ROOT = path.resolve(JM_ROOT, '../..');
const SRC_MD = path.join(REPO_ROOT, 'docs/med/taxonomy_meditsina_rf.md');
const OUT_JSON = path.join(JM_ROOT, 'src/services/data/med/med_taxonomy.json');
const ROLES_JSON = path.join(JM_ROOT, 'src/services/data/med/med_roles.json');

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/[-–—_/.,;:()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function layerToLevel(layer) {
  const l = (layer || '').toLowerCase();
  if (l.includes('высш')) return 'doctor';
  if (l.includes('средн')) return 'mid';
  if (l.includes('общ')) return 'junior';
  return null;
}

function parseItemLine(line, kind) {
  // - T01 [ядро] — Label
  const m = line.match(/^-\s*([A-ZА-Я]{1,4}\d+[A-ZА-Я]?)\s*(\[ядро\])?\s*[—–-]\s*(.+)$/i);
  if (!m) return null;
  return {
    id: m[1].toUpperCase().replace(/Ё/g, 'Е'),
    label: m[3].trim(),
    kind,
    core: Boolean(m[2]),
  };
}

function parseProfessionBlock(block, layerHeading) {
  const titleMatch = block.match(/^###\s+(.+)$/m);
  if (!titleMatch) return null;
  const source_title = titleMatch[1].trim();

  const meta = {};
  for (const row of block.matchAll(/\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]+)\|/g)) {
    meta[row[1].trim()] = row[2].trim();
  }

  const layer = meta['Слой'] || layerHeading || '';
  const family = meta['Семейство'] || '';
  const specialty = meta['Специальность (номенклатура)'] || '';
  const aliasesRaw = meta['Доп. варианты названий'] || '';
  const aliases = aliasesRaw
    ? aliasesRaw.split(/;|,/).map((s) => s.trim()).filter(Boolean)
    : [];

  const sections = {
    skills: { heading: 'Навыки', kind: 'skill', ids: [], items: [] },
    tasks: { heading: 'Задачи', kind: 'task', ids: [], items: [] },
    duties: { heading: 'Обязанности', kind: 'duty', ids: [], items: [] },
  };

  for (const key of Object.keys(sections)) {
    const h = sections[key].heading;
    const re = new RegExp(`####\\s+${h}\\s*\\n([\\s\\S]*?)(?=\\n####|\\n---|\\n###|$)`);
    const sm = block.match(re);
    if (!sm) continue;
    const body = sm[1];
    for (const line of body.split('\n')) {
      const item = parseItemLine(line.trim(), sections[key].kind);
      if (!item) continue;
      sections[key].items.push(item);
      sections[key].ids.push(item.id);
    }
  }

  return {
    source_title,
    layer,
    level: layerToLevel(layer),
    family,
    specialty,
    aliases,
    skill_ids: [...new Set(sections.skills.ids)],
    task_ids: [...new Set(sections.tasks.ids)],
    duty_ids: [...new Set(sections.duties.ids)],
    qualification_ids: [],
    _items: [...sections.skills.items, ...sections.tasks.items, ...sections.duties.items],
  };
}

function matchMedRoleId(sourceTitle, aliases, roles, preferredLevel) {
  const sourceNorm = normalize(sourceTitle);
  const candidates = [sourceTitle, ...aliases].map(normalize).filter(Boolean);
  let best = null;

  for (const role of roles) {
    const levelBonus = preferredLevel && role.level === preferredLevel ? 50 : 0;
    const levelPenalty =
      preferredLevel && role.level && role.level !== preferredLevel ? -40 : 0;
    const needles = [role.title, ...(role.aliases || [])].map(normalize);
    const roleTitleNorm = normalize(role.title);

    for (const cand of candidates) {
      const isPrimary = cand === sourceNorm;
      for (const needle of needles) {
        if (!needle || needle.length < 5) continue;
        let score = 0;
        if (cand === needle) score = 100;
        else if (isPrimary && needle.startsWith(cand + ' ') && cand.length >= 10) score = 70;
        else if (isPrimary && needle.startsWith(cand) && cand.length >= 10) score = 65;
        else if (cand.startsWith(needle) && needle.length >= 14) score = 80;
        else if (isPrimary && cand.includes(needle) && needle.length >= 14) {
          score = 60 + Math.min(15, needle.length);
        } else continue;

        score += levelBonus + levelPenalty;
        if (isPrimary) score += 30;
        // Prefer role whose main title equals the taxonomy source title
        if (roleTitleNorm === sourceNorm) score += 40;
        // Prefer shorter role titles when matching a short generic source (медсестра vs старшая…)
        if (isPrimary && cand === needle) score += Math.max(0, 40 - needle.length);

        if (!best || score > best.score) {
          best = { med_role_id: role.id, score };
        }
      }
    }
  }
  return best && best.score >= 70 ? best : { med_role_id: null, score: 0 };
}

function main() {
  if (!fs.existsSync(SRC_MD)) {
    console.error('Missing', SRC_MD);
    process.exit(1);
  }
  const md = fs.readFileSync(SRC_MD, 'utf8');
  const rolesCatalog = JSON.parse(fs.readFileSync(ROLES_JSON, 'utf8'));

  const layerChunks = md.split(/\n(?=## )/);
  const dictionary = {};
  const roles = [];
  let currentLayer = '';

  for (const chunk of layerChunks) {
    const layerMatch = chunk.match(/^##\s+(.+)$/m);
    if (layerMatch) {
      const name = layerMatch[1].trim();
      if (/содержание/i.test(name)) continue;
      if (/слой/i.test(name)) currentLayer = name.replace(/\s*слой\s*/i, '').trim() || name;
    }

    const blocks = chunk.split(/\n(?=### )/).slice(1);
    for (const block of blocks) {
      const prof = parseProfessionBlock('### ' + block.replace(/^###\s*/, ''), currentLayer);
      if (!prof) continue;

      for (const item of prof._items) {
        const existing = dictionary[item.id];
        if (!existing) {
          dictionary[item.id] = {
            id: item.id,
            label: item.label,
            kind: item.kind,
            core: item.core,
          };
        } else if (item.kind === 'duty' && existing.kind === 'task') {
          // Prefer duty label when same code used for both
          existing.kind = 'duty';
        } else if (item.kind === 'skill') {
          existing.kind = 'skill';
        }
      }

      const match = matchMedRoleId(
        prof.source_title,
        prof.aliases,
        rolesCatalog.roles,
        prof.level
      );
      roles.push({
        source_title: prof.source_title,
        layer: prof.layer,
        level: prof.level,
        family: prof.family,
        specialty: prof.specialty,
        aliases: prof.aliases,
        skill_ids: prof.skill_ids,
        duty_ids: prof.duty_ids.length ? prof.duty_ids : prof.task_ids,
        task_ids: prof.task_ids,
        qualification_ids: [],
        med_role_id: match.med_role_id,
        provenance: 'official',
        source_refs: [
          'ESCO',
          'профстандарты Минтруда (область 02 / 475н / 2н / 470н)',
          'номенклатуры 700н, 176н, 1183н',
          'docs/med/taxonomy_meditsina_rf.md',
        ],
      });
    }
  }

  const mapped = roles.filter((r) => r.med_role_id).length;
  const out = {
    version: 1,
    generated_at: new Date().toISOString().slice(0, 10),
    notes:
      'LEO Med Phase 2. Shared dictionary + per-role id lists. Qualifications empty until official/vacancy gap-fill. Not a substitute for Минздрав requirements when mixed provenance.',
    disclaimer:
      'Таксономия собрана из официальных и открытых источников (ESCO, профстандарты, номенклатуры). Не является юридически значимым перечнем требований Минздрава. Пробелы по квалификациям заполняются отдельно (vacancy_parse / llm_draft).',
    provenance_default: 'official',
    stats: {
      professions: roles.length,
      dictionary_size: Object.keys(dictionary).length,
      mapped_to_med_role: mapped,
      unmapped: roles.length - mapped,
    },
    dictionary,
    roles,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote', OUT_JSON);
  console.log(out.stats);
}

main();
