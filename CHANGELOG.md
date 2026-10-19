# Changelog

All notable changes are documented here. The project follows Semantic Versioning.

## [Unreleased]

### Security

- Update Next.js 15 and sharp to patched releases and refresh vulnerable transitive dependencies.
- Upgrade Vitest to the maintained 4.1 line to remove vulnerable mocker and worker-pool dependencies.
- Keep Vite on the compatible 7.x line for the existing TSX test configuration.
- Include development dependencies in the high-severity audit gate for local checks and CI.

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
