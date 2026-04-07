import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function fetchSharePointImage(url, accessToken) {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const pathParts = parsed.pathname.split('/').map(decodeURIComponent);

  // Find /sites/SiteName
  const sitesIdx = pathParts.indexOf('sites');
  if (sitesIdx < 0) return null;
  const siteName = pathParts[sitesIdx + 1];

  // After site, skip the library name ("Shared Documents") — it's the drive root
  const afterSite = pathParts.slice(sitesIdx + 2);
  const filePath = afterSite.slice(1).join('/'); // skip library name
  if (!filePath) return null;

  const authHeaders = { 'Authorization': `Bearer ${accessToken}` };

  // Step 1: Get the site ID
  const siteRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${hostname}:/sites/${siteName}`,
    { headers: authHeaders }
  );
  if (!siteRes.ok) {
    const t = await siteRes.text();
    console.log(`[proxyImage] site lookup failed: ${siteRes.status} ${t.slice(0, 200)}`);
    return null;
  }
  const siteData = await siteRes.json();
  const siteId = siteData.id;
  console.log(`[proxyImage] siteId=${siteId}`);

  // Step 2: Get the default drive and fetch the file content
  const fileUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${filePath}:/content`;
  console.log(`[proxyImage] fetching file: ${fileUrl}`);
  const fileRes = await fetch(fileUrl, { headers: authHeaders, redirect: 'follow' });

  if (!fileRes.ok) {
    const t = await fileRes.text();
    console.log(`[proxyImage] file fetch failed: ${fileRes.status} ${t.slice(0, 200)}`);
    return null;
  }

  return fileRes;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await req.json();
  if (!url) return Response.json({ dataUrl: null });

  try {
    const isSharePoint = url.includes('sharepoint.com');
    let res;

    if (isSharePoint) {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('share_point');
      res = await fetchSharePointImage(url, accessToken);
      if (!res) return Response.json({ dataUrl: null });
    } else {
      res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
      if (!res.ok) {
        console.log(`[proxyImage] fetch failed: ${res.status} for ${url.slice(0, 100)}`);
        return Response.json({ dataUrl: null });
      }
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    console.log(`[proxyImage] OK contentType=${contentType}`);

    if (contentType.includes('text/html')) {
      console.log(`[proxyImage] got HTML response`);
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
    const mime = contentType.startsWith('image/') ? contentType.split(';')[0] : 'image/jpeg';
    return Response.json({ dataUrl: `data:${mime};base64,${base64}` });

  } catch (e) {
    console.log(`[proxyImage] error: ${e.message}`);
    return Response.json({ dataUrl: null });
  }
});