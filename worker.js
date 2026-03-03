// CaseFlow MVP - Lawyer Case Management System
// Built on Cloudflare Workers + KV

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Route: /api/cases - Case Management
    if (path === '/api/cases') {
      return handleCases(request, env, corsHeaders);
    }

    // Route: /api/cases/:id - Single Case
    if (path.match(/^\/api\/cases\/[^/]+$/)) {
      const id = path.split('/')[3];
      return handleCase(request, env, id, corsHeaders);
    }

    // Route: /api/schedules - Scheduling
    if (path === '/api/schedules') {
      return handleSchedules(request, env, corsHeaders);
    }

    // Route: /api/clients - Client Management
    if (path === '/api/clients') {
      return handleClients(request, env, corsHeaders);
    }

    // Route: /api/waitlist - Waitlist (existing)
    if (path === '/api/waitlist') {
      return handleWaitlist(request, env, corsHeaders);
    }

    // Route: /api/stats - Dashboard Stats
    if (path === '/api/stats') {
      return handleStats(request, env, corsHeaders);
    }

    // Default: Return API info
    return new Response(JSON.stringify({
      api: 'CaseFlow v1.0',
      endpoints: [
        'GET/POST /api/cases - List/Create cases',
        'GET/PUT/DELETE /api/cases/:id - Manage single case',
        'GET/POST /api/schedules - List/Create appointments',
        'GET/POST /api/clients - List/Create clients',
        'GET/POST /api/waitlist - Waitlist management',
        'GET /api/stats - Dashboard statistics'
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

// ============== Helpers ==============
async function getAll(env, kv, key) {
  const data = await kv.get(key);
  return data ? JSON.parse(data) : [];
}

async function setAll(env, kv, key, data) {
  await kv.put(key, JSON.stringify(data));
}

// ============== Case Management ==============
async function handleCases(request, env, corsHeaders) {
  const method = request.method;

  if (method === 'GET') {
    const cases = await getAll(env, env.CASES_KV, 'all');
    // Sort by updated_at desc
    cases.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
    return new Response(JSON.stringify(cases.slice(0, 100)), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (method === 'POST') {
    try {
      const { title, description, client_name, status, priority } = await request.json();

      if (!title) {
        return new Response(JSON.stringify({ error: 'Title is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const id = crypto.randomUUID();
      const now = Date.now();
      const newCase = {
        id,
        title,
        description: description || '',
        client_name: client_name || '',
        status: status || 'active',
        priority: priority || 'medium',
        created_at: now,
        updated_at: now
      };

      const cases = await getAll(env, env.CASES_KV, 'all');
      cases.push(newCase);
      await setAll(env, env.CASES_KV, 'all', cases);

      return new Response(JSON.stringify({ success: true, case: newCase }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

async function handleCase(request, env, id, corsHeaders) {
  const method = request.method;
  const cases = await getAll(env, env.CASES_KV, 'all');
  const caseIndex = cases.findIndex(c => c.id === id);

  if (method === 'GET') {
    if (caseIndex === -1) {
      return new Response(JSON.stringify({ error: 'Case not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify(cases[caseIndex]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (method === 'PUT') {
    if (caseIndex === -1) {
      return new Response(JSON.stringify({ error: 'Case not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const { title, description, client_name, status, priority } = await request.json();
      cases[caseIndex] = {
        ...cases[caseIndex],
        title: title ?? cases[caseIndex].title,
        description: description ?? cases[caseIndex].description,
        client_name: client_name ?? cases[caseIndex].client_name,
        status: status ?? cases[caseIndex].status,
        priority: priority ?? cases[caseIndex].priority,
        updated_at: Date.now()
      };
      await setAll(env, env.CASES_KV, 'all', cases);

      return new Response(JSON.stringify({ success: true, case: cases[caseIndex] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  if (method === 'DELETE') {
    if (caseIndex === -1) {
      return new Response(JSON.stringify({ error: 'Case not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    cases.splice(caseIndex, 1);
    await setAll(env, env.CASES_KV, 'all', cases);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405 });
}

// ============== Scheduling ==============
async function handleSchedules(request, env, corsHeaders) {
  const method = request.method;

  if (method === 'GET') {
    const schedules = await getAll(env, env.SCHEDULES_KV, 'all');
    schedules.sort((a, b) => (a.scheduled_at || 0) - (b.scheduled_at || 0));
    return new Response(JSON.stringify(schedules.slice(0, 100)), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (method === 'POST') {
    try {
      const { title, case_id, client_name, scheduled_at, duration, notes } = await request.json();

      if (!title || !scheduled_at) {
        return new Response(JSON.stringify({ error: 'Title and scheduled_at are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const id = crypto.randomUUID();
      const newSchedule = {
        id,
        title,
        case_id: case_id || '',
        client_name: client_name || '',
        scheduled_at: parseInt(scheduled_at),
        duration: duration || 60,
        notes: notes || '',
        created_at: Date.now()
      };

      const schedules = await getAll(env, env.SCHEDULES_KV, 'all');
      schedules.push(newSchedule);
      await setAll(env, env.SCHEDULES_KV, 'all', schedules);

      return new Response(JSON.stringify({ success: true, schedule: newSchedule }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

// ============== Client Management ==============
async function handleClients(request, env, corsHeaders) {
  const method = request.method;

  if (method === 'GET') {
    const clients = await getAll(env, env.CLIENTS_KV, 'all');
    clients.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    return new Response(JSON.stringify(clients.slice(0, 100)), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (method === 'POST') {
    try {
      const { name, email, phone, company, notes } = await request.json();

      if (!name) {
        return new Response(JSON.stringify({ error: 'Name is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const id = crypto.randomUUID();
      const newClient = {
        id,
        name,
        email: email || '',
        phone: phone || '',
        company: company || '',
        notes: notes || '',
        created_at: Date.now()
      };

      const clients = await getAll(env, env.CLIENTS_KV, 'all');
      clients.push(newClient);
      await setAll(env, env.CLIENTS_KV, 'all', clients);

      return new Response(JSON.stringify({ success: true, client: newClient }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

// ============== Waitlist ==============
async function handleWaitlist(request, env, corsHeaders) {
  const method = request.method;

  if (method === 'GET') {
    const emails = await getAll(env, env.WAITLIST_KV, 'emails');
    return new Response(JSON.stringify({ count: emails.length, emails }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (method === 'POST') {
    try {
      const { email } = await request.json();

      if (!email || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Invalid email' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const emails = await getAll(env, env.WAITLIST_KV, 'emails');

      if (emails.find(e => e.email === email)) {
        return new Response(JSON.stringify({ message: 'Email already registered' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      emails.push({ email, timestamp: Date.now() });
      await setAll(env, env.WAITLIST_KV, 'emails', emails);

      return new Response(JSON.stringify({ success: true, count: emails.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

// ============== Dashboard Stats ==============
async function handleStats(request, env, corsHeaders) {
  try {
    const cases = await getAll(env, env.CASES_KV, 'all');
    const schedules = await getAll(env, env.SCHEDULES_KV, 'all');
    const clients = await getAll(env, env.CLIENTS_KV, 'all');
    const waitlist = await getAll(env, env.WAITLIST_KV, 'emails');

    return new Response(JSON.stringify({
      cases: cases.length,
      schedules: schedules.length,
      clients: clients.length,
      waitlist: waitlist.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
