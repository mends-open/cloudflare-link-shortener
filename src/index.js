export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = url.pathname.replace(/^\//, "");

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

const DEFAULT_FALLBACK = "https://polskilekarz.eu";

function redirectFallback(env) {
  const target = env.FALLBACK_URL || DEFAULT_FALLBACK;
  return Response.redirect(target, 302);
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
