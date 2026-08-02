# Architecture

## Design goals

- Local-first: operator data remains on the machine by default.
- Human review: generating content and publishing content are separate decisions.
- Adapter-friendly: external trend, model, image, publisher and metrics providers can be replaced.
- Evidence-aware: trend signals are leads, while publishable claims require verified sources.
- Profit-aware: revenue is evaluated together with generation cost, review cost and risk.

## Runtime flow

```text
Trend sources
    |
    v
Trend signals -> topic candidates -> scoring and experiment policy
                                      |
                                      v
                             content brief and draft
                                      |
                                      v
                         quality, voice and risk gates
                                      |
                                      v
                         visual plan and human review
                                      |
                                      v
                            WeChat draft creation
                                      |
                                      v
                         outcome import and learning
```

## Main modules

- `src/lib/hot-trend-service.ts`: collects and normalizes trend signals.
- `src/lib/trend-topic-generator.ts`: turns a signal into candidate angles.
- `src/lib/profit-optimizer.ts`: ranks candidates under cost and risk constraints.
- `src/lib/draft-generator.ts`: creates a local article package.
- `src/lib/content-quality-gate.ts`: checks publishability signals.
- `src/lib/editorial-voice-gate.ts`: detects formulaic writing patterns.
- `src/lib/article-visual-service.ts`: plans and tracks raster visual assets.
- `src/lib/wechat-publisher.ts`: integrates with WeChat material, draft and publish APIs.
- `src/lib/workspace-store.ts`: persists the single-node workspace to JSON.

## Storage

All default paths live under `.data/`:

```text
.data/runtime/data/workspace.json
.data/runtime/config/cpa.env
.data/runtime/config/wechat.env
.data/deliverables/articles/
.data/deliverables/images/
.data/backups/
```

Every root can be overridden with the `WCG_*` environment variables documented in `configuration.md`.
