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
  if (!env.LOGS) return;
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
    },
    timestamp: new Date().toISOString()
  };

  try {
    const logKey = `${slug}:${generateUuidV7()}`;
    const encoded = await compressToBase64(payload);
    await env.LOGS.put(logKey, encoded);
  } catch (err) {
    log('log-error', { err: err.message });
  }
}

async function compressToBase64(data) {
  const text = JSON.stringify(data);
  const encoder = new TextEncoder();
  const input = encoder.encode(text);
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  await writer.write(input);
  await writer.close();
  const compressed = await new Response(stream.readable).arrayBuffer();
  return arrayBufferToBase64(compressed);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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

function generateUuidV7() {
  const now = BigInt(Date.now());
  const timeHigh = now >> 12n;
  const timeLow = Number(now & 0xfffn);
  const bytes = new Uint8Array(16);
  const cryptoObj = globalThis.crypto;

  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues is not supported');
  }

  bytes[0] = Number((timeHigh >> 40n) & 0xffn);
  bytes[1] = Number((timeHigh >> 32n) & 0xffn);
  bytes[2] = Number((timeHigh >> 24n) & 0xffn);
  bytes[3] = Number((timeHigh >> 16n) & 0xffn);
  bytes[4] = Number((timeHigh >> 8n) & 0xffn);
  bytes[5] = Number(timeHigh & 0xffn);
  bytes[6] = 0x70 | (timeLow >> 8);
  bytes[7] = timeLow & 0xff;

  const rand = cryptoObj.getRandomValues(new Uint8Array(8));
  bytes[8] = (rand[0] & 0x3f) | 0x80;
  bytes[9] = rand[1];
  bytes[10] = rand[2];
  bytes[11] = rand[3];
  bytes[12] = rand[4];
  bytes[13] = rand[5];
  bytes[14] = rand[6];
  bytes[15] = rand[7];

  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}
