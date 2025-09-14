export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = url.pathname.replace(/^\//, "");

    let target = null;
    let found = false;

    if (slug && /^[-\w]+$/.test(slug)) {
      const encoded = await env.LINKS?.get(slug);
      if (encoded) {
        try {
          target = atob(encoded);
          found = true;
        } catch (err) {
          // invalid base64, fall through to fallback
        }
      }
    }

    const response = target ? Response.redirect(target, 302) : redirectFallback(env);
    ctx.waitUntil(logRequest(env, request, response, found));
    return response;
  }
};

function redirectFallback(env) {
  const target = env.FALLBACK_URL;
  if (!target) {
    return new Response("FALLBACK_URL not configured", { status: 500 });
  }
  return Response.redirect(target, 302);
}

async function logRequest(env, request, response, found) {
  if (!env.LOG_ENDPOINT) return;
  const payload = {
    found,
    request: {
      method: request.method,
      url: request.url,
      cf: request.cf,
      headers: sanitizeHeaders(request.headers)
    },
    response: {
      status: response.status,
      headers: sanitizeHeaders(response.headers)
    }
  };

  try {
    await fetch(env.LOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET
          ? {
              'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
              'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET
            }
          : {})
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    // Swallow logging errors
  }
}

function sanitizeHeaders(headers) {
  const forbidden = new Set([
    'authorization',
    'cookie',
    'cf-access-client-id',
    'cf-access-client-secret'
  ]);
  const result = {};
  for (const [key, value] of headers.entries()) {
    if (!forbidden.has(key.toLowerCase())) {
      result[canonicalHeaderName(key)] = value;
    }
  }
  return result;
}

function canonicalHeaderName(name) {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
}
