const ALLOWED_COUNTRIES = new Set(['ID', 'US', 'SG', 'MY', 'GB', 'JP', 'KR', 'AU']);

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const term = String(request.query.term || '').trim().slice(0, 100);
  const countryInput = String(request.query.country || 'ID').toUpperCase();
  const country = ALLOWED_COUNTRIES.has(countryInput) ? countryInput : 'ID';
  const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 30, 1), 50);

  if (!term) return response.status(400).json({ error: 'Parameter term wajib diisi.' });

  const params = new URLSearchParams({
    term,
    country,
    limit: String(limit),
    media: 'music',
    entity: 'song',
    explicit: 'No',
  });

  try {
    const upstream = await fetch(`https://itunes.apple.com/search?${params}`, {
      headers: { 'User-Agent': 'DiTz-Music/1.0' },
    });

    if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);
    const data = await upstream.json();

    response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=86400');
    response.setHeader('Access-Control-Allow-Origin', '*');
    return response.status(200).json(data);
  } catch (error) {
    return response.status(502).json({
      error: 'Gagal mengambil data musik.',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
      }
