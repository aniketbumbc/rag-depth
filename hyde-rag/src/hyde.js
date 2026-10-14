import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI();
const MODEL = 'gpt-4o-mini';

const DOC_HINT =
  'a holiday tour package brochure (itinerary by day, inclusions, exclusions, rates, policies)';

export async function hydePassage(question) {
  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Write a short passage (2 to 4 sentences) that could appear in ${DOC_HINT} and would answer the user's question.
  Write it as document text, not as a reply to the user.
  It may contain plausible details. It is used only for search and is never shown to the user.`,
        },
        { role: 'user', content: question },
      ],
    });
    return res.choices[0].message.content?.trim() || question;
  } catch (e) {
    console.warn('HyDE failed, falling back to the question:', e.message);
    return question;
  }
}
