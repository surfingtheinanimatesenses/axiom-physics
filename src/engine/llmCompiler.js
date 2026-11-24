/**
 * AXIOM // 2D Live Groq Physical Law Compiler
 * Directly translates natural language physics prompts into validated JSON AST rules.
 * Hardened with multi-tier prompt injection defense & schema sanitization.
 */

export const GROQ_MODELS = {
  primary: 'openai/gpt-oss-120b',
  fallback: 'openai/gpt-oss-20b',
};

// Known Prompt Injection & Jailbreak Signatures (Pre-Flight Barrier)
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|existing)\s+(instructions|directives|prompts|rules|system)/i,
  /disregard\s+(all\s+)?(previous|prior|above|existing)/i,
  /you\s+are\s+now\s+(a|an|in|acting)/i,
  /\b(dan|jailbreak|developer\s+mode|unrestricted\s+mode|chaos\s+mode)\b/i,
  /\b(system\s+prompt|system\s+directive|initial\s+prompt)\b/i,
  /\bprint\s+(the\s+)?(system|initial|base)\s+prompt\b/i,
  /\brepeat\s+(the\s+)?(above|instructions|rules)\b/i,
  /\bact\s+as\s+(an?|my|a\s+helpful)\b/i,
  /<script\b/i,
  /javascript:/i,
  /\b(exec|eval)\s*\(/i,
  /\bdrop\s+table\b/i,
];

/**
 * Pre-flight Input Guardrail:
 * Checks input length and detects actual prompt injection or jailbreak attempts
 * before sending to the LLM.
 *
 * @param {string} prompt
 */
export function validatePromptGuardrails(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('GUARDRAIL_REJECTED: Empty or invalid input string');
  }

  const trimmed = prompt.trim();

  // 1. Length cap: Prevent token-stuffing attacks
  if (trimmed.length > 300) {
    throw new Error('GUARDRAIL_REJECTED: Input exceeds 300 character limit');
  }

  // 2. Minimum length
  if (trimmed.length < 3) {
    throw new Error('GUARDRAIL_REJECTED: Input too short to specify physical law');
  }

  // 3. Prompt Injection Pattern Matching
  for (let i = 0; i < INJECTION_PATTERNS.length; i++) {
    if (INJECTION_PATTERNS[i].test(trimmed)) {
      throw new Error('GUARDRAIL_REJECTED: Malicious instruction or prompt injection detected');
    }
  }

  return true;
}

export const SYSTEM_PROMPT = `You are the AXIOM-2D physics law compiler. You compile natural language physical laws into a strictly validated JSON AST for a 2D rigid-body simulation engine.

CRITICAL DIRECTIVES:
- You are strictly a 2D physics compiler. Always map the user's physical ideas, mechanics, and metaphors into the closest combination of the 6 available schemas:
  1. set_gravity:
     { "type": "set_gravity", "x": number (-5 to 5), "y": number (-5 to 5), "flipEveryMs": number (>=200) | null }
  2. mutate_bodies:
     { "type": "mutate_bodies", "filter": { "color": "red"|"blue"|"green"|"gold"|"all", "shape": "box"|"circle"|"triangle"|"all" }, "restitution": number (0 to 2), "frictionAir": number (0 to 0.2), "scale": number (0.2 to 3.0) }
  3. radial_force:
     { "type": "radial_force", "sourceColor": "red"|"blue"|"green"|"gold"|"all", "targetColor": "red"|"blue"|"green"|"gold"|"all", "strength": number (-0.004 to 0.004) }
     Note: Positive strength = attraction (pull); Negative strength = repulsion (push away, electrostatic/magnetic repulsion).
  4. on_collision:
     { "type": "on_collision", "colorA": "red"|"blue"|"green"|"gold"|"all", "colorB": "red"|"blue"|"green"|"gold"|"all", "action": "explode"|"spawn_sparks"|"destroy_b"|"turn_gold" }
  5. spawn_wave:
     { "type": "spawn_wave", "shape": "box"|"circle"|"triangle", "color": "red"|"blue"|"green"|"gold", "count": integer (1 to 25) }
  6. set_medium:
     { "type": "set_medium", "medium": "air"|"oil", "viscosity": number (0.1 to 1.0) }
  7. set_phenomenon:
     { "type": "set_phenomenon", "phenomenon": "gargantua"|"wormhole"|"magnetar"|"none" }

Enums:
Colors: "red", "blue", "green", "gold", "all"
Shapes: "box", "circle", "triangle", "all"
Actions: "explode", "spawn_sparks", "destroy_b", "turn_gold"
Mediums: "air", "oil"
Phenomena: "gargantua", "wormhole", "magnetar", "none"

Creative Physics Mapping Examples:
- "gargantua black hole / interstellar gravitational lensing" -> set_phenomenon (phenomenon: "gargantua"), set_gravity (x: 0, y: 0.05)
- "endurance wormhole / einstein-rosen bridge" -> set_phenomenon (phenomenon: "wormhole"), set_gravity (x: 0, y: 0)
- "magnetar pulsar / synchrotron radiation" -> set_phenomenon (phenomenon: "magnetar"), set_gravity (x: 0, y: 0.05)
- "make them electronically charged" -> radial_force with strength: -0.0025 (electrostatic repulsion between shapes)
- "magnetic pull between red and gold" -> radial_force with sourceColor: "gold", targetColor: "red", strength: 0.003
- "submerge in thick motor oil" / "Castrol motor oil" -> set_medium with medium: "oil", viscosity: 0.88
- "drain oil / back to air" -> set_medium with medium: "air", viscosity: 0.85
- "super bouncy pinball" -> mutate_bodies with restitution: 1.15
- "anti-gravity float" -> set_gravity with x: 0, y: -0.2
- "sticky surfaces" -> mutate_bodies with frictionAir: 0.06, restitution: 0.1

Output MUST be a valid JSON object matching this exact shape:
{
  "summary": "3-5 WORD UPPERCASE TITLE",
  "rules": [
    { "type": "...", ... }
  ]
}

Never output dynamic JavaScript or markdown code blocks. Always map creative metaphors to the closest physical forces and properties.`;

/**
 * Retrieves the stored Groq API key strictly from the user's browser localStorage.
 * Never bakes or bundles static secrets into client build artifacts.
 */
export function getStoredApiKey() {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('axiom_groq_api_key');
    if (local && local.trim().startsWith('gsk_')) {
      return local.trim();
    }
  }

  return '';
}

/**
 * Returns whether an API key is currently configured without exposing the key string.
 */
export function hasConfiguredApiKey() {
  const k = getStoredApiKey();
  return Boolean(k && k.startsWith('gsk_'));
}

/**
 * Persists the Groq API key in localStorage.
 */
export function setStoredApiKey(key) {
  if (typeof window !== 'undefined') {
    if (key && key.trim()) {
      localStorage.setItem('axiom_groq_api_key', key.trim());
    } else {
      localStorage.removeItem('axiom_groq_api_key');
    }
  }
}

/**
 * Normalizes color aliases into supported engine colors.
 */
function normalizeColor(c) {
  if (!c || typeof c !== 'string') return 'all';
  const lower = c.toLowerCase().trim();
  if (lower === 'yellow' || lower === 'amber' || lower === 'gold') return 'gold';
  if (lower === 'white' || lower === 'any' || lower === '*' || lower === 'all') return 'all';
  if (['red', 'blue', 'green', 'gold'].includes(lower)) return lower;
  return 'all';
}

/**
 * Normalizes shape aliases into supported engine shapes.
 */
function normalizeShape(s) {
  if (!s || typeof s !== 'string') return 'all';
  const lower = s.toLowerCase().trim();
  if (lower === 'square' || lower === 'rectangle' || lower === 'block' || lower === 'box') return 'box';
  if (lower === 'circle' || lower === 'ball' || lower === 'sphere') return 'circle';
  if (lower === 'triangle' || lower === 'poly' || lower === 'polygon') return 'triangle';
  if (['box', 'circle', 'triangle', 'all'].includes(lower)) return lower;
  return 'all';
}

/**
 * Strict sanitizer that validates types, clamps numeric bounds,
 * normalizes nested LLM formats, and drops malformed rule objects before passing to ruleEngine.
 * @param {Array<Object>} rawRules
 * @returns {Array<Object>}
 */
export function sanitizeRules(rawRules) {
  if (!Array.isArray(rawRules)) return [];

  const sanitized = [];
  const spawnShapes = ['box', 'circle', 'triangle'];
  const spawnColors = ['red', 'blue', 'green', 'gold'];
  const validActions = ['explode', 'spawn_sparks', 'destroy_b', 'turn_gold'];

  for (let i = 0; i < rawRules.length; i++) {
    const rawItem = rawRules[i];
    if (!rawItem || typeof rawItem !== 'object') continue;

    // Normalize nested formats e.g. { "radial_force": { ... } } or { type: "radial_force", ... }
    let type = rawItem.type;
    let item = rawItem;

    if (!type) {
      for (const candidate of ['set_gravity', 'mutate_bodies', 'radial_force', 'on_collision', 'spawn_wave', 'set_medium', 'set_phenomenon']) {
        if (rawItem[candidate] && typeof rawItem[candidate] === 'object') {
          type = candidate;
          item = { ...rawItem[candidate], type: candidate };
          break;
        }
      }
    }

    switch (type) {
      case 'set_gravity': {
        const x = typeof item.x === 'number' ? Math.max(-5, Math.min(5, item.x)) : 0;
        const y = typeof item.y === 'number' ? Math.max(-5, Math.min(5, item.y)) : 0.8;
        let flipEveryMs = null;
        if (typeof item.flipEveryMs === 'number' && item.flipEveryMs >= 200) {
          flipEveryMs = Math.round(item.flipEveryMs);
        }
        sanitized.push({
          type: 'set_gravity',
          label: item.label || `GRAVITY (${x.toFixed(1)}, ${y.toFixed(1)})${flipEveryMs ? ` @ ${flipEveryMs}MS` : ''}`,
          x,
          y,
          flipEveryMs,
        });
        break;
      }

      case 'mutate_bodies': {
        const filter = item.filter || {};
        const color = normalizeColor(filter.color || item.color);
        const shape = normalizeShape(filter.shape || item.shape);
        const restitution = typeof item.restitution === 'number' ? Math.max(0, Math.min(2.0, item.restitution)) : 0.4;
        const frictionAir = typeof item.frictionAir === 'number' ? Math.max(0, Math.min(0.2, item.frictionAir)) : 0.01;
        const scale = typeof item.scale === 'number' ? Math.max(0.2, Math.min(3.0, item.scale)) : 1.0;

        sanitized.push({
          type: 'mutate_bodies',
          label: item.label || `MUTATE [${color.toUpperCase()}/${shape.toUpperCase()}] e=${restitution.toFixed(2)}`,
          filter: { color, shape },
          restitution,
          frictionAir,
          scale,
        });
        break;
      }

      case 'radial_force': {
        const sourceColor = normalizeColor(item.sourceColor);
        const targetColor = normalizeColor(item.targetColor);
        const strength = typeof item.strength === 'number' ? Math.max(-0.004, Math.min(0.004, item.strength)) : -0.0025;

        sanitized.push({
          type: 'radial_force',
          label: item.label || `FORCE ${sourceColor.toUpperCase()} → ${targetColor.toUpperCase()} (${(strength * 1000).toFixed(1)}mN)`,
          sourceColor,
          targetColor,
          strength,
        });
        break;
      }

      case 'on_collision': {
        const colorA = normalizeColor(item.colorA);
        const colorB = normalizeColor(item.colorB);
        const action = validActions.includes(item.action) ? item.action : 'explode';

        sanitized.push({
          type: 'on_collision',
          label: item.label || `COLLIDE [${colorA.toUpperCase()} + ${colorB.toUpperCase()}] → ${action.toUpperCase()}`,
          colorA,
          colorB,
          action,
        });
        break;
      }

      case 'spawn_wave': {
        const shapeCandidate = normalizeShape(item.shape);
        const shape = spawnShapes.includes(shapeCandidate) ? shapeCandidate : 'box';
        const colorCandidate = normalizeColor(item.color);
        const color = spawnColors.includes(colorCandidate) ? colorCandidate : 'gold';
        const count = typeof item.count === 'number' ? Math.max(1, Math.min(25, Math.round(item.count))) : 12;

        sanitized.push({
          type: 'spawn_wave',
          label: item.label || `SPAWN ${count}x ${color.toUpperCase()} ${shape.toUpperCase()}`,
          shape,
          color,
          count,
        });
        break;
      }

      case 'set_medium': {
        const rawMed = typeof item.medium === 'string' ? item.medium.toLowerCase().trim() : 'oil';
        const medium = rawMed === 'air' ? 'air' : 'oil';
        const viscosity = typeof item.viscosity === 'number' ? Math.max(0.1, Math.min(1.0, item.viscosity)) : 0.85;

        sanitized.push({
          type: 'set_medium',
          label: item.label || `MEDIUM // ${medium.toUpperCase()} (η=${Math.round(viscosity * 100)}%)`,
          medium,
          viscosity,
        });
        break;
      }

      case 'set_phenomenon': {
        const rawP = typeof item.phenomenon === 'string' ? item.phenomenon.toLowerCase().trim() : 'none';
        const validPhenom = ['gargantua', 'wormhole', 'magnetar', 'none'];
        const phenomenon = validPhenom.includes(rawP) ? rawP : 'gargantua';

        sanitized.push({
          type: 'set_phenomenon',
          label: item.label || `PHENOMENON // ${phenomenon.toUpperCase()}`,
          phenomenon,
        });
        break;
      }

      default:
        // Unknown or malformed rule dropped
        break;
    }
  }

  return sanitized;
}

/**
 * Compiles a natural language physical law prompt via Groq API.
 * Automatically validates guardrails, isolates user input within tags,
 * and falls back from openai/gpt-oss-120b to openai/gpt-oss-20b on HTTP 429 or 5xx.
 *
 * @param {string} prompt
 * @param {string} apiKey
 * @returns {Promise<{ summary: string, rules: Array<Object>, modelUsed: string, rawJson: string }>}
 */
export async function compilePromptWithGroq(prompt, apiKey = '') {
  // Tier 1: Client-Side Pre-Flight Input Guardrail
  validatePromptGuardrails(prompt);

  // If no client API key is provided, attempt secure serverless gateway (/api/compile)
  if (!apiKey || !apiKey.startsWith('gsk_')) {
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        const summary = (data.summary || 'CUSTOM PHYSICAL LAW').toUpperCase().trim();
        const rawRules = Array.isArray(data.rules) ? data.rules : [data.rules || data];
        const sanitizedRules = sanitizeRules(rawRules);

        if (sanitizedRules.length === 0) {
          throw new Error('UNMAPPED_LAW: Could not map input to physics schemas. Try specifying forces, gravity, bounce, or collisions.');
        }

        return {
          summary,
          rules: sanitizedRules,
          modelUsed: data.modelUsed || GROQ_MODELS.primary,
          rawJson: JSON.stringify({ summary, rules: sanitizedRules }, null, 2),
        };
      }

      if (res.status === 404 || res.status === 503) {
        throw new Error('NO_API_KEY');
      }

      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `HTTP_${res.status}`);
    } catch (err) {
      if (err.message === 'NO_API_KEY' || err.message?.includes('404')) {
        throw new Error('NO_API_KEY');
      }
      throw err;
    }
  }

  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  // Tier 2: Tag-Delimited Input Isolation
  const userContent = `<user_physics_input>\n${prompt.trim()}\n</user_physics_input>`;

  async function executeRequest(model) {
    const payload = {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      max_completion_tokens: 1500,
      temperature: 0.15,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    return res;
  }

  let modelUsed = GROQ_MODELS.primary;
  let response = await executeRequest(modelUsed);

  // Auto-Fallback: Retry once with openai/gpt-oss-20b if HTTP 429 or 5xx
  if (response.status === 429 || response.status >= 500) {
    modelUsed = GROQ_MODELS.fallback;
    response = await executeRequest(modelUsed);
  }

  if (!response.ok) {
    let errBody = '';
    try {
      errBody = await response.text();
    } catch {
      // ignore
    }
    throw new Error(`HTTP_${response.status}: ${errBody || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('EMPTY_MODEL_RESPONSE');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`JSON_PARSE_ERROR: ${err.message}`);
  }

  const summary = (parsed.summary || 'CUSTOM PHYSICAL LAW').toUpperCase().trim();
  const rawRules = Array.isArray(parsed.rules) ? parsed.rules : [parsed.rules || parsed];
  const sanitizedRules = sanitizeRules(rawRules);

  if (sanitizedRules.length === 0) {
    throw new Error('UNMAPPED_LAW: Could not map input to physics schemas. Try specifying forces, gravity, bounce, or collisions.');
  }

  return {
    summary,
    rules: sanitizedRules,
    modelUsed,
    rawJson: JSON.stringify({ summary, rules: sanitizedRules }, null, 2),
  };
}
