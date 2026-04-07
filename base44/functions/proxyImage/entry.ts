import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await req.json();
  if (!url) return Response.json({ error: 'Missing url' }, { status: 400 });

  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/png';
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const dataUrl = `data:${contentType};base64,${base64}`;

  return Response.json({ dataUrl });
});