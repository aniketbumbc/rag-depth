# How `eval-retrieval.js` works

`basic-rag/eval-retrieval.js` scores only the **retrieval** half of the RAG pipeline. It checks whether the vector search returns the right pages from Supabase, without generating any answers.

## Run it

```bash
cd basic-rag
node ingest.js ./pdf acme   # only if data-1.pdf isn't in Supabase yet
node eval-retrieval.js
```

## Recall, MRR and precision in plain words

Think of the search as a librarian. You ask a question, for example "How much is the booking amount?", and the librarian hands you a **stack of pages**, say 5 of them (that's **k = 5**). Only some of those pages actually have the answer. The three metrics are three ways of grading the librarian.

> MRR (Mean Reciprocal Rank) is not the same as MMR (Maximal Marginal Relevance). MMR is a way of picking search results that aren't repetitive, and this eval doesn't use it.

### Recall: "Did the right page show up at all?"

Look through the stack. **Is the page with the answer anywhere in it?**

- Yes → pass ✅ (score 1)
- No → fail ❌ (score 0)

Do this for every question and take the average. **Recall = 0.9** means "for 90% of questions, the answer was somewhere in the stack."

This one matters most. If the right page isn't in the stack, the AI **can't** answer correctly, no matter how smart it is.

### MRR: "How near the top was the right page?"

Recall only asks *whether* the right page was there. MRR asks *where* it was in the stack.

| Right page was at… | Score |
|---|---|
| Position 1 (top) | 1 |
| Position 2 | 1/2 = 0.5 |
| Position 3 | 1/3 = 0.33 |
| Position 4 | 1/4 = 0.25 |
| Not there at all | 0 |

Average over all questions. **MRR = 1.0** means the right page was always on top. **MRR = 0.5** means it was usually around 2nd place.

This matters because AI models (and people) pay more attention to what comes first.

### Precision: "How much of the stack was useful?"

Count how many pages in the stack were actually relevant.

- Stack of 5 pages, 1 useful → precision = 1/5 = **0.2**
- Stack of 5 pages, 4 useful → precision = 4/5 = **0.8**

Low precision means the AI gets a lot of **junk** mixed in with the answer. That can confuse it, and it costs more tokens.

### One example, all three metrics

Question: *"What is the adult price?"* The answer is on **page 5**. The search returns 4 pages: **[page 2, page 5, page 6, page 1]**.

- **Recall**: page 5 is in the stack → **1** ✅
- **MRR**: page 5 is in position 2 → **1/2 = 0.5**
- **Precision**: 1 useful out of 4 → **1/4 = 0.25**

### The trade-off

- **Bigger stack (higher k)**: recall goes **up** (more chances to include the answer), but precision goes **down** (more junk comes along).
- **Smaller stack (lower k)**: less junk, but a higher risk of missing the answer.

The goal is **high recall with the smallest k you can get away with**, and **MRR close to 1**, so the answer is found and sits near the top.

## Step by step

### Step 1: Load the golden set

```js
const golden = JSON.parse(fs.readFileSync('goldendata.json', 'utf8'));
```

It reads the 25 questions. Each question has `expectedSources`, the page or pages where the answer actually is.

### Step 2: Define what counts as a correct hit (`isMatch`)

```js
const isMatch = (h, exp) =>
  h.metadata.source === exp.source &&
  (exp.page === undefined || Number(h.metadata.page) === exp.page);
```

A retrieved chunk `h` counts as relevant when:

- its `source` matches (`data-1.pdf`), **and**
- its `page` matches the expected page. If the golden entry gives no page, a matching file is enough.

The check works at the page level, not the chunk level. Any chunk from the right page counts as correct.

### Step 3: Keep only the answerable questions

```js
const items = golden.filter((g) => g.answerable);
```

The 3 unanswerable questions have no correct pages, so they can't be scored here. That leaves **22 questions**.

### Step 4: For each question, search and mark each hit

```js
const hits = await retrieve(g.question, { tenantId: 'acme', k, minScore });
const relevant = hits.map((h) => g.expectedSources.some((e) => isMatch(h, e)));
```

- It runs a vector search and gets the top `k` chunks back.
- It turns them into a true/false list. For example, `[false, true, false]` means only the 2nd hit came from a correct page.

### Step 5: Score that question with three metrics

Using `relevant = [false, true, false]` as the example:

| Metric | Code | What it asks | Example |
|---|---|---|---|
| **Recall@k** | `if (relevant.some(Boolean)) recall++` | Did *any* of the top k come from a right page? | yes → +1 |
| **MRR** (Mean Reciprocal Rank) | `mrr += 1 / (firstRank + 1)` | How high is the *first* correct hit? 1st = 1.0, 2nd = 0.5, 3rd = 0.33… | first correct is 2nd → +0.5 |
| **Precision@k** | `relevant.filter(Boolean).length / hits.length` | What fraction of the k hits are relevant? | 1 of 3 → +0.333 |

### Step 6: Average over all questions

```js
recall: recall / n, mrr: mrr / n, precision: precision / n
```

It divides each total by `n = 22` and rounds to 3 decimal places.

### Step 7: Repeat for different k

```js
for (const k of [1, 3, 5, 10]) console.log(await evalRetrieval(k));
```

It runs the whole evaluation 4 times. That's 22 × 4 = 88 searches, and each one makes an OpenAI embedding call.

## How to read the output

- **Recall should go up as k goes up.** If recall is still low at k=10, the right chunk isn't being found at all. Look at chunking, embeddings, or the question wording.
- **High recall but low MRR** means the right chunk is found but ranked low. A reranker can help with that.
- **Precision usually goes down as k goes up.** A larger k pulls in more off-topic chunks, so that drop is expected.
- **The number that matters most is recall at the k that `ask.js` uses.** Those are the chunks the LLM actually sees.

## Things to know

- `tenantId` and `minScore` are passed in but `retrieve()` ignores them. Only `k` has any effect.
- Some golden questions list several expected pages, for example q2 lists pages 1–3. Finding any one of them counts as a full recall hit.
