import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Convert a SharePoint file URL to a Graph API content URL
// e.g. https://tenant.sharepoint.com/sites/SiteName/Shared%20Documents/folder/file.jpg
// → https://graph.microsoft.com/v1.0/sites/tenant.sharepoint.com:/sites/SiteName:/drive/root:/folder/file.jpg:/content
function sharepointUrlToGraphUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname; // e.g. tenant.sharepoint.com
    const pathParts = parsed.pathname.split('/');
    
    // Find /sites/SiteName
    const sitesIdx = pathParts.indexOf('sites');
    if (sitesIdx < 0) return null;
    const siteName = pathParts[sitesIdx + 1];
    const sitePath = `/sites/${siteName}`;
    
    // Everything after the site is the file path (usually starts with /Shared Documents/...)
    const filePath = pathParts.slice(sitesIdx + 2).join('/');
    const decodedFilePath = decodeURIComponent(filePath);
    
    return `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}:/drive/root:/${decodedFilePath}:/content`;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await req.json();
  if (!url) return Response.json({ dataUrl: null });

  try {
    let fetchUrl = url;
    const headers = { 'User-Agent': 'Mozilla/5.0' };

    const isSharePoint = url.includes('sharepoint.com');
    if (isSharePoint) {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('share_point');
      headers['Authorization'] = `Bearer ${accessToken}`;
      const graphUrl = sharepointUrlToGraphUrl(url);
      if (graphUrl) {
        console.log(`[proxyImage] Using Graph API: ${graphUrl}`);
        fetchUrl = graphUrl;
      }
    }

    const res = await fetch(fetchUrl, { headers, redirect: 'follow' });

    if (!res.ok) {
      console.log(`[proxyImage] fetch failed: ${res.status} ${res.statusText} for ${url.slice(0, 100)}`);
      return Response.json({ dataUrl: null });
    }

    const contentType = res.headers.get('content-type') || 'image/png';
    console.log(`[proxyImage] OK contentType=${contentType}`);

    if (contentType.includes('text/html')) {
      console.log(`[proxyImage] got HTML (auth redirect?)`);
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
    const dataUrl = `data:${mime};base64,${base64}`;

    return Response.json({ dataUrl });
  } catch (e) {
    console.log(`[proxyImage] error: ${e.message}`);
    return Response.json({ dataUrl: null });
  }
});