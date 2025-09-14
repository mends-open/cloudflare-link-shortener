export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = url.pathname.replace(/^\//, "");
    log('slug', { slug });
    let res;
    if (slug && !/^[-\w]+$/.test(slug)) {
      log('bad-slug', { slug });
      res = goHome(env);
    } else if (!slug) {
      log('no-slug');
      res = goHome(env);
    } else {
      const encoded = await env.LINKS?.get(slug);
      if (!encoded) {
        log('miss', { slug });
        res = goHome(env);
      } else {
        try {
          const target = atob(encoded);
          log('hit', { slug, target });
          res = Response.redirect(target, 302);
          ctx.waitUntil(sendLog(env, slug, request, res));
        } catch (err) {
          log('decode-error', { slug });
          res = goHome(env);
        }
      }
    }
    return res;
  }
};

function goHome(env) {
  const target = env.FALLBACK_URL;
  if (!target) {
    return new Response("FALLBACK_URL not configured", { status: 500 });
  }
  return Response.redirect(target, 302);
}

async function sendLog(env, slug, request, res) {
  if (!env.LOG_ENDPOINT) return;
  const payload = {
    slug,
    request: {
      method: request.method,
      url: request.url,
      cf: request.cf,
      headers: cleanHeaders(request.headers)
    },
    response: {
      status: res.status,
      headers: cleanHeaders(res.headers)
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
    log('log-error', { err: err.message });
  }
}

function cleanHeaders(headers) {
  const forbidden = new Set([
    'authorization',
    'cookie',
    'cf-access-client-id',
    'cf-access-client-secret'
  ]);
  const result = {};
  for (const [key, value] of headers.entries()) {
    if (!forbidden.has(key.toLowerCase())) {
      result[fixHeader(key)] = value;
    }
  }
  return result;
}

function fixHeader(name) {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
}

function log(msg, data) {
  if (data) {
    console.log(msg, data);
  } else {
    console.log(msg);
  }
}
