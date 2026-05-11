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
    body: JSON.stringify({
      page_size: 30,
      sorts: [{ property: 'publish date', direction: 'descending' }]
    })
  });

  const data = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data.message, code: data.code }), { status: res.status, headers });
  }

  const posts = data.results.map(page => {
    const props = page.properties;
    const files = props['attachment']?.files || [];
    const img = files[0]?.file?.url || files[0]?.external?.url || null;
    return {
      id: page.id,
      name: props['content']?.title?.[0]?.plain_text || '',
      date: props['publish date']?.date?.start || null,
      img
    };
  });

  return new Response(JSON.stringify({ posts }), { status: 200, headers });
}
