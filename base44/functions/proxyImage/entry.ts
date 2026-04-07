import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await req.json();
  if (!url) return Response.json({ error: 'Missing url' }, { status: 400 });

  const res = await fetch(url);
  if (!res.ok) return Response.json({ error: `Fetch failed: ${res.status}` }, { status: 502 });

  const contentType = res.headers.get('content-type') || 'image/png';
  const buffer = await res.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  // Encode in chunks to avoid stack overflow on large images
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  const dataUrl = `data:${contentType};base64,${base64}`;

  return Response.json({ dataUrl });
});