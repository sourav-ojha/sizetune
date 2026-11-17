const CONF_RANK = { Low: 0, Medium: 1, High: 2 };

// Parse "user_value=5, strategic_alignment=4" (also accepts ":" and whitespace separators).
export function parseRatings(line) {
  const out = {};
  for (const m of line.matchAll(/([a-z][a-z0-9_]*)\s*[=:]\s*(\d+(?:\.\d+)?)/g)) out[m[1]] = Number(m[2]);
  return out;
}

export function computeScore(ratings, config) {
  const { criteria, scale_max: max } = config.scoring;
  const errors = [];
  let total = 0;
  let weightSum = 0;
  for (const [k, w] of Object.entries(criteria)) {
    const r = ratings[k];
    if (r === undefined) { errors.push(`missing rating for "${k}"`); continue; }
    if (!Number.isInteger(r) || r < 1 || r > max) { errors.push(`rating "${k}"=${r} must be an integer 1-${max}`); continue; }
    total += (r / max) * w;
    weightSum += w;
  }
  for (const k of Object.keys(ratings)) if (!(k in criteria)) errors.push(`unknown criterion "${k}"`);
  if (errors.length) return { score: null, errors };
  return { score: Math.round((total / weightSum) * 1000) / 10, errors };
}

// A high score with weak evidence must not become a recommendation.
export function computeTier(score, confidence, config) {
  const { tiers, min_confidence_for_recommend: minConf } = config.scoring;
  if (score === null || score === undefined || Number.isNaN(score)) return 'Unscored';
  const conf = CONF_RANK[confidence];
  if (conf === undefined) return 'Unscored';
  if (score >= tiers.recommend_min) {
    return conf >= CONF_RANK[minConf] ? 'Recommend' : 'Needs evidence';
  }
  if (score >= tiers.consider_min) return conf === 0 ? 'Needs evidence' : 'Consider';
  return 'Backlog';
}
