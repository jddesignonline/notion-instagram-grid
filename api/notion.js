export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DATABASE_ID;

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
    const attachmentUrl = files[0]?.file?.url || files[0]?.external?.url || null;
    const linkUrl = props['link']?.url || props['link']?.rich_text?.[0]?.plain_text || null;
    const canvaUrl = props['canva link']?.url || props['canva link']?.rich_text?.[0]?.plain_text || null;
    const imageSource = (props['image source']?.select?.name || '').toLowerCase();

    let img = null;
    if (imageSource === 'notion') img = attachmentUrl;
    else if (imageSource === 'link') img = linkUrl;
    else if (imageSource === 'canva') img = canvaUrl;
    else img = attachmentUrl || linkUrl || canvaUrl;

    return {
      id: page.id,
      name: props['name']?.title?.[0]?.plain_text || '',
      date: props['publish date']?.date?.start || null,
      pinned: props['pinned']?.checkbox === true,
      widget: props['widget']?.checkbox === true,
      imageSource,
      img
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
