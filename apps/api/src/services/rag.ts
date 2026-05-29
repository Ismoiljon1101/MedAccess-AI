// Lightweight BM25-style retrieval over the seed medical knowledge.
// We deliberately avoid an embedding API call because:
//   1) Corpus is tiny (~15 docs) — keyword similarity is more than enough.
//   2) Lets the whole MVP run with ONLY an OpenRouter key.
//   3) Zero external infra.
// Production should swap for pgvector or Qdrant + real embeddings.

import { MEDICAL_KNOWLEDGE, type KnowledgeDoc } from '@medaccess/shared';
import type { RagCitation, RagStatus } from '@medaccess/shared';

interface IndexedDoc {
  doc: KnowledgeDoc;
  termFreq: Map<string, number>;
  length: number;
}

interface Index {
  docs: IndexedDoc[];
  df: Map<string, number>;        // document frequency per term
  avgDocLength: number;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'and', 'or', 'but', 'not', 'with', 'without', 'in', 'on', 'at', 'to',
  'from', 'of', 'for', 'by', 'as', 'if', 'then', 'than', 'so', 'this',
  'that', 'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we',
  'they', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would',
  'can', 'could', 'should', 'may', 'might', 'about',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function buildIndex(docs: KnowledgeDoc[]): Index {
  const indexed: IndexedDoc[] = [];
  const df = new Map<string, number>();
  let totalLength = 0;

  for (const doc of docs) {
    const tokens = tokenize(`${doc.title} ${doc.tags.join(' ')} ${doc.body}`);
    const termFreq = new Map<string, number>();
    for (const tok of tokens) termFreq.set(tok, (termFreq.get(tok) || 0) + 1);
    for (const term of termFreq.keys()) df.set(term, (df.get(term) || 0) + 1);
    indexed.push({ doc, termFreq, length: tokens.length });
    totalLength += tokens.length;
  }

  return {
    docs: indexed,
    df,
    avgDocLength: indexed.length ? totalLength / indexed.length : 0,
  };
}

const INDEX: Index = buildIndex(MEDICAL_KNOWLEDGE);

// BM25 scoring
function bm25(query: string[], doc: IndexedDoc, index: Index, k1 = 1.5, b = 0.75): number {
  const N = index.docs.length;
  let score = 0;
  for (const term of query) {
    const df = index.df.get(term) || 0;
    if (df === 0) continue;
    const tf = doc.termFreq.get(term) || 0;
    if (tf === 0) continue;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + (b * doc.length) / (index.avgDocLength || 1));
    score += idf * (numerator / denominator);
  }
  return score;
}

export interface RetrieveOptions {
  k?: number;
  minScore?: number;
}

export interface RetrieveResult {
  doc: KnowledgeDoc;
  score: number;
}

export function retrieve(query: string, opts: RetrieveOptions = {}): RetrieveResult[] {
  const { k = 4, minScore = 1.5 } = opts;
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const scored = INDEX.docs
    .map((d) => ({ doc: d.doc, score: bm25(qTokens, d, INDEX) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored;
}

export function formatContext(results: RetrieveResult[]): string {
  if (!results.length) return '';
  return results
    .map((r, i) => `[${i + 1}] ${r.doc.title}\n${r.doc.body}`)
    .join('\n\n---\n\n');
}

export function toCitations(results: RetrieveResult[]): RagCitation[] {
  return results.map((r) => ({
    id: r.doc.id,
    title: r.doc.title,
    score: Number(r.score.toFixed(3)),
  }));
}

export function ragStatus(): RagStatus {
  return { ready: INDEX.docs.length > 0, size: INDEX.docs.length };
}
