# Configuration guide

Copy [`.env.example`](.env.example) to `.env` in the project root and fill in values. Never commit `.env`.

## Required variables

| Variable | Description |
|----------|-------------|
| `NOTION_API_KEY` | Notion integration token ([My integrations](https://www.notion.so/my-integrations)) |
| `NOTION_USER_STORIES_DATABASE_ID` | 32-character User Stories database ID (no hyphens in value) |
| `NOTION_EPICS_DATABASE_ID` | 32-character Epics database ID |
| `NOTION_WEBHOOK_SECRET` | Secret from Notion → Integration → Webhooks |
| `JIRA_BASE_URL` | e.g. `https://yourcompany.atlassian.net` |
| `JIRA_EMAIL` | Jira account email |
| `JIRA_API_TOKEN` | [Atlassian API token](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_PROJECT_KEY` | Project key (e.g. `HAR`) |

## Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3003` | HTTP port |
| `NODE_ENV` | `development` | Use `production` in prod |

## Security and webhooks

| Variable | Description |
|----------|-------------|
| `AUTHORIZED_USERS` | Optional. Comma-separated **Notion user IDs**. If set, only these users can trigger certain flows; empty = no restriction. |
| `ALLOW_UNSIGNED_WEBHOOKS` | **Local dev only.** Set to `true` with `NODE_ENV` not `production` to accept webhook POSTs without a valid Notion signature (e.g. curl). **Never enable in production.** |

## Notifications

| Variable | Description |
|----------|-------------|
| `SCRUM_MASTER_EMAILS` | Comma-separated emails tagged on status changes (fallback: `SCRUM_MASTER_EMAIL`) |
| `ENABLE_STATUS_CHANGE_COMMENTS` | `true` to post Jira comments on status changes |

## Optional Jira custom field IDs

Only set these if your Jira instance uses different field IDs than the defaults in code.

| Variable | Typical default |
|----------|-----------------|
| `JIRA_STORY_POINTS_FIELD_ID` | `customfield_10016` |
| `JIRA_FIGMA_LINK_FIELD_ID` | `customfield_10021` |
| `JIRA_EPIC_TYPE_FIELD_ID` | `customfield_12224` |
| `JIRA_EPIC_TYPE_VALUE` | Epic type option id (e.g. `11209`) |
| `JIRA_EPIC_LINK_FIELD_ID` | `customfield_10011` |
| `JIRA_DEV_START_DATE_FIELD_ID` | `customfield_10020` |
| `JIRA_DEV_END_DATE_FIELD_ID` | `customfield_10022` |

## Kubernetes

Secrets are created from your `.env` when you run the deploy scripts. See [k8s/DEPLOYMENT_GUIDE.md](k8s/DEPLOYMENT_GUIDE.md) and [k8s/MINIKUBE_GUIDE.md](k8s/MINIKUBE_GUIDE.md). Do not commit real secrets; use `k8s/secrets.yaml.template` as a reference only.
