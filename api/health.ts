/**
 * GET /api/health — Vercel Serverless Function (Node.js runtime).
 *
 * Verifies, from the server side, that the deployment can reach the Supabase
 * database: it calls the public.app_health() function (the only RPC granted to
 * the anonymous role, returning row counts of non-confidential reference data).
 *
 * Uses only the PUBLISHABLE key. No secret keys or passwords exist in this
 * project's Vercel environment, so none can leak through this endpoint.
 */
export async function GET(): Promise<Response> {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
  const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  if (!url || !key) {
    return new Response(JSON.stringify({ status: 'misconfigured', message: 'Supabase URL or publishable key is not set.' }), { status: 500, headers });
  }

  const started = Date.now();
  try {
    const res = await fetch(`${url}/rest/v1/rpc/app_health`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    });
    const database = await res.json().catch(() => null);
    return new Response(
      JSON.stringify({
        status: res.ok ? 'ok' : 'degraded',
        service: 'sete-academic-analytics-dashboard',
        database,
        latency_ms: Date.now() - started,
        region: process.env.VERCEL_REGION ?? null,
        deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        checked_at: new Date().toISOString(),
      }),
      { status: res.ok ? 200 : 502, headers },
    );
  } catch {
    return new Response(JSON.stringify({ status: 'error', message: 'Database unreachable from the serverless function.' }), { status: 503, headers });
  }
}
