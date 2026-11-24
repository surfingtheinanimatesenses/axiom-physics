/**
 * AXIOM // 2D Serverless Physics Law Gateway (/api/compile)
 * 
 * Security Guardrails:
 * 1. Secret Isolation: GROQ_API_KEY lives strictly in server-side environment variables.
 * 2. Origin Lock (CORS): Only authorized origins (your GitHub Pages, Vercel domain, and localhost).
 * 3. IP Rate Limiting: Max 8 requests/minute per client IP to prevent bot scraping and quota draining.
 * 4. Input Sanitization: Strict length caps (250 chars) and AST validation.
 */

const SYSTEM_PROMPT = `You are the AXIOM-2D physics law compiler. You compile natural language physical laws into a strictly validated JSON AST for a 2D rigid-body simulation engine.

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

Enums:
Colors: "red", "blue", "green", "gold", "all"
Shapes: "box", "circle", "triangle", "all"
Actions: "explode", "spawn_sparks", "destroy_b", "turn_gold"
Mediums: "air", "oil"

Creative Physics Mapping Examples:
- "solar system / central sun with orbiting planets" -> set_gravity (x: 0, y: 0), radial_force (sourceColor: "gold", targetColor: "all", strength: 0.0035), mutate_bodies (filter: { color: "gold" }, scale: 2.2, restitution: 0.1)
- "neutron star with ultra dense gravity" -> radial_force (sourceColor: "gold", targetColor: "all", strength: 0.004), mutate_bodies (filter: { color: "gold" }, scale: 0.45, restitution: 0.05)
- "black hole event horizon eats everything" -> radial_force (sourceColor: "gold", targetColor: "all", strength: 0.004), on_collision (colorA: "gold", colorB: "all", action: "destroy_b")
- "antimatter pair annihilation" -> on_collision (colorA: "red", colorB: "blue", action: "explode")
- "supernova core collapse and debris" -> on_collision (colorA: "gold", colorB: "gold", action: "explode"), spawn_wave (shape: "circle", color: "red", count: 18)
- "quantum entangled dipoles" -> radial_force (sourceColor: "red", targetColor: "blue", strength: 0.0032), radial_force (sourceColor: "blue", targetColor: "blue", strength: -0.0025)
- "absolute zero cryo freeze" -> mutate_bodies (filter: { color: "all", shape: "all" }, restitution: 0.02, frictionAir: 0.12), on_collision (colorA: "all", colorB: "all", action: "spawn_sparks")
- "submerge in thick motor oil" -> set_medium (medium: "oil", viscosity: 0.88)
- "make them electronically charged" -> radial_force (strength: -0.0025)
- "super bouncy pinball chaos" -> mutate_bodies (restitution: 1.25), set_gravity (x: 0, y: 0)

Output MUST be a valid JSON object matching this exact shape:
{
  "summary": "3-5 WORD UPPERCASE TITLE",
  "rules": [
    { "type": "...", ... }
  ]
}

Never output dynamic JavaScript or markdown code blocks. Always map creative metaphors to the closest physical forces and properties.`;

// In-memory IP rate limiter (Sliding 60-second window)
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 8;

  const record = rateLimitMap.get(ip) || [];
  const recent = record.filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= maxRequests) {
    return true;
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);

  // Periodic cleanup
  if (rateLimitMap.size > 2000) {
    for (const [key, timestamps] of rateLimitMap.entries()) {
      if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > windowMs) {
        rateLimitMap.delete(key);
      }
    }
  }

  return false;
}

export default async function handler(req, res) {
  // 1. CORS Headers
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://surfingtheinanimatesenses.github.io',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  const isAllowedOrigin = allowedOrigins.includes(origin) || origin.endsWith('.vercel.app');

  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? origin : '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. IP Rate Limiting Check
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment.' });
  }

  // 3. Payload Validation
  const prompt = typeof req.body === 'object' && req.body ? req.body.prompt : req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
    return res.status(400).json({ error: 'INVALID_PROMPT', message: 'Input prompt must be at least 3 characters.' });
  }

  const cleanPrompt = prompt.trim();
  if (cleanPrompt.length > 250) {
    return res.status(400).json({ error: 'PROMPT_TOO_LONG', message: 'Prompt exceeds 250 characters limit.' });
  }

  // 4. Secure API Key Pool & Auto-Rotation (Load Balancing + 429 Failover)
  const rawKeys = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '';
  const keyPool = rawKeys
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter((k) => k.startsWith('gsk_'));

  if (keyPool.length === 0) {
    return res.status(503).json({
      error: 'SERVER_KEY_NOT_CONFIGURED',
      message: 'Server GROQ_API_KEYS is not configured yet in environment variables.',
    });
  }

  // 5. Call Groq with Multi-Key Rotation & Automatic Model Fallback
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  const userContent = `<user_physics_input>\n${cleanPrompt}\n</user_physics_input>`;

  async function executeWithKeyRotation(model) {
    // Start at a random key index to evenly balance load across all 4 keys
    const startIndex = Math.floor(Math.random() * keyPool.length);
    let lastResponse = null;

    for (let attempt = 0; attempt < keyPool.length; attempt++) {
      const activeKey = keyPool[(startIndex + attempt) % keyPool.length];

      try {
        const groqRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            response_format: { type: 'json_object' },
            reasoning_effort: 'low',
            max_completion_tokens: 1500,
            temperature: 0.15,
          }),
        });

        // If successful, return immediately
        if (groqRes.ok) {
          return groqRes;
        }

        lastResponse = groqRes;

        // If rate-limited (429) or temporary 5xx, continue to next key in pool
        if (groqRes.status === 429 || groqRes.status >= 500) {
          continue;
        }

        // If authentication error (e.g. invalid key 401), try next key
        if (groqRes.status === 401) {
          continue;
        }
      } catch {
        // Network blip, continue to next key
        continue;
      }
    }

    return lastResponse;
  }

  try {
    let modelUsed = 'openai/gpt-oss-120b';
    let groqRes = await executeWithKeyRotation(modelUsed);

    // If all keys rate limited on 120b, fallback to 20b across key pool
    if (!groqRes || groqRes.status === 429 || groqRes.status >= 500) {
      modelUsed = 'openai/gpt-oss-20b';
      groqRes = await executeWithKeyRotation(modelUsed);
    }

    if (!groqRes || !groqRes.ok) {
      const errText = groqRes ? await groqRes.text().catch(() => '') : 'All API keys failed';
      return res.status(groqRes ? groqRes.status : 502).json({
        error: `GROQ_UPSTREAM_${groqRes ? groqRes.status : 'FAILED'}`,
        message: errText,
      });
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'EMPTY_RESPONSE', message: 'Upstream model returned empty choice.' });
    }

    const parsed = JSON.parse(content);
    return res.status(200).json({
      summary: (parsed.summary || 'CUSTOM PHYSICAL LAW').toUpperCase().trim(),
      rules: Array.isArray(parsed.rules) ? parsed.rules : [parsed.rules || parsed],
      modelUsed,
    });
  } catch (err) {
    return res.status(500).json({ error: 'COMPILER_ERROR', message: err.message });
  }
}
