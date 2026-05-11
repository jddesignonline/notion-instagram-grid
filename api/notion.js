export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID;

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

  const body = await req.json().catch(() => ({}));

  if (body.action === 'update-dates') {
    const updates = body.updates || [];
    await Promise.all(updates.map(({ id, date }) =>
      fetch(`https://api.notion.com/v1/pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            'publish date': { date: date ? { start: date } : null }
          }
        })
      })
    ));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ page_size: 100 })
  });

  const data = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data.message, code: data.code }), { status: res.status, headers });
  }

  const posts = data.results.map(page => {
    const props = page.properties;
    const files = props['attachment']?.files || [];
    const allImgs = files.map(f => f.type === 'external' ? f.external?.url : f.file?.url).filter(Boolean);
    const linkUrl = props['link']?.url || props['link']?.rich_text?.[0]?.plain_text || null;
    const format: allImgs.length > 1 ? 'carousel' : '',

    const img = allImgs[0] || linkUrl || null;
    const imgs = allImgs.length ? allImgs : (linkUrl ? [linkUrl] : []);

    return {
      id: page.id,
      name: props['name']?.title?.[0]?.plain_text || '',
      date: props['publish date']?.date?.start || null,
      pinned: props['pinned']?.checkbox === true,
      widget: props['widget']?.checkbox === true,
      format,
      img,
      imgs
    };
  })
  .filter(p => p.widget === true)
  .sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date) - new Date(a.date);
  });

  return new Response(JSON.stringify({ posts }), { status: 200, headers });
}
