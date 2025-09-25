# Cloudflare Link Shortener

A Cloudflare Worker that turns short slugs into redirects using Cloudflare KV for storage.  
When a slug is requested the worker looks up the corresponding entry, decodes the stored destination URL, and issues a 302 redirect. If the slug is missing or invalid the request is sent to a configurable fallback URL.

## Features
- **Simple redirects** – map `https://your.worker.dev/my-slug` to a long URL stored in KV.
- **Fallback handling** – unknown or malformed slugs redirect to a default URL.
- **Structured logging (optional)** – capture request/response metadata into a second KV namespace for later analysis, compressed with gzip to save space.

## Prerequisites
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) 3.x
- A Cloudflare account with access to Workers and KV

## Configuration
1. Create two KV namespaces (one for links, one for logs) and bind them in `wrangler.json` as `LINKS` and `LOGS`. Logging is optional; if you do not need it you can remove the `LOGS` binding.
2. Set the `FALLBACK_URL` variable to the URL you want users to see when a slug is missing or invalid.

Update the placeholder IDs in `wrangler.json` with your actual namespace IDs:

```json
{
  "kv_namespaces": [
    { "binding": "LINKS", "id": "<your-links-namespace-id>" },
    { "binding": "LOGS", "id": "<your-logs-namespace-id>" }
  ],
  "vars": {
    "FALLBACK_URL": "https://example.com"
  }
}
```

### Populating the `LINKS` namespace
Each KV value is stored as a base64 encoded URL. You can add entries with Wrangler:

```bash
wrangler kv key put --binding=LINKS my-slug "$(printf '%s' 'https://destination.url' | base64)"
```

Now hitting `https://your.worker.dev/my-slug` will redirect to `https://destination.url`.

## Development
Start a local dev server with:

```bash
wrangler dev
```

Wrangler will emulate the Worker and KV bindings locally.

## Deployment
Deploy the Worker to Cloudflare:

```bash
wrangler deploy
```

After deployment you can manage links by updating the KV entries.

## License
Distributed under the MIT License. See [`LICENSE`](LICENSE).
