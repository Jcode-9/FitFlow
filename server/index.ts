import { createServer, type IncomingMessage } from 'node:http';

type HistoryItem = { name: string; sessions: number; date: string; best_weight: number; best_reps: number };
const port = Number(process.env.PORT ?? 8787);
const lastRequests = new Map<string, number>();

function send(response: import('node:http').ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' });
  response.end(JSON.stringify(body));
}
async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > 16_000) throw new Error('payload-too-large'); chunks.push(buffer); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
createServer(async (request, response) => {
  if (request.method === 'OPTIONS') { send(response, 204, {}); return; }
  if (request.method !== 'POST' || request.url !== '/suggest') { send(response, 404, { error: 'not-found' }); return; }
  const ip = request.socket.remoteAddress ?? 'unknown'; const now = Date.now();
  if (now - (lastRequests.get(ip) ?? 0) < 30_000) { send(response, 429, { error: 'rate-limited', message: 'Spróbuj ponownie za chwilę.' }); return; }
  if (!process.env.AI_API_KEY || !process.env.AI_API_URL || !process.env.AI_MODEL) { send(response, 503, { error: 'ai-not-configured', message: 'Usługa AI nie jest skonfigurowana.' }); return; }
  let history: HistoryItem[];
  try {
    const body = await readBody(request) as { history?: unknown };
    if (!Array.isArray(body?.history) || body.history.length > 100) throw new Error('invalid-history');
    history = body.history.map((item) => { const row = item as Record<string, unknown>; if (typeof row.name !== 'string' || row.name.length > 100 || !Number.isFinite(row.sessions) || !Number.isFinite(row.best_weight) || !Number.isFinite(row.best_reps) || typeof row.date !== 'string') throw new Error('invalid-history'); return { name: row.name, sessions: Number(row.sessions), date: row.date.slice(0, 10), best_weight: Number(row.best_weight), best_reps: Number(row.best_reps) }; });
  } catch (error) { send(response, error instanceof Error && error.message === 'payload-too-large' ? 413 : 400, { error: 'invalid-request' }); return; }
  lastRequests.set(ip, now); for (const [key, time] of lastRequests) if (now - time > 60_000) lastRequests.delete(key);
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
