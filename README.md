# 🔄 ZJira - Notion to Jira Automation

Automated integration between Notion and Jira with smart status change handling and user tagging.

## ✨ Features

- **🔄 Automatic Status Sync**: Notion page status changes sync to Jira issues
- **🏷️ Smart Tagging**: Automatically tags users when status changes to "Ready For Dev"
- **📧 Multi-User Notifications**: Tag multiple scrum masters in comments
- **🔍 Comment Monitoring**: Monitors Jira comments and notifies relevant users

## 🚀 Quick Start

### 1. Setup Environment
```bash
# Copy environment template
cp config/environment.example .env

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

## 🔧 Configuration

### Required Environment Variables
```env
# Notion Configuration
NOTION_API_KEY=your_notion_api_key
NOTION_USER_STORIES_DATABASE_ID=your_user_stories_db_id
NOTION_EPICS_DATABASE_ID=your_epics_db_id
NOTION_WEBHOOK_SECRET=your_webhook_secret

# Jira Configuration (Single User)
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@domain.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=PROJECT_KEY

# Server Configuration
PORT=3003
NODE_ENV=development

# Notifications (comma-separated emails to tag)
SCRUM_MASTER_EMAILS=person1@domain.com,person2@domain.com
ENABLE_STATUS_CHANGE_COMMENTS=true
```

## 🛠️ Scripts

### Development
```bash
npm run dev          # Start development server
npm run build        # Build TypeScript
npm run watch        # Watch mode for development
```

## 🚀 Deployment

### GitHub Actions
- Automated testing and deployment
- See: `.github/workflows/`

### Manual Deployment
1. Build the project: `npm run build`
2. Set environment variables on your hosting platform
3. Start the service: `npm start`

## 🔧 Troubleshooting

### Common Issues
- **Webhook Verification Failed**: Check `NOTION_WEBHOOK_SECRET`
- **Jira Authentication Error**: Verify `JIRA_EMAIL` and `JIRA_API_TOKEN`
- **Database Access Denied**: Ensure Notion integration has proper permissions

### Logs
- Check `logs/combined.log` for detailed information
- Error logs are in `logs/error.log`

## 📚 API Documentation

### Webhook Endpoint
- **URL**: `/webhook/notion`
- **Method**: POST
- **Headers**: `Notion-Signature` for verification

### Health Check
- **URL**: `/health`
- **Method**: GET
- **Response**: Service status and connection tests

## 📘 Complete Documentation

See `COMPREHENSIVE_GUIDE.md` for:
- Detailed setup instructions
- "What Happens When..." scenarios
- Complete troubleshooting guide
- API reference
- Security best practices
- Advanced configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details
