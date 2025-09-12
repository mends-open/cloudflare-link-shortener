export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = url.pathname.replace(/^\//, "");
    if (slug && !/^[-\w]+$/.test(slug)) {
      return redirectFallback(env);
    }

    let response;
    if (!slug) {
      response = redirectFallback(env);
    } else {
      const encoded = await env.LINKS?.get(slug);
      if (!encoded) {
        response = redirectFallback(env);
      } else {
        try {
          const target = atob(encoded);
          response = Response.redirect(target, 302);
        } catch (err) {
          response = redirectFallback(env);
        }
      }
    }

    ctx.waitUntil(logRequest(env, slug, request, response));
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

async function logRequest(env, slug, request, response) {
  if (!env.LOG_ENDPOINT) return;
  const payload = {
    slug,
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
        'content-type': 'application/json',
        ...(env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET
          ? {
              'cf-access-client-id': env.CF_ACCESS_CLIENT_ID,
              'cf-access-client-secret': env.CF_ACCESS_CLIENT_SECRET
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
      result[key] = value;
    }
  }
  return result;
}
