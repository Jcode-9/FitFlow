import { createServer, type IncomingMessage } from 'node:http';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type HistoryItem = { name: string; sessions: number; date: string; best_weight: number; best_reps: number };
const port = Number(process.env.PORT ?? 8787);
const lastRequests = new Map<string, number>();
const usageFile = join(dirname(fileURLToPath(import.meta.url)), '.usage.json');
let reservationQueue = Promise.resolve();

function send(response: import('node:http').ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' });
  response.end(JSON.stringify(body));
}
async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > 16_000) throw new Error('payload-too-large'); chunks.push(buffer); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function reserveMonthlyRequest(limit: number) {
  const reservation = reservationQueue.then(async () => {
    const month = new Date().toISOString().slice(0, 7);
    let usage: { month: string; count: number } = { month, count: 0 };
    try { const saved = JSON.parse(await readFile(usageFile, 'utf8')) as { month?: unknown; count?: unknown }; if (saved.month === month && Number.isInteger(saved.count) && Number(saved.count) >= 0) usage.count = Number(saved.count); } catch { /* No usage ledger exists yet. */ }
    if (usage.count >= limit) return false;
    const next = JSON.stringify({ month, count: usage.count + 1 });
    const temporaryFile = `${usageFile}.tmp`;
    await writeFile(temporaryFile, next, 'utf8');
    await rename(temporaryFile, usageFile);
    return true;
  });
  reservationQueue = reservation.then(() => undefined, () => undefined);
  return reservation;
}
createServer(async (request, response) => {
  if (request.method === 'OPTIONS') { send(response, 204, {}); return; }
  if (request.method !== 'POST' || request.url !== '/suggest') { send(response, 404, { error: 'not-found' }); return; }
  const ip = request.socket.remoteAddress ?? 'unknown'; const now = Date.now();
  if (now - (lastRequests.get(ip) ?? 0) < 30_000) { send(response, 429, { error: 'rate-limited', message: 'Spróbuj ponownie za chwilę.' }); return; }
  const monthlyLimit = Number(process.env.AI_MONTHLY_REQUEST_LIMIT);
  if (!process.env.AI_API_KEY || !process.env.AI_API_URL || !process.env.AI_MODEL || !Number.isInteger(monthlyLimit) || monthlyLimit < 1) { send(response, 503, { error: 'ai-not-configured', message: 'Usługa AI lub jej miesięczny limit nie są skonfigurowane.' }); return; }
  let history: HistoryItem[];
  try {
    const body = await readBody(request) as { history?: unknown };
    if (!Array.isArray(body?.history) || body.history.length > 100) throw new Error('invalid-history');
    history = body.history.map((item) => { const row = item as Record<string, unknown>; if (typeof row.name !== 'string' || row.name.length > 100 || !Number.isFinite(row.sessions) || !Number.isFinite(row.best_weight) || !Number.isFinite(row.best_reps) || typeof row.date !== 'string') throw new Error('invalid-history'); return { name: row.name, sessions: Number(row.sessions), date: row.date.slice(0, 10), best_weight: Number(row.best_weight), best_reps: Number(row.best_reps) }; });
  } catch (error) { send(response, error instanceof Error && error.message === 'payload-too-large' ? 413 : 400, { error: 'invalid-request' }); return; }
  lastRequests.set(ip, now); for (const [key, time] of lastRequests) if (now - time > 60_000) lastRequests.delete(key);
  try { if (!await reserveMonthlyRequest(monthlyLimit)) { send(response, 429, { error: 'monthly-limit-reached', message: 'Miesięczny limit sugestii AI został wykorzystany.' }); return; } }
  catch { send(response, 503, { error: 'usage-ledger-unavailable' }); return; }
  try {
    const apiUrl = process.env.AI_API_URL.replace(/\/$/, '');
    const upstream = await fetch(`${apiUrl}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${process.env.AI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.AI_MODEL, temperature: 0.4, max_tokens: 220, messages: [
      { role: 'system', content: 'Jesteś ostrożnym asystentem treningu siłowego. Po polsku podaj jedną krótką sugestię opartą na historii. Wyjaśnij obserwację, nie diagnozuj ani nie zalecaj leczenia lub ryzykownych zmian. Gdy danych jest za mało, powiedz to. Nigdy nie zmieniaj zapisów użytkownika.' },
      { role: 'user', content: JSON.stringify(history) },
    ] }) });
    if (!upstream.ok) { send(response, 502, { error: 'upstream-failed' }); return; }
    const data = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
    const suggestion = data.choices?.[0]?.message?.content?.trim(); if (!suggestion) { send(response, 502, { error: 'empty-response' }); return; }
    send(response, 200, { suggestion: suggestion.slice(0, 1200) });
  } catch { send(response, 502, { error: 'upstream-unavailable' }); }
}).listen(port, '0.0.0.0', () => console.log(`FitFlow AI API listening on ${port}`));
