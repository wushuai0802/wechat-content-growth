# Contributing

## Development

1. Use Node.js 20 or newer.
2. Run `npm ci`.
3. Create a focused branch.
4. Add or update tests with behavior changes.
5. Run `npm test` and `npm run build` before opening a pull request.

## Pull requests

- Keep changes scoped and explain user-visible behavior.
- Do not submit real WeChat credentials, media IDs, article bodies, account metrics or browser profiles.
- Use synthetic fixtures in tests and documentation.
- Preserve the local-only API boundary unless the change includes authentication and a documented threat model.
- Do not enable automatic publishing by default.

By contributing, you agree that your contribution is licensed under AGPL-3.0-only.
