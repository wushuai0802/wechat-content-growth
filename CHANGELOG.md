# Changelog

All notable changes are documented here. The project follows Semantic Versioning.

## [1.0.0] - 2026-08-02

### Added

- Local-first Next.js operations console with synthetic demo data.
- Multi-source trend collection and candidate topic generation.
- Profit, cost, saturation, timeliness and risk-aware topic ranking.
- OpenAI-compatible local content and raster image provider integration.
- Content quality, editorial voice and risk review gates.
- Article review editor and WeChat material/draft integration.
- Outcome import, attribution, strategy learning and reporting.
- Cross-platform `.data/` storage with configurable `WCG_*` roots.
- Docker, GitHub Actions, CodeQL, Gitleaks and Dependabot configuration.
- Public documentation, contribution policy and AGPL-3.0 license.

### Security

- Operator APIs are restricted to loopback requests.
- WeChat callback is the only intentionally public API route.
- Publishing defaults to `draft_only` and requires human review.
