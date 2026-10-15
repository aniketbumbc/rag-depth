import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI();
export const MODEL = 'gpt-4o-mini';

export async function chat(messages, { temperature = 0, json = false } = {}) {
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature,
    messages,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  });
  return res.choices[0].message.content ?? '';
}

// JSON mode requires the word "JSON" in the prompt, so every grader prompt includes it
export async function chatJSON(system, user, fallback) {
  try {
    const text = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { json: true },
    );
    return JSON.parse(text);
  } catch (e) {
    console.warn('JSON call failed, using fallback:', e.message);
    return fallback;
  }
}
