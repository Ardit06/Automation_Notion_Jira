# 🔄 ZJira - Notion to Jira Automation

Automated integration between Notion and Jira with smart status change handling and user tagging.

## ✨ Features

- **🔄 Automatic Status Sync**: Notion page status changes sync to Jira issues
- **🏷️ Smart Tagging**: Automatically tags users when status changes to "Ready For Dev"
- **📧 Email Notifications**: Sends notifications for status changes and comments
- **🔍 Comment Monitoring**: Monitors Jira comments and notifies relevant users
- **🔄 Secret Rotation**: Automated token rotation with GitHub Actions and cron jobs

## 🚀 Quick Start

### 1. Setup Environment
```bash
# Copy environment template
cp env.example .env

# Edit .env with your credentials
nano .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build and Run
```bash
npm run build
npm start
```

### 4. Test Credentials
```bash
node test-credentials.js
```

## 🔧 Configuration

### Required Environment Variables
```bash
# Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@domain.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=PROJECT_KEY

# Notion Configuration
NOTION_API_KEY=your-notion-api-key
NOTION_DATABASE_ID=your-database-id

# Email Configuration
EMAIL_SERVICE=your-email-service
EMAIL_USER=your-email@domain.com
EMAIL_PASS=your-email-password
```

### Optional Configuration
```bash
# Enable/disable features
ENABLE_STATUS_CHANGE_COMMENTS=true
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_COMMENT_MONITORING=true

# Default users
SCRUM_MASTER_EMAIL=scrum-master@domain.com
DEFAULT_READY_FOR_DEV_USER=user@domain.com
```

## 🔄 Secret Rotation

### GitHub Actions (Recommended)
- Workflows run monthly automatically
- Can be triggered manually
- See: `.github/workflows/`

### Local Cron Job
```bash
# Setup local rotation
./setup-cron-rotation.sh

# Manual rotation
node rotate-tokens.js
```

### Manual Rotation
1. Generate new tokens from Notion and Jira
2. Update `.env` file
3. Test with `node test-credentials.js`
4. Update GitHub secrets if using GitHub Actions

## 📚 Documentation

- **Setup Guide**: `QUICK_START_GUIDE.md`
- **Webhook Setup**: `NOTION_WEBHOOK_SETUP.md`
- **Tagging Guide**: `READY_FOR_DEV_TAGGING_GUIDE.md`
- **Secret Rotation**: `SECRET_ROTATION_GUIDE.md`
- **Database Setup**: `DUAL_DATABASE_SETUP.md`
- **Webhook Verification**: `WEBHOOK_VERIFICATION_GUIDE.md`

## 🛠️ Development

### Project Structure
```
src/
├── config/          # Configuration files
├── routes/          # API routes
├── services/        # Core services
│   ├── automationService.ts
│   ├── jiraService.ts
│   ├── notionService.ts
│   ├── emailService.ts
│   └── commentMonitorService.ts
└── types/           # TypeScript type definitions
```

### Available Scripts
```bash
npm run build        # Build TypeScript
npm start           # Start the application
npm run dev         # Start in development mode
```

### Testing
```bash
node test-credentials.js  # Test API credentials
```

## 🔍 Monitoring

### Health Checks
```bash
curl http://localhost:3003/webhook/health
```

### Logs
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Rotation logs: `logs/token-rotation.log`

## 🚨 Troubleshooting

### Common Issues
1. **Authentication Errors**: Check token expiration and permissions
2. **404 Errors**: Verify database IDs and project keys
3. **Connection Issues**: Check network and API endpoints

### Debug Mode
```bash
DEBUG=* npm start
```

## 📝 License

Private project for internal use.

## 🤝 Support

For issues and questions, check the troubleshooting guides or contact the development team.