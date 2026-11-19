// Config and a tiny JSON-schema subset validator for growth-strategy. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Supported keywords: type, enum, const, required, properties, additionalProperties (bool|schema), items,
// minimum, maximum, minLength, maxLength, minItems, pattern, $ref ("#/$defs/name").
export function validateSchema(value, schema, at = '$', root = schema) {
  if (schema.$ref) schema = root.$defs[schema.$ref.replace('#/$defs/', '')];
  const errs = [];
  const types = schema.type ? [].concat(schema.type) : null;
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  if (types && !types.some((t) => t === actual || (t === 'number' && actual === 'integer'))) return [`${at}: expected ${types.join('|')}, got ${actual}`];
  if (schema.const !== undefined && value !== schema.const) errs.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: "${value}" not in [${schema.enum.join(', ')}]`);
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${at}: "${value.slice(0, 40)}" does not match ${schema.pattern}`);
    if (schema.minLength !== undefined && value.length < schema.minLength) errs.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errs.push(`${at}: longer than ${schema.maxLength}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${at}: ${value} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${at}: ${value} > maximum ${schema.maximum}`);
  }
  if (actual === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${at}: needs at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((v, i) => errs.push(...validateSchema(v, schema.items, `${at}[${i}]`, root)));
  }
  if (actual === 'object') {
    for (const r of schema.required || []) if (!(r in value)) errs.push(`${at}: missing required "${r}"`);
    for (const k of Object.keys(value)) {
      const sub = schema.properties?.[k];
      if (sub) errs.push(...validateSchema(value[k], sub, `${at}.${k}`, root));
      else if (schema.additionalProperties === false) errs.push(`${at}: unknown key "${k}"`);
      else if (typeof schema.additionalProperties === 'object') errs.push(...validateSchema(value[k], schema.additionalProperties, `${at}.${k}`, root));
    }
  }
  return errs;
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return out;
}

// projectDir null = defaults only (used for user-scope agent installs and adapter generation).
export function loadConfig(projectDir) {
  const defaults = readJson(path.join(CORE_DIR, 'config.default.json'));
  const schema = readJson(path.join(CORE_DIR, 'schemas', 'config.schema.json'));
  const errors = [];
  let user = {};
  if (projectDir) {
    const p = path.join(projectDir, '.growth', 'config.json');
    if (fs.existsSync(p)) {
      try { user = readJson(p); errors.push(...validateSchema(user, schema).map((e) => `.growth/config.json ${e}`)); } catch (e) { errors.push(`.growth/config.json is not valid JSON: ${e.message}`); user = {}; }
    }
  }
  return { config: merge(defaults, user), errors, defaults };
}
