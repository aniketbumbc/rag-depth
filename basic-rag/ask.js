import { answerQuestion } from './generate.js';
import { resolveCitations } from './utils.js';

const q = process.argv[2] ?? 'How long do refunds take?';

try {
  const { answer, sources } = await answerQuestion(q);
  console.log('\nANSWER:\n', answer);
  console.table(resolveCitations(answer, sources));
} catch (error) {
  console.error(error);
}
