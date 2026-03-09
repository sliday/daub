import { buildSystemPrompt } from './prompt.js';
import { validateSpec, autoFixSpec } from './validate.js';

const SYSTEM_PROMPT = buildSystemPrompt();

export function cleanJSON(raw) {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const idx = s.indexOf('{');
  if (idx > 0) s = s.slice(idx);
  const lastIdx = s.lastIndexOf('}');
  if (lastIdx >= 0 && lastIdx < s.length - 1) s = s.slice(0, lastIdx + 1);
  return s;
}

export async function generateSpec(prompt, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY environment variable required');

  const model = 'google/gemini-2.5-flash';

  const messages = [];
  messages.push({ role: 'system', content: SYSTEM_PROMPT });

  if (options.existing_spec) {
    messages.push({
      role: 'assistant',
      content: typeof options.existing_spec === 'string'
        ? options.existing_spec
        : JSON.stringify(options.existing_spec),
    });
    messages.push({
      role: 'user',
      content: `Modify the existing spec above according to these instructions: ${prompt}`,
    });
  } else {
    let userContent = prompt;
    if (options.theme) {
      userContent += `\n\nUse the "${options.theme}" theme.`;
    }
    messages.push({ role: 'user', content: userContent });
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://daub.dev',
      'X-Title': 'DAUB MCP Server',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 32768,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error('No content in OpenRouter response');

  const cleaned = cleanJSON(rawContent);
  let spec;
  try {
    spec = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e.message}\nRaw (first 500 chars): ${cleaned.slice(0, 500)}`);
  }

  spec = autoFixSpec(spec);
  const validation = validateSpec(spec);

  return { spec, validation, raw: rawContent };
}
