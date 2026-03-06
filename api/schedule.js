const GAS_URL = 'https://script.google.com/macros/s/AKfycbxMnsFXRBdGN2AktwBTcCB9qRcHuQy11fPdN9bpQUB_QEDbWYOy6vdiOKsC9vFrJUOE/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch(GAS_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`GAS responded with ${response.status}`);
    }
    const html = await response.text();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-cache');
    res.status(502).json({ error: 'Failed to fetch schedule from source' });
  }
}
