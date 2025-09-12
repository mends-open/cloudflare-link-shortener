export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const slug = url.pathname.replace(/^\//, "");

    if (!slug) {
      return notFound(env);
    }

    const binding = env.KV_BINDING || "link-shortener";
    const encoded = await env[binding]?.get(slug);
    if (!encoded) {
      return notFound(env);
    }

    try {
      const target = atob(encoded);
      return Response.redirect(target, 302);
    } catch (err) {
      return notFound(env, 500);
    }
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
