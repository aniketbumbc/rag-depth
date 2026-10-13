import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { answerStream } from './generate.js';
import { resolveCitations } from './utils.js';
import { pool } from './db.js';

// Spinner on one terminal line; stop() erases it. No-op when output isn't a TTY.
function spinner(text) {
  if (!output.isTTY) return { stop() {} };
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const timer = setInterval(
    () => output.write(`\r${frames[i++ % frames.length]} ${text}`),
    80,
  );
  return {
    stop() {
      clearInterval(timer);
      output.write('\r\x1b[2K'); // clear the spinner line
    },
  };
}

// Streams the answer to the terminal as it is generated, then prints the cited pages.
async function ask(question) {
  let answer = '';
  const loader = spinner('Searching documents...');
  let started = false;
  let sources;

  try {
    ({ sources } = await answerStream(question, (token) => {
      if (!started) {
        started = true;
        loader.stop();
        output.write('\nANSWER:\n');
      }
      answer += token;
      output.write(token);
    }));
  } finally {
    if (!started) loader.stop(); // error before any token arrived
  }
  output.write('\n');

  const citations = resolveCitations(answer, sources);
  if (citations.length) console.table(citations);
}

// `node ask.js "question"` answers once; `node ask.js` starts an interactive prompt.
const arg = process.argv.slice(2).join(' ').trim();

try {
  if (arg) {
    await ask(arg);
  } else {
    const rl = readline.createInterface({ input, output });
    console.log('Ask about your documents. "exit" or Ctrl+C to quit.');

    while (true) {
      let q;
      try {
        q = (await rl.question('\n? ')).trim();
      } catch {
        break; // Ctrl+C / Ctrl+D closes the prompt
      }
      if (!q) continue;
      if (q === 'exit' || q === 'quit') break;
      try {
        await ask(q);
      } catch (error) {
        console.error(error.message);
      }
    }
    rl.close();
  }
} catch (error) {
  console.error(error);
} finally {
  await pool.end();
}
