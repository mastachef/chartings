// Cloudflare Worker - Yahoo Finance CORS Proxy
// Deploy with: npx wrangler deploy

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    // Get the Yahoo Finance URL from the path
    const yahooPath = url.pathname.slice(1) + url.search

    if (!yahooPath) {
      return new Response(JSON.stringify({ error: 'Missing Yahoo Finance path' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    const yahooUrl = `https://query1.finance.yahoo.com/${yahooPath}`

    try {
      const response = await fetch(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      })

      const data = await response.text()

      return new Response(data, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60',
        },
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch from Yahoo Finance' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }
  },
}
