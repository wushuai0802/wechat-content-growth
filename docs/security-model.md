# Security Model

## Intended deployment

The operator console is a local application. It does not implement user authentication, tenant isolation or Internet-facing session management.

The default development and production commands bind to `127.0.0.1`. API middleware validates the request hostname, `Host` header and optional `Origin` header. The WeChat callback route is the sole deliberate exception because WeChat servers must reach it.

## Reverse proxy rule

Only proxy this path when a public callback is required:

```text
/api/wechat/callback
```

Do not proxy the application root or the remaining `/api` routes. Add TLS, request size limits, rate limits and access logs at the proxy.

## Secret handling

- Store secrets in environment variables or `.data/runtime/config/*.env`.
- Keep `.data/`, `.env*`, logs and browser profiles outside Git.
- Rotate WeChat and provider credentials after any suspected disclosure.
- Run a full-history secret scan before changing repository visibility to public.

## Content safety

Trend entries are discovery signals, not verified claims. Articles must pass human fact checking, source review, copyright review and platform-policy review before publication.

The project defaults to creating drafts. Automated mass sending, deleting drafts and bypassing human review are outside the supported safety model.
