import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI();
const JUDGE_MODEL = 'gpt-4o'; // ideally a different/stronger model than the one that generates answers

async function judgeJSON(system, user) {
  const res = await openai.chat.completions.create({
    model: JUDGE_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return JSON.parse(res.choices[0].message.content ?? '{}');
}

export function faithfulness(context, answer) {
  return judgeJSON(
    `You check whether an answer is fully supported by the context.
List every factual claim in the answer that is NOT supported by the context.
Return JSON: {"unsupported_claims": string[], "score": number}
score = fraction of claims supported (1 = all supported, 0 = none). If the answer is a refusal, score = 1.`,
    `Context:\n${context}\n\nAnswer:\n${answer}`,
  );
}

export function relevancy(question, answer) {
  return judgeJSON(
    `Rate how directly the answer addresses the question, from 0 to 1.
Return JSON: {"score": number, "reason": string}`,
    `Question:\n${question}\n\nAnswer:\n${answer}`,
  );
}

export function correctness(question, answer, reference) {
  return judgeJSON(
    `Compare the answer to the reference answer. Score 1 if it conveys the same facts, 0.5 if partially correct or missing details, 0 if wrong or contradictory.
Return JSON: {"score": number, "reason": string}`,
    `Question:\n${question}\n\nReference:\n${reference}\n\nAnswer:\n${answer}`,
  );
}
