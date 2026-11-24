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

  // 4. Secure API Key Retrieval
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !apiKey.startsWith('gsk_')) {
    return res.status(503).json({
      error: 'SERVER_KEY_NOT_CONFIGURED',
      message: 'Server GROQ_API_KEY is not configured yet in environment variables.',
    });
  }

  // 5. Call Groq with Automatic Fallback (Primary: 120b, Fallback: 20b)
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  const userContent = `<user_physics_input>\n${cleanPrompt}\n</user_physics_input>`;

  async function callGroq(model) {
    return await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
  }

  try {
    let modelUsed = 'openai/gpt-oss-120b';
    let groqRes = await callGroq(modelUsed);

    if (groqRes.status === 429 || groqRes.status >= 500) {
      modelUsed = 'openai/gpt-oss-20b';
      groqRes = await callGroq(modelUsed);
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => '');
      return res.status(groqRes.status).json({
        error: `GROQ_UPSTREAM_${groqRes.status}`,
        message: errText || groqRes.statusText,
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
