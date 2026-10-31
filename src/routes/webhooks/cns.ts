// Deliberately unavailable until CNS supplies the signed event contract.
export function POST() {
  return Response.json({ error: 'webhooks_not_configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
