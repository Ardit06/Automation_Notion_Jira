# 🔄 Notion-Jira Automation Service

Automated integration between Notion and Jira with smart status change handling, user tagging, and bi-directional synchronization.

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Complete Setup Guide](#-complete-setup-guide)
- [Project Structure](#-project-structure)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Scripts](#-scripts)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Documentation](#-documentation)

## ✨ Features

- **🔄 Automatic Issue Creation**: Creates Jira tickets when Notion pages reach specific statuses
- **🔄 Status Change Monitoring**: Tracks and responds to status changes in Notion
- **🏷️ Smart Tagging**: Automatically tags scrum masters when status changes to "Review"
- **🔍 Duplicate Detection**: Prevents creation of duplicate Jira issues
- **🎨 Figma Link Integration**: Automatically transfers Figma links from Notion to Jira
- **📊 Epic-Story Linking**: Automatically links Stories to their parent Epics
- **📝 Content Synchronization**: Updates Jira descriptions with latest Notion content
- **🔒 Webhook Security**: Verifies Notion webhook signatures for security
- **📧 Multi-User Notifications**: Tag multiple scrum masters in comments

## 🎯 Prerequisites

Before setting up the project, ensure you have:

1. **Node.js & npm**
   - Node.js 18.x or higher
   - npm 9.x or higher
   - Verify: `node --version` and `npm --version`

2. **Notion Account & Integration**
   - Notion workspace account
   - Notion integration (API key)
   - Access to User Stories database
   - Access to Epics database
   - Webhook secret from Notion

3. **Jira Account & API Access**
   - Jira Cloud account (or Jira Server/Data Center)
   - API token generated
   - Project access permissions
   - Admin access to configure custom fields (optional)

4. **Development Tools (Optional)**
   - Git for version control
   - Docker & Docker Compose (for containerized deployment)
   - A code editor (VS Code, etc.)

## 🚀 Quick Start

### Minimal Setup (5 minutes)

```bash
# 1. Clone or download the project
git clone <repository-url>
cd Automation_Jira_Notion

# 2. Install dependencies
npm install

# 3. Create environment file
cat > .env << EOF
# Notion Configuration
NOTION_API_KEY=your_notion_api_key
NOTION_USER_STORIES_DATABASE_ID=your_user_stories_db_id
NOTION_EPICS_DATABASE_ID=your_epics_db_id
NOTION_WEBHOOK_SECRET=your_webhook_secret

# Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@domain.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=PROJECT_KEY

# Server Configuration
PORT=3003
NODE_ENV=development

# Notifications (comma-separated)
SCRUM_MASTER_EMAILS=person1@domain.com,person2@domain.com
ENABLE_STATUS_CHANGE_COMMENTS=true
EOF

# 4. Build the project
npm run build

# 5. Start the server
npm start
```

The server will start on `http://localhost:3003`

## 📖 Complete Setup Guide

### Step 1: Project Setup

#### 1.1 Clone or Download Project

```bash
# Using Git
git clone <repository-url>
cd Automation_Jira_Notion

# Or download and extract ZIP file
```

#### 1.2 Install Dependencies

```bash
npm install
```

This installs all required packages:
- `express` - Web server framework
- `axios` - HTTP client for API calls
- `dotenv` - Environment variable management
- `winston` - Logging system
- `typescript` - TypeScript compiler
- And development dependencies (nodemon, ts-node, etc.)

#### 1.3 Verify Installation

```bash
# Check Node.js version (should be 18+)
node --version

# Check npm version
npm --version

# Verify dependencies installed
ls node_modules/ | head -5
```

### Step 2: Notion Setup

#### 2.1 Create Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Fill in:
   - **Name**: "Jira Automation" (or your preferred name)
   - **Logo**: (optional)
   - **Associated workspace**: Select your workspace
4. Click **"Submit"**
5. Copy the **Internal Integration Token** (starts with `secret_...`)

#### 2.2 Grant Database Access

1. Open your **User Stories** database in Notion
2. Click **"..."** (three dots) in the top-right
3. Select **"Connections"** → **"Add connections"**
4. Select your integration
5. Repeat for **Epics** database

#### 2.3 Get Database IDs

1. Open your User Stories database
2. Look at the URL: `https://www.notion.so/[WORKSPACE]/[DATABASE_ID]?v=...`
3. The Database ID is the 32-character string between the workspace name and `?v=`
4. Remove all hyphens (`-`) from the ID
5. Repeat for Epics database

Example:
- URL: `https://www.notion.so/abc123/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6?v=...`
- Database ID: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

#### 2.4 Create Webhook and Get Secret

1. Go to your Notion workspace settings
2. Navigate to **"Connections"** → **"Integrations"**
3. Find your integration and click **"..."** → **"Manage webhooks"**
4. Click **"New webhook"**
5. Configure:
   - **Name**: "Jira Sync Webhook"
   - **Database**: Select both User Stories and Epics databases
   - **Events**: Select "Page created" and "Page updated"
   - **URL**: `https://your-domain.com/webhook/notion` (update after deployment)
6. Copy the **Webhook Secret** (used for signature verification)

### Step 3: Jira Setup

#### 3.1 Create API Token

1. Go to [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **"Create API token"**
3. Enter a label (e.g., "Notion Automation")
4. Click **"Create"**
5. **Copy the token immediately** (it won't be shown again)

#### 3.2 Get Jira Configuration

1. **Base URL**: Your Jira instance URL
   - Cloud: `https://[your-domain].atlassian.net`
   - Server/Data Center: `https://jira.yourcompany.com`

2. **Email**: Your Jira account email

3. **Project Key**: 
   - Go to your Jira project
   - The Project Key is visible in the project URL or project settings
   - Example: If URL is `.../projects/PROJ`, the key is `PROJ`

#### 3.3 (Optional) Configure Custom Fields

If you want to use custom fields for Story Points, Figma Links, or Epic Types:

1. Go to **Jira Settings** → **Issues** → **Custom Fields**
2. Find the custom field ID:
   - Click on the field name
   - Look at the URL: `.../customfields/[ID]`
   - Or use Jira REST API to list custom fields

Common field IDs (may vary by instance):
- Story Points: Usually `customfield_10016`
- Epic Type: Usually `customfield_12224`
- Custom link fields: Varies

### Step 4: Environment Configuration

#### 4.1 Create .env File

Create a `.env` file in the project root:

```bash
touch .env
```

#### 4.2 Add Configuration

Open `.env` in your editor and add:

```env
# ============================================
# NOTION CONFIGURATION
# ============================================
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_USER_STORIES_DATABASE_ID=your_32_character_database_id_without_hyphens
NOTION_EPICS_DATABASE_ID=your_32_character_database_id_without_hyphens
NOTION_WEBHOOK_SECRET=your_webhook_secret_from_notion

# ============================================
# JIRA CONFIGURATION
# ============================================
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@domain.com
JIRA_API_TOKEN=your_api_token_from_atlassian
JIRA_PROJECT_KEY=PROJECT_KEY

# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=3003
NODE_ENV=development

# ============================================
# NOTIFICATIONS (Optional)
# ============================================
# Comma-separated list of email addresses to tag in Jira comments
SCRUM_MASTER_EMAILS=scrum.master1@domain.com,scrum.master2@domain.com
ENABLE_STATUS_CHANGE_COMMENTS=true

# ============================================
# CUSTOM FIELD IDs (Optional - uses defaults)
# ============================================
# Only set these if your Jira instance uses different custom field IDs
# JIRA_STORY_POINTS_FIELD_ID=customfield_10016
# JIRA_FIGMA_LINK_FIELD_ID=customfield_10021
# JIRA_EPIC_TYPE_FIELD_ID=customfield_12224
# JIRA_EPIC_TYPE_VALUE=11209

# ============================================
# SECURITY (Optional)
# ============================================
# Comma-separated list of authorized user emails for manual sync
# AUTHORIZED_USERS=user1@domain.com,user2@domain.com
```

#### 4.3 Verify .env File

```bash
# Check file exists and has content (don't print secrets in shared terminals!)
cat .env | grep -E "^[A-Z_]+=" | wc -l
# Should show number of configured variables
```

**⚠️ Important**: Never commit `.env` to version control! It contains sensitive secrets.

### Step 5: Build and Test

#### 5.1 Build TypeScript

```bash
npm run build
```

This compiles TypeScript source code in `src/` to JavaScript in `dist/`.

#### 5.2 Test Connections

Before starting the server, test your configuration:

```bash
# Start the server
npm start

# In another terminal, test connections
curl http://localhost:3003/webhook/test
```

Expected response:
```json
{
  "notion": true,
  "jira": true
}
```

If either connection fails, check:
- `.env` file has correct values
- Network connectivity
- API credentials are valid

#### 5.3 Health Check

```bash
curl http://localhost:3003/webhook/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

#### 5.4 View Logs

```bash
# View all logs
tail -f logs/combined.log

# View only errors
tail -f logs/error.log
```

### Step 6: Configure Notion Webhook URL

Once your server is deployed and accessible:

1. Go back to Notion webhook settings
2. Update the webhook URL to your server endpoint:
   - Development (local): Use a tunneling service like `ngrok`:
     ```bash
     ngrok http 3003
     # Use the https URL: https://xxxxx.ngrok.io/webhook/notion
     ```
   - Production: `https://your-domain.com/webhook/notion`
3. Save the webhook configuration

## 📁 Project Structure

```
Automation_Jira_Notion/
├── src/                          # TypeScript source code
│   ├── config/
│   │   └── index.ts             # Configuration management
│   ├── routes/
│   │   └── webhook.ts           # Webhook route handlers
│   ├── services/
│   │   ├── automationService.ts # Main orchestration logic
│   │   ├── jiraService.ts       # Jira API integration
│   │   ├── notionService.ts     # Notion API integration
│   │   └── loggerService.ts    # Logging system
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   └── index.ts                 # Application entry point
├── dist/                         # Compiled JavaScript (generated)
├── logs/                         # Application logs (generated)
│   ├── combined.log             # All logs
│   └── error.log                # Error logs only
├── node_modules/                 # Dependencies (generated)
├── .env                          # Environment variables (create this)
├── .gitignore                    # Git ignore rules
├── .dockerignore                 # Docker ignore rules
├── package.json                  # Project dependencies
├── package-lock.json            # Locked dependency versions
├── tsconfig.json                # TypeScript configuration
├── Dockerfile                   # Docker build instructions
├── docker-compose.yml           # Docker Compose configuration
├── README.md                    # This file
└── COMPREHENSIVE_DOCUMENTATION.md # Complete documentation
```

### Key Files Explained

- **`src/index.ts`**: Main entry point, starts Express server
- **`src/config/index.ts`**: Loads and validates environment variables
- **`src/services/automationService.ts`**: Core business logic orchestrator
- **`src/services/notionService.ts`**: Handles all Notion API calls
- **`src/services/jiraService.ts`**: Handles all Jira API calls
- **`src/routes/webhook.ts`**: Webhook endpoint handlers
- **`.env`**: Your configuration (create this - not in repo)
- **`dist/`**: Compiled output (auto-generated by `npm run build`)
- **`logs/`**: Log files (auto-generated when server runs)

## ⚙️ Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NOTION_API_KEY` | Notion integration API key | `secret_abc123...` |
| `NOTION_USER_STORIES_DATABASE_ID` | 32-char database ID (no hyphens) | `a1b2c3d4...` |
| `NOTION_EPICS_DATABASE_ID` | 32-char database ID (no hyphens) | `e5f6g7h8...` |
| `NOTION_WEBHOOK_SECRET` | Webhook secret from Notion | `secret_webhook_...` |
| `JIRA_BASE_URL` | Your Jira instance URL | `https://company.atlassian.net` |
| `JIRA_EMAIL` | Your Jira account email | `user@domain.com` |
| `JIRA_API_TOKEN` | Jira API token | `ATATT3xFf...` |
| `JIRA_PROJECT_KEY` | Jira project key | `PROJ` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3003` |
| `NODE_ENV` | Environment mode | `development` |
| `SCRUM_MASTER_EMAILS` | Comma-separated emails to tag | - |
| `ENABLE_STATUS_CHANGE_COMMENTS` | Enable status change comments | `true` |
| `JIRA_STORY_POINTS_FIELD_ID` | Custom field ID for story points | `customfield_10016` |
| `JIRA_FIGMA_LINK_FIELD_ID` | Custom field ID for Figma links | `customfield_10021` |
| `JIRA_EPIC_TYPE_FIELD_ID` | Custom field ID for epic type | `customfield_12224` |
| `AUTHORIZED_USERS` | Comma-separated authorized emails | - |

### Field Mapping

The system automatically maps Notion properties to Jira fields:

- **Title** → Jira Summary
- **Description** → Jira Description
- **Story Points** → Jira Story Points custom field
- **Priority** → Jira Priority
- **Assignee** → Jira Assignee
- **Epic Link** → Jira Epic Link (parent)
- **Figma Link** → Jira Custom Link Field

## 🎮 Usage

### Development Mode

```bash
# Watch mode (auto-restart on changes)
npm run watch

# Direct TypeScript execution (slower)
npm run dev
```

### Production Mode

```bash
# Build and start
npm run build
npm start
```

### Testing Endpoints

```bash
# Health check
curl http://localhost:3003/webhook/health

# Test connections
curl http://localhost:3003/webhook/test

# Manual sync (if authorized)
curl -X POST http://localhost:3003/webhook/sync
```

### Webhook Testing

Test webhook locally using `ngrok`:

```bash
# Start ngrok tunnel
ngrok http 3003

# Use the https URL in Notion webhook settings:
# https://xxxxx.ngrok.io/webhook/notion
```

## 🛠️ Scripts

### Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run compiled JavaScript (production) |
| `npm run dev` | Run TypeScript directly with ts-node |
| `npm run watch` | Run in watch mode with auto-restart |

### Manual Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start

# View logs
tail -f logs/combined.log
```

## 🚀 Deployment

### Option 1: Docker Deployment (Recommended)

#### Using Docker Compose

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

#### Manual Docker Build

```bash
# Build image
docker build -t notion-jira-automation .

# Run container
docker run -d \
  --name notion-jira-automation \
  -p 3003:3003 \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  notion-jira-automation
```

### Option 2: Direct Node.js Deployment

1. **On your server:**
   ```bash
   # Clone repository
   git clone <repository-url>
   cd Automation_Jira_Notion
   
   # Install dependencies
   npm install --production
   
   # Build
   npm run build
   
   # Create .env file
   nano .env
   # (add your configuration)
   
   # Start with process manager
   pm2 start dist/index.js --name notion-jira
   ```

2. **Configure reverse proxy** (nginx example):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3003;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. **Set up SSL** (Let's Encrypt):
   ```bash
   certbot --nginx -d your-domain.com
   ```

### Option 3: Platform Services

#### Railway
1. Connect GitHub repository
2. Add environment variables in Railway dashboard
3. Deploy automatically

#### Heroku
1. Create `Procfile`:
   ```
   web: node dist/index.js
   ```
2. Deploy:
   ```bash
   heroku create your-app-name
   heroku config:set NOTION_API_KEY=...
   # (set all environment variables)
   git push heroku main
   ```

#### DigitalOcean App Platform
1. Connect repository
2. Configure environment variables
3. Set build command: `npm run build`
4. Set run command: `npm start`

## 🔧 Troubleshooting

### Common Issues

#### 1. "Cannot find module" errors

```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### 2. "Port already in use"

```bash
# Solution: Change port in .env or kill existing process
PORT=3004 npm start

# Or find and kill process
lsof -ti:3003 | xargs kill -9
```

#### 3. "Webhook verification failed"

- Verify `NOTION_WEBHOOK_SECRET` matches Notion webhook settings
- Check webhook URL is correct
- Ensure signature header is `x-notion-signature-v2`

#### 4. "Jira authentication error"

- Verify `JIRA_EMAIL` and `JIRA_API_TOKEN` are correct
- Check API token hasn't expired
- Ensure user has project access

#### 5. "Notion database access denied"

- Verify integration has access to both databases
- Check database IDs are correct (no hyphens, 32 characters)
- Ensure integration permissions in Notion

#### 6. Build errors

```bash
# Solution: Clean and rebuild
rm -rf dist
npm run build
```

### Debug Mode

Enable detailed logging:

```env
NODE_ENV=development
```

Then check logs:
```bash
tail -f logs/combined.log
```

### Getting Help

1. **Check logs**: `logs/combined.log` and `logs/error.log`
2. **Test connections**: Use `/webhook/test` endpoint
3. **Verify configuration**: Check all environment variables
4. **Review documentation**: See `COMPREHENSIVE_DOCUMENTATION.md`

## 📚 Documentation

### Quick Reference

- **This README**: Quick setup and basic usage
- **COMPREHENSIVE_DOCUMENTATION.md**: Complete guide with all details

### Documentation Contents

The comprehensive documentation includes:
- Complete project structure breakdown
- Detailed architecture explanation
- Step-by-step workflows
- Complete API reference
- "What happens when..." scenarios
- Advanced troubleshooting
- Security best practices
- Deployment guides

### Additional Resources

- **Notion API Docs**: [https://developers.notion.com](https://developers.notion.com)
- **Jira REST API Docs**: [https://developer.atlassian.com/cloud/jira/platform/rest/v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3)
- **TypeScript Docs**: [https://www.typescriptlang.org/docs](https://www.typescriptlang.org/docs)

## 🤝 Support & Contributing

### Getting Help

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review `COMPREHENSIVE_DOCUMENTATION.md`
3. Check logs in `logs/combined.log`
4. Test connections using `/webhook/test` endpoint

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

