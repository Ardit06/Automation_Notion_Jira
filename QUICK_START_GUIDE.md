# Quick Start Guide - Notion to Jira Automation

## 🚀 Quick Setup (5 minutes)

### 1. Environment Setup
```bash
# Copy environment template
cp env.example .env

# Edit your .env file with your actual credentials
nano .env
```

### 2. Required Environment Variables
```bash
# Notion Configuration
NOTION_API_KEY=your_actual_notion_integration_token
NOTION_DATABASE_ID=your_actual_notion_database_id
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

### 3. Install and Build
```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### 4. Start the Service
```bash
# Start in development mode
npm run dev

# Or start in production mode
npm start
```

## 🧪 Quick Testing

### 1. Run Comprehensive Tests
```bash
# Run all tests
node test-automation.js
```

### 2. Test Individual Components
```bash
# Test server health
curl http://localhost:3003/webhook/health

# Test API connections
curl http://localhost:3003/webhook/test

# Test webhook endpoint
curl -X POST http://localhost:3003/webhook/notion \
  -H "Content-Type: application/json" \
  -d '{"type": "page.created", "entity": {"id": "test-page-id"}}'
```

### 3. Manual Sync Test
```bash
# Sync all "Ready For Dev" pages
curl -X POST http://localhost:3003/webhook/sync \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}'
```

## 🔧 Common Commands

### Development
```bash
# Start with auto-reload
npm run dev

# Watch mode with nodemon
npm run watch

# Build only
npm run build
```

### Testing
```bash
# Run comprehensive test suite
node test-automation.js

# Test specific page processing
curl -X POST http://localhost:3003/webhook/notion \
  -H "Content-Type: application/json" \
  -H "x-notion-signature-v2: manual-test" \
  -d '{
    "type": "page.properties_updated",
    "entity": {"id": "YOUR_PAGE_ID"}
  }'
```

### Monitoring
```bash
# Watch logs in real-time
tail -f logs/combined.log

# Check for errors
grep -i error logs/combined.log | tail -10

# Monitor specific page processing
grep "YOUR_PAGE_ID" logs/combined.log
```

## 🐛 Quick Troubleshooting

### Issue: 401 Unauthorized Errors
```bash
# Check environment variables
node -e "console.log(require('./dist/config/index.js').config)"

# Test Notion API directly
curl -H "Authorization: Bearer YOUR_NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/databases/YOUR_DATABASE_ID"

# Test Jira API directly  
curl -u "YOUR_EMAIL:YOUR_API_TOKEN" \
  "https://YOUR_DOMAIN.atlassian.net/rest/api/3/myself"
```

### Issue: 400 Bad Request Errors
```bash
# Check Notion database structure
curl -H "Authorization: Bearer YOUR_NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/databases/YOUR_DATABASE_ID" | jq '.properties'

# Verify page structure
curl -H "Authorization: Bearer YOUR_NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/pages/YOUR_PAGE_ID" | jq '.properties'
```

### Issue: Webhook Not Triggering
```bash
# Test webhook endpoint
curl -X POST http://localhost:3003/webhook/notion \
  -H "Content-Type: application/json" \
  -d '{"type": "page.created", "entity": {"id": "test"}}'

# Check webhook configuration in Notion
# URL should be: https://your-domain.com/webhook/notion
```

## 📋 Checklist

### Before Going Live
- [ ] All environment variables set correctly
- [ ] Notion integration has proper permissions
- [ ] Jira project is accessible
- [ ] Webhook URL is publicly accessible
- [ ] Database has required fields (Name, at least one rich_text field)
- [ ] All tests pass: `node test-automation.js`

### Daily Operations
- [ ] Monitor logs: `tail -f logs/combined.log`
- [ ] Check error rates: `grep -c "ERROR" logs/error.log`
- [ ] Verify webhook health: `curl http://localhost:3003/webhook/health`

## 🆘 Getting Help

1. **Check the logs first**: `tail -f logs/combined.log`
2. **Run the test suite**: `node test-automation.js`
3. **Check the troubleshooting guide**: `TROUBLESHOOTING_GUIDE.md`
4. **Verify environment setup**: Check all variables in `.env`

## 🔄 Automation Flow

1. **Notion Page Created/Updated** → Webhook triggered
2. **System Processes Page** → Extracts title, description, status
3. **Creates Jira Issue** → Story (normal) or Epic (high priority)
4. **Adds Link Back** → Updates Notion page with Jira link
5. **Logs Success** → Complete audit trail

## 📊 Monitoring

### Key Metrics to Watch
- Processing time per page
- Success/failure rates
- API response times
- Error patterns

### Log Patterns
- `🔄 Processing Notion page update` - Processing started
- `✅ Successfully created Jira issue` - Success
- `❌ Error` - Something failed
- `⚠️ Skipping` - Skipped (usually valid reason)

## 🚨 Emergency Procedures

### Stop Processing
```bash
# Kill the server
pkill -f "node.*index.js"
```

### Clear Logs
```bash
# Clear log files
> logs/combined.log
> logs/error.log
```

### Restart Service
```bash
# Rebuild and restart
npm run build && npm start
```
