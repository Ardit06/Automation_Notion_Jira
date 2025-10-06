# Notion to Jira Automation

Simple service that automatically syncs Notion database entries to Jira when their status changes to "Ready For Dev".

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your credentials
   ```

3. **Start the service:**
   ```bash
   npm run dev
   ```

## Configuration

Edit `.env` file with your credentials:

```env
# Notion Configuration
NOTION_API_KEY=your_notion_integration_token
NOTION_DATABASE_ID=your_notion_database_id
NOTION_WEBHOOK_SECRET=your_webhook_secret

# Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@domain.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=YOUR_PROJECT_KEY

# Server Configuration
PORT=3003
NODE_ENV=development

# Security
WEBHOOK_AUTH_USERS=your-username
```

## API Endpoints

- `GET /` - Service information
- `POST /webhook/notion` - Notion webhook endpoint
- `POST /webhook/sync` - Manual sync trigger
- `GET /webhook/test` - Test connections
- `GET /webhook/health` - Health check

## How It Works

1. Notion sends webhook when page status changes to "Ready For Dev"
2. Service verifies webhook and creates appropriate Jira issue
3. Links Stories to parent Epics if specified
4. Adds Jira URL back to Notion page

## License

MIT