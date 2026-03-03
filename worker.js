export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'POST') {
      try {
        const { email } = await request.json();

        if (!email || !email.includes('@')) {
          return new Response(JSON.stringify({ error: 'Invalid email' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get existing emails from KV
        const existing = await env.WAITLIST_KV.get('emails');
        const emails = existing ? JSON.parse(existing) : [];

        // Check for duplicates
        if (emails.find(e => e.email === email)) {
          return new Response(JSON.stringify({ message: 'Email already registered' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Add new email
        emails.push({ email, timestamp: Date.now() });
        await env.WAITLIST_KV.put('emails', JSON.stringify(emails));

        return new Response(JSON.stringify({ success: true, count: emails.length }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (request.method === 'GET') {
      const existing = await env.WAITLIST_KV.get('emails');
      const emails = existing ? JSON.parse(existing) : [];
      return new Response(JSON.stringify({ count: emails.length, emails }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  }
};
