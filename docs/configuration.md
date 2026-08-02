# Configuration

## Path variables

| Variable | Description |
| --- | --- |
| `WCG_PROJECT_ROOT` | Project root used to resolve defaults. |
| `WCG_DATA_ROOT` | Root for local runtime data and deliverables. |
| `WCG_RUNTIME_ROOT` | Runtime JSON, logs and provider configuration. |
| `WCG_OPS_ROOT` | Optional operations directory. |
| `WCG_DELIVERABLES_ROOT` | Generated article, image and report directory. |
| `WCG_BACKUPS_ROOT` | Backup directory. |
| `WCG_WECHAT_CONFIG_FILE` | Explicit path to `wechat.env`. |

Relative paths are resolved from the process working directory. The default layout is under `<project>/.data`.

## Content provider

The content provider must expose an OpenAI-compatible API on a loopback address. Remote provider URLs are rejected by design.

```dotenv
CPA_BASE_URL=http://127.0.0.1:8317/v1
CPA_API_KEY=replace_me
CPA_MODEL=gpt-5.4-mini
```

The same values may be stored in `.data/runtime/config/cpa.env` through the local management UI.

## WeChat

```dotenv
WECHAT_APP_ID=wx_your_app_id
WECHAT_APP_SECRET=replace_me
WECHAT_TOKEN=replace_me
WECHAT_ENCODING_AES_KEY=
WECHAT_CALLBACK_URL=https://your-domain.example/api/wechat/callback
WECHAT_PUBLISH_MODE=draft_only
```

Keep `WECHAT_PUBLISH_MODE=draft_only` until credentials, IP allowlists, callback verification, image uploads and draft creation have all been tested.

Do not commit any populated environment file. If a credential is accidentally committed, revoke it first and then remove it from Git history.
