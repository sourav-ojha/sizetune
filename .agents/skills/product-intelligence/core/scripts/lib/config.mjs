import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Tiny JSON-schema subset validator: type, enum, required, properties,
// additionalProperties (bool|schema), minimum, minProperties.
export function validateSchema(value, schema, at = '$') {
  const errs = [];
  const types = schema.type ? [].concat(schema.type) : null;
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  if (types && !types.some((t) => t === actual || (t === 'number' && actual === 'integer'))) {
    return [`${at}: expected ${types.join('|')}, got ${actual}`];
  }
  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) errs.push(`${at}: "${String(value).slice(0, 40)}" does not match ${schema.pattern}`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: "${value}" not in [${schema.enum.join(', ')}]`);
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) errs.push(`${at}: ${value} < minimum ${schema.minimum}`);
  if (actual === 'object') {
    const keys = Object.keys(value);
    if (schema.minProperties && keys.length < schema.minProperties) errs.push(`${at}: needs at least ${schema.minProperties} properties`);
    for (const r of schema.required || []) if (!(r in value)) errs.push(`${at}: missing required "${r}"`);
    for (const k of keys) {
      const sub = schema.properties?.[k];
      if (sub) errs.push(...validateSchema(value[k], sub, `${at}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${at}: unknown key "${k}"`);
      else if (typeof schema.additionalProperties === 'object') errs.push(...validateSchema(value[k], schema.additionalProperties, `${at}.${k}`));
    }
  }
  return errs;
}

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

// Recursive merge for plain objects; arrays and scalars are replaced.
function mergeConfig(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = isObj(v) && isObj(base[k]) ? mergeConfig(base[k], v) : v;
  return out;
}

export function loadConfig(projectDir) {
  const defaults = readJson(path.join(CORE_DIR, 'config.default.json'));
  const schema = readJson(path.join(CORE_DIR, 'schemas', 'config.schema.json'));
  const errors = [];
  let user = {};
  if (projectDir) {
    const p = path.join(projectDir, '.product', 'config.json');
    if (fs.existsSync(p)) {
      try {
        user = readJson(p);
        errors.push(...validateSchema(user, schema).map((e) => `.product/config.json ${e}`));
      } catch (e) {
        errors.push(`.product/config.json is not valid JSON: ${e.message}`);
        user = {};
      }
    }
  }
  const config = mergeConfig(defaults, user);
  // A custom criteria set replaces the defaults entirely (it defines the rubric); other sections merge.
  if (isObj(user.scoring?.criteria)) config.scoring.criteria = { ...user.scoring.criteria };
  for (const k of Object.keys(config.scoring.criteria)) if (!/^[a-z][a-z0-9_]*$/.test(k)) errors.push(`scoring.criteria key '${k}' must match [a-z][a-z0-9_]*`);
  const w = Object.values(config.scoring.criteria);
  if (!(w.reduce((a, b) => a + b, 0) > 0)) errors.push('scoring.criteria weights must sum to more than 0');
  if (config.scoring.tiers.consider_min > config.scoring.tiers.recommend_min) errors.push('scoring.tiers.consider_min must be <= recommend_min');
  return { config, errors, defaults };
}
