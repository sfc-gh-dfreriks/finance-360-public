// Data access layer. Supports two modes:
//   - Live (default): fetch from the Express server at /api/*
//   - Static (VITE_STATIC=1): read pre-baked JSON snapshots from <base>/data/*
//     and route the Cortex agent to VITE_AGENT_URL (a serverless function).
// This lets the exact same client run behind Snowflake auth OR as an anonymous
// public build on a static host (GitHub Pages) with a separate agent worker.

const STATIC = import.meta.env.VITE_STATIC === '1';
const AGENT_BASE = (import.meta.env.VITE_AGENT_URL ?? '').replace(/\/$/, '');
const DATA_BASE = `${import.meta.env.BASE_URL}data`;
const API_BASE = '/api';

/** Canonical filter key — MUST match filterKey() in scripts/export-static.mjs. */
function filterKey(companyCodes: string[], fiscalYears: string[]): string {
  return `${[...companyCodes].sort().join(',')}||${[...fiscalYears].sort().join(',')}`;
}

function buildParams(companyCodes: string[], fiscalYears: string[]): string {
  const params = new URLSearchParams();
  if (companyCodes.length) params.set('companyCodes', companyCodes.join(','));
  if (fiscalYears.length) params.set('fiscalYears', fiscalYears.join(','));
  return params.toString();
}

/** Convert snake_case keys to camelCase recursively */
function camelizeKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function camelizeKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (obj !== null && typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      out[camelizeKey(k)] = camelizeKeys(v);
    }
    return out;
  }
  return obj;
}

// --- Live mode ------------------------------------------------------------
async function liveGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return camelizeKeys(json) as T;
}

// --- Static mode ----------------------------------------------------------
const fileCache = new Map<string, Promise<Record<string, any>>>();

function loadStaticFile(file: string): Promise<Record<string, any>> {
  let p = fileCache.get(file);
  if (!p) {
    p = fetch(`${DATA_BASE}/${file}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Static data error: ${res.status} ${file}`);
        return res.json();
      });
    fileCache.set(file, p);
  }
  return p;
}

async function staticGet<T>(file: string, cc: string[], fy: string[]): Promise<T> {
  const map = await loadStaticFile(file);
  const entry = map[filterKey(cc, fy)] ?? {};
  return camelizeKeys(entry) as T;
}

/** Route a filtered endpoint to the live API or a static snapshot file. */
function getFiltered<T>(livePath: string, staticFile: string, cc: string[], fy: string[]): Promise<T> {
  if (STATIC) return staticGet<T>(staticFile, cc, fy);
  const qs = buildParams(cc, fy);
  return liveGet<T>(`${livePath}?${qs}`);
}

// --- Public API -----------------------------------------------------------
export function fetchFilters(): Promise<{ companyCodes: string[]; fiscalYears: string[] }> {
  if (STATIC) return loadStaticFile('filters') as Promise<{ companyCodes: string[]; fiscalYears: string[] }>;
  return liveGet('/filters');
}

export function fetchOverview(cc: string[], fy: string[]) {
  return getFiltered<any>('/overview', 'overview', cc, fy);
}

export function fetchGeneralLedger(cc: string[], fy: string[]) {
  return getFiltered<any>('/general-ledger', 'general-ledger', cc, fy);
}

export function fetchCostCenters(cc: string[], fy: string[]) {
  return getFiltered<any>('/cost-centers', 'cost-centers', cc, fy);
}

export function fetchProfitCenters(cc: string[], fy: string[]) {
  return getFiltered<any>('/profit-centers', 'profit-centers', cc, fy);
}

export function fetchAccountsPayable(cc: string[], fy: string[]) {
  return getFiltered<any>('/accounts-payable', 'accounts-payable', cc, fy);
}

export function fetchLargestInvoices(cc: string[], fy: string[]) {
  return getFiltered<any[]>('/accounts-payable/largest', 'accounts-payable-largest', cc, fy);
}

export function fetchAccountsReceivable(cc: string[], fy: string[]) {
  return getFiltered<any>('/accounts-receivable', 'accounts-receivable', cc, fy);
}

export function fetchOverdueInvoices(cc: string[], fy: string[]) {
  return getFiltered<any[]>('/accounts-receivable/overdue', 'accounts-receivable-overdue', cc, fy);
}

export function fetchPeriodAnalysis(cc: string[], fy: string[]) {
  return getFiltered<any>('/period-analysis', 'period-analysis', cc, fy);
}

export async function fetchLineage(): Promise<any> {
  if (STATIC) return camelizeKeys(await loadStaticFile('lineage'));
  return liveGet('/lineage');
}

export async function fetchAnalyst(messages: { role: string; content: string }[]) {
  const base = STATIC ? AGENT_BASE : API_BASE;
  const res = await fetch(`${base}/analyst`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- Ask Cortex -------------------------------------------------------------
// Live: POST starts a background job, then poll until done.
// Static: answers for each topic's default question are baked at export time;
// free-text questions are routed to the agent endpoint when one is configured.
export interface AskCortexRequest {
  topic: string;
  args?: Record<string, string>;
  question?: string;
}

export function askKey(r: AskCortexRequest): string {
  const a = Object.entries(r.args ?? {}).sort().map(([k, v]) => `${k}=${v}`).join('&');
  return a ? `${r.topic}?${a}` : r.topic;
}

export async function askCortex(r: AskCortexRequest, signal?: AbortSignal): Promise<string> {
  if (STATIC) {
    const baked = (await loadStaticFile('ask_cortex').catch(() => ({}))) as Record<string, string>;
    if (!r.question && baked[askKey(r)]) return baked[askKey(r)];
    if (AGENT_BASE && r.question) {
      const res = await fetch(`${AGENT_BASE}/ask-cortex`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r), signal,
      }).catch(() => null);
      if (res?.ok) return (await res.json()).answer;
    }
    return baked[askKey(r)] ??
      '_Live Cortex analysis is not available in this static build. Run the app against Snowflake to ask your own question._';
  }
  const start = await fetch(`${API_BASE}/ask-cortex`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r), signal,
  });
  if (!start.ok) throw new Error(`Ask Cortex: ${start.status}`);
  const { id } = await start.json();
  for (let i = 0; i < 90; i++) {
    await new Promise((res) => setTimeout(res, 2000));
    if (signal?.aborted) throw new Error('cancelled');
    const j = await liveGet<any>(`/ask-cortex/${id}`);
    if (j.status === 'done') return j.answer;
    if (j.status === 'error') throw new Error(j.error);
  }
  throw new Error('Ask Cortex timed out');
}
