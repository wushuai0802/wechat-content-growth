# Security Policy

## Supported version

Security fixes are applied to the latest `main` branch.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for this repository. Do not include secrets, access tokens, private article data or account identifiers in a public issue.

Include the affected route or module, reproduction steps, impact and any suggested mitigation. Credentials exposed during testing should be revoked immediately rather than waiting for a code fix.

## Deployment warning

This project has no user authentication. Keep the operator console on loopback and expose only `/api/wechat/callback` when a WeChat callback is required.
