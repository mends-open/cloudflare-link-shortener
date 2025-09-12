export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = url.pathname.replace(/^\//, "");

    let response;
    if (!slug) {
      response = notFound(env);
    } else {
      const encoded = await env.LINKS?.get(slug);
      if (!encoded) {
        response = notFound(env);
      } else {
        try {
          const target = atob(encoded);
          response = Response.redirect(target, 302);
        } catch (err) {
          response = notFound(env, 500);
        }
      }
    }

    ctx.waitUntil(logRequest(env, slug, request, response));
    return response;
  }
};

function notFound(env, status = 404) {
  if (env.FALLBACK_URL) {
    return Response.redirect(env.FALLBACK_URL, 302);
  }
  return new Response(status === 404 ? 'Not found' : 'Invalid URL', {
    status,
  });
}

async function logRequest(env, slug, request, response) {
  if (!env.LOG_ENDPOINT) return;
  const payload = {
    slug,
    request: {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers)
    },
    response: {
      status: response.status,
      headers: Object.fromEntries(response.headers)
    }
  };

  try {
    await fetch(env.LOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    // Swallow logging errors
  }
}
