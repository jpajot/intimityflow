import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await req.json();
  if (!url) return Response.json({ dataUrl: null });

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) {
      console.log(`[proxyImage] fetch failed: ${res.status} for ${url}`);
      return Response.json({ dataUrl: null });
    }

    const contentType = res.headers.get('content-type') || 'image/png';
    console.log(`[proxyImage] contentType=${contentType} url=${url.slice(0, 80)}`);

    const buffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    // Encode in chunks to avoid stack overflow on large images
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    // Use image/png as fallback mime type if not an image content-type
    const mime = contentType.startsWith('image/') ? contentType.split(';')[0] : 'image/png';
    const dataUrl = `data:${mime};base64,${base64}`;

    return Response.json({ dataUrl });
  } catch (e) {
    console.log(`[proxyImage] error: ${e.message}`);
    return Response.json({ dataUrl: null });
  }
});