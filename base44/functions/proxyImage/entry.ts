import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await req.json();
  if (!url) return Response.json({ dataUrl: null });

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0' };

    // Use SharePoint OAuth token for SharePoint URLs
    const isSharePoint = url.includes('sharepoint.com');
    if (isSharePoint) {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('share_point');
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.log(`[proxyImage] fetch failed: ${res.status} for ${url.slice(0, 80)}`);
      return Response.json({ dataUrl: null });
    }

    const contentType = res.headers.get('content-type') || 'image/png';
    console.log(`[proxyImage] contentType=${contentType} url=${url.slice(0, 80)}`);

    // If response is HTML (e.g. login redirect), return null
    if (contentType.includes('text/html')) {
      console.log(`[proxyImage] got HTML response (auth redirect?) for ${url.slice(0, 80)}`);
      return Response.json({ dataUrl: null });
    }

    const buffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    const mime = contentType.startsWith('image/') ? contentType.split(';')[0] : 'image/png';
    const dataUrl = `data:${mime};base64,${base64}`;

    return Response.json({ dataUrl });
  } catch (e) {
    console.log(`[proxyImage] error: ${e.message}`);
    return Response.json({ dataUrl: null });
  }
});