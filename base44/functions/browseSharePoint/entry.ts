import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { search } = await req.json().catch(() => ({}));
    const query = search || '.pptx';

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("share_point");

    // Search for PPTX files across all drives the user has access to
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/search(q='${encodeURIComponent(query)}')?$select=id,name,webUrl,size,lastModifiedDateTime,@microsoft.graph.downloadUrl&$filter=endswith(name,'.pptx')&$top=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Graph API error: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    const files = (data.value || []).map(f => ({
      id: f.id,
      name: f.name,
      webUrl: f.webUrl,
      size: f.size,
      lastModified: f.lastModifiedDateTime,
      downloadUrl: f['@microsoft.graph.downloadUrl'],
    }));

    return Response.json({ files });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});