# 📘 Notion-Jira Automation - Complete Guide

## 📑 Table of Contents
1. [System Overview](#system-overview)
2. [How It Works](#how-it-works)
3. [Setup & Installation](#setup--installation)
4. [What Happens When...](#what-happens-when)
5. [Configuration Guide](#configuration-guide)
6. [Troubleshooting](#troubleshooting)
7. [API Reference](#api-reference)
8. [Security & Best Practices](#security--best-practices)

---

## 🎯 System Overview

### What This System Does
This automation service creates a **real-time bridge** between Notion and Jira:
- **Automatically creates** Jira Epics and Stories from Notion pages
- **Syncs status changes** from Notion to Jira
- **Prevents duplicates** by checking existing issues
- **Adds comments** to Jira when status changes
- **Reopens/resolves** issues based on Notion status

### Key Features
- ✅ **Real-time Sync**: Uses Notion webhooks for instant updates
- ✅ **Smart Creation**: Only creates when status is "Approved" (Epics) or "Ready For Dev" (Stories)
- ✅ **Duplicate Prevention**: Checks for existing issues before creating
- ✅ **Status Tracking**: Monitors and syncs status changes
- ✅ **Payload Validation**: Prevents API errors and data corruption
- ✅ **Comprehensive Logging**: Tracks all actions for debugging

### System Architecture
```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Notion    │────────>│  This Service    │────────>│    Jira     │
│  Database   │ Webhook │  (Node.js/TS)    │   API   │   Project   │
└─────────────┘         └──────────────────┘         └─────────────┘
     Pages                   Automation                  Issues
                             Service
```

---

## 🔄 How It Works

### 1. **Notion Webhook Triggers**
When you update a Notion page in your database:
```
User updates Notion page → Notion sends webhook → Service receives notification
```

### 2. **Service Processing Flow**
```
┌─────────────────────────────────────────────────────────────┐
│ 1. Receive Webhook                                          │
│    ↓                                                         │
│ 2. Verify Signature (security check)                        │
│    ↓                                                         │
│ 3. Extract Page ID                                          │
│    ↓                                                         │
│ 4. Fetch Full Page Data from Notion API                     │
│    ↓                                                         │
│ 5. Determine Database Type (Epics or User Stories)          │
│    ↓                                                         │
│ 6. Check if Jira Link Already Exists                        │
│    ├─ YES → Handle Status Changes Only                      │
│    └─ NO → Continue to Creation Flow                        │
│                ↓                                             │
│ 7. Check for Duplicate Issues in Jira                       │
│    ├─ FOUND → Link existing issue                           │
│    └─ NOT FOUND → Continue                                  │
│                ↓                                             │
│ 8. Check Status (Approved/Ready For Dev)                    │
│    ├─ NOT READY → Skip creation                             │
│    └─ READY → Create Jira Issue                             │
│                ↓                                             │
│ 9. Add Jira Link Back to Notion                             │
│    ↓                                                         │
│ 10. Add Creation Comment to Jira                            │
└─────────────────────────────────────────────────────────────┘
```

### 3. **Database Type Detection**
The service determines if a page is an Epic or Story based on:
- Which Notion database it belongs to (Epics DB or User Stories DB)
- Page properties (presence of Epic-specific fields)
- Title keywords (contains "epic")

### 4. **Creation Rules**

#### **For Epics:**
- ✅ Status must be: `"Approved"`
- ✅ Creates with: Title, Full Description, Start/End Dates, Priority
- ✅ Jira Issue Type: `Epic`

#### **For Stories:**
- ✅ Status must be: `"Ready For Dev"`
- ✅ Creates with: Title, Notion Link (description), Story Points, Priority
- ✅ Jira Issue Type: `Story`
- ✅ Links to parent Epic (if available)

---

## 📥 Setup & Installation

### Prerequisites
- ✅ Node.js (v16 or higher)
- ✅ npm or yarn
- ✅ Notion account with API access
- ✅ Jira account with API access
- ✅ Two Notion databases: Epics and User Stories

### Step 1: Clone and Install
```bash
git clone <your-repo-url>
cd Automation_Jira_Notion
npm install
```

### Step 2: Create Environment File
Create a `.env` file in the root directory:

```env
# Notion Configuration
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_USER_STORIES_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_EPICS_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_WEBHOOK_SECRET=your_webhook_secret_here

# Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@domain.com
JIRA_API_TOKEN=your_jira_api_token_here
JIRA_PROJECT_KEY=YOUR_PROJECT_KEY

# Server Configuration
PORT=3000
NODE_ENV=production

# Security
AUTHORIZED_USERS=user-id-1,user-id-2

# Notifications (optional)
SCRUM_MASTER_EMAIL=scrum-master@domain.com
```

### Step 3: Get Your Credentials

#### **Notion API Key:**
1. Go to https://www.notion.so/my-integrations
2. Click "+ New integration"
3. Name it (e.g., "Jira Automation")
4. Select your workspace
5. Copy the "Internal Integration Token"
6. Add integration to your databases:
   - Open each database
   - Click "..." → "Add connections"
   - Select your integration

#### **Notion Database IDs:**
1. Open your database in Notion
2. Copy the URL: `https://www.notion.so/workspace/DATABASE_ID?v=...`
3. The DATABASE_ID is the 32-character code
4. Do this for both Epics and User Stories databases

#### **Notion Webhook Secret:**
1. Go to https://www.notion.so/my-integrations
2. Select your integration
3. Go to "Webhooks" tab
4. Create a new webhook subscription
5. Set endpoint URL: `https://your-domain.com/webhook/notion`
6. Copy the webhook secret

#### **Jira API Token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Name it (e.g., "Notion Integration")
4. Copy the token

#### **Jira Project Key:**
1. Go to your Jira project
2. The project key is in the URL: `https://your-domain.atlassian.net/browse/KEY-123`
3. Or find it in Project Settings → Details

### Step 4: Configure Notion Databases

#### **Required Fields in Epics Database:**
- `Name` (Title) - **Required**
- `Status` (Select/Status) - **Required** (must have "Approved" option)
- `Description` or `Notes` (Rich Text) - Optional
- `Priority` (Select) - Optional (High, Medium, Low)
- `Start Date` (Date) - Optional
- `End Date` (Date) - Optional
- `Jira Epic Link` (URL) - **Auto-populated by service**

#### **Required Fields in User Stories Database:**
- `Name` (Title) - **Required**
- `Status` (Select/Status) - **Required** (must have "Ready For Dev" option)
- `Description` or `Notes` (Rich Text) - Optional
- `Priority` (Select) - Optional
- `Story Points` (Number) - Optional
- `🚀 Initiatives` (Relation to Epics) - Optional (for linking to Epic)
- `Jira Link` (URL) - **Auto-populated by service**

### Step 5: Build and Run
```bash
# Build TypeScript
npm run build

# Start the service
npm start

# Or for development with auto-reload
npm run dev
```

### Step 6: Verify Setup
The service will log connection tests on startup:
```
✅ Notion connection test: SUCCESS (both databases)
✅ Jira connection test: SUCCESS
🚀 Server started on port 3000
```

---

## ⚡ What Happens When...

### Scenario 1: **You Create a New Notion Page**
```
┌─────────────────────────────────────────────────────────────┐
│ User Action: Create new page in Epics database             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Service: Page created, but status is "Not Started"         │
│ Result: ⏸️  SKIPPED - Waiting for status = "Approved"       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ User Action: Change status to "Approved"                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Service Actions:                                            │
│ 1. ✅ Validates page has title                              │
│ 2. ✅ Checks for existing Jira link (none found)            │
│ 3. ✅ Searches for duplicate in Jira (none found)           │
│ 4. ✅ Creates Epic in Jira                                  │
│ 5. ✅ Adds full description from Notion                     │
│ 6. ✅ Sets priority, dates, etc.                            │
│ 7. ✅ Adds Jira URL back to Notion page                     │
│ 8. ✅ Adds creation comment in Jira                         │
│ Result: 🎉 Epic created: PROJ-123                           │
└─────────────────────────────────────────────────────────────┘
```

**Logs You'll See:**
```
🔄 Processing Notion page update: abc123...
📊 Page abc123... belongs to epics database
📄 Fetching page from Notion API...
✅ NO DUPLICATES FOUND: Creating new Jira issue with title "New Feature Epic"
🎯 CREATING NEW JIRA ISSUE:
   📝 Title: "New Feature Epic"
   🏷️ Issue Type: Epic
   📊 Status: Approved
✅ Epic created successfully: PROJ-123
✅ Added clickable Jira link to Notion page
🎉 AUTOMATION COMPLETE:
   ✅ Jira Issue Created: PROJ-123
```

---

### Scenario 2: **You Change Status to "Ready For Dev"**
```
┌─────────────────────────────────────────────────────────────┐
│ User Action: Change Story status to "Ready For Dev"        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Service: Checks if Jira issue already exists               │
│ Case A: NO JIRA LINK → Creates new Story                   │
│ Case B: HAS JIRA LINK → Handles status change              │
└─────────────────────────────────────────────────────────────┘

Case A: First Time (No Jira Link)
─────────────────────────────────
│ Service Actions:                                            │
│ 1. ✅ Creates Story in Jira                                 │
│ 2. ✅ Links to parent Epic (if specified)                   │
│ 3. ✅ Adds Notion link to Jira description                  │
│ 4. ✅ Adds Jira link back to Notion                         │
│ Result: 🎉 Story created: PROJ-124                          │

Case B: Already Has Jira Link
─────────────────────────────────
│ Service Actions:                                            │
│ 1. ✅ Detects status change: "In Review" → "Ready For Dev" │
│ 2. ✅ Checks if Jira issue is resolved/closed               │
│ 3. ✅ Reopens issue if needed                               │
│ 4. ✅ Adds status change comment to Jira                    │
│ 5. ✅ Tags requirements engineer or default user            │
│ Result: 🔄 Issue PROJ-124 reopened and team notified        │
```

**Logs You'll See:**
```
📊 Status change detected: In Review → Ready For Dev
🔗 EXISTING JIRA LINK FOUND:
   📋 Jira Key: PROJ-124
   🔗 Jira URL: https://your-domain.atlassian.net/browse/PROJ-124
🚀 Status changed to "Ready For Dev" - adding tagged comment
🔄 Issue PROJ-124 is resolved, reopening for Ready For Dev status
✅ Ready For Dev tagged comment added to PROJ-124
```

---

### Scenario 3: **You Edit an Existing Notion Page**
```
┌─────────────────────────────────────────────────────────────┐
│ User Action: Edit title, description, or priority          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Service: Checks if Jira link exists                        │
│ - HAS LINK → Monitors for status changes only              │
│ - NO LINK → Normal creation flow                           │
└─────────────────────────────────────────────────────────────┘

Note: The service does NOT automatically update Jira fields
when you edit the Notion page. It only:
1. Creates new issues when status changes to Approved/Ready For Dev
2. Handles status changes (reopens/resolves)
3. Adds comments on status changes
```

**What Gets Updated Automatically:**
- ✅ Status changes (Ready For Dev, etc.)
- ✅ Jira issue reopened/resolved
- ✅ Comments added to Jira

**What Does NOT Update Automatically:**
- ❌ Title changes in Notion → Jira
- ❌ Description changes in Notion → Jira
- ❌ Priority changes in Notion → Jira

*To update these fields, you would need to manually edit in Jira*

---

### Scenario 4: **You Accidentally Create a Duplicate**
```
┌─────────────────────────────────────────────────────────────┐
│ Situation: Two Notion pages with same title                │
│ Page 1: "User Login Feature" → Already has PROJ-125        │
│ Page 2: "User Login Feature" → No Jira link yet            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ User Action: Change Page 2 status to "Ready For Dev"       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Service Actions:                                            │
│ 1. ✅ Checks for duplicates by exact title match            │
│ 2. ✅ FINDS existing issue: PROJ-125                        │
│ 3. ✅ Links Page 2 to existing PROJ-125                     │
│ 4. ✅ DOES NOT create new issue                             │
│ Result: 🔗 Linked to existing PROJ-125 (duplicate prevented)│
└─────────────────────────────────────────────────────────────┘
```

**Logs You'll See:**
```
⚠️ DUPLICATE ISSUE DETECTED:
   📋 Existing Jira Key: PROJ-125
   📝 Title: "User Login Feature"
   🚫 Skipping creation to prevent duplication
✅ Linked existing Jira issue PROJ-125 to Notion page
```

---

### Scenario 5: **You Delete a Notion Page**
```
┌─────────────────────────────────────────────────────────────┐
│ User Action: Delete Notion page                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Service: Receives webhook notification                     │
│ Result: ⚠️ No action taken                                  │
│                                                             │
│ Note: The Jira issue is NOT deleted                        │
│ Reason: Jira issues should persist for historical tracking │
│                                                             │
│ Manual Action Required:                                    │
│ If you want to delete the Jira issue, do it manually       │
└─────────────────────────────────────────────────────────────┘
```

---

### Scenario 6: **Status Changes Away From "Ready For Dev"**
```
┌─────────────────────────────────────────────────────────────┐
│ User Action: Change status from "Ready For Dev" → "Done"   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Service Actions:                                            │
│ 1. ✅ Detects status change                                 │
│ 2. ✅ Adds resolution comment to Jira                       │
│ 3. ✅ Transitions Jira issue to "Done" status               │
│ 4. ✅ Adds note about automatic reopening if needed         │
│ Result: 🔒 Issue PROJ-124 resolved automatically            │
└─────────────────────────────────────────────────────────────┘
```

**Logs You'll See:**
```
🔄 Status changed FROM "Ready For Dev" to "Done"
✅ Resolution comment added to PROJ-124
✅ Jira issue PROJ-124 resolved successfully
```

---

### Scenario 7: **Notion Page Has No Title**
```
┌─────────────────────────────────────────────────────────────┐
│ User Action: Create page, set status to "Approved"         │
│ Problem: Page title is empty or "Untitled"                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Service Actions:                                            │
│ 1. ✅ Validates page data                                   │
│ 2. ❌ No valid title found                                  │
│ 3. ⏸️  SKIPS creation                                        │
│ Result: ⚠️ Skipped - Add a title to create Jira issue       │
└─────────────────────────────────────────────────────────────┘
```

**Logs You'll See:**
```
⚠️ Skipping Jira ticket creation - no valid title found
   Title value: "Untitled"
   Please ensure the Notion page has a proper title in the 'Name' field
```

---

## ⚙️ Configuration Guide

### Environment Variables Explained

#### **Required Variables**
```env
# MUST HAVE - Service won't start without these

NOTION_API_KEY
- Where: Notion Integration settings
- Format: secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
- Purpose: Authenticate with Notion API

NOTION_USER_STORIES_DATABASE_ID
- Where: Notion database URL
- Format: 32-character hex string
- Purpose: Which database contains User Stories

NOTION_EPICS_DATABASE_ID
- Where: Notion database URL
- Format: 32-character hex string
- Purpose: Which database contains Epics

JIRA_BASE_URL
- Where: Your Jira instance
- Format: https://your-domain.atlassian.net
- Purpose: Base URL for Jira API calls

JIRA_EMAIL
- Where: Your Jira account
- Format: your-email@domain.com
- Purpose: Authentication username

JIRA_API_TOKEN
- Where: Jira API token settings
- Format: Long alphanumeric string
- Purpose: Authentication password

JIRA_PROJECT_KEY
- Where: Jira project settings
- Format: Usually 2-4 letters (e.g., PROJ, DEV, TEAM)
- Purpose: Which Jira project to create issues in
```

#### **Optional Variables**
```env
NOTION_WEBHOOK_SECRET
- Default: None (webhooks won't be verified)
- Purpose: Verify webhook requests are from Notion
- Recommended: Yes (for security)

PORT
- Default: 3000
- Purpose: Which port the server runs on

NODE_ENV
- Default: development
- Options: development, production
- Purpose: Controls logging verbosity

AUTHORIZED_USERS
- Default: All users allowed
- Format: Comma-separated Notion user IDs
- Purpose: Restrict who can trigger automation

SCRUM_MASTER_EMAIL
- Default: None
- Purpose: Tag this person in status change comments
```

### TypeScript Configuration (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**What This Means:**
- Compiles TypeScript (`src/`) to JavaScript (`dist/`)
- Enables strict type checking for better code quality
- Generates source maps for debugging
- Generates declaration files for TypeScript users

---

## 🔧 Troubleshooting

### Problem: "Webhook verification failed"
**Symptoms:**
```
❌ Webhook verification failed
403 Forbidden
```

**Causes:**
1. Missing or incorrect `NOTION_WEBHOOK_SECRET`
2. Webhook secret doesn't match Notion settings
3. Request not coming from Notion

**Solutions:**
1. Check `.env` file has correct `NOTION_WEBHOOK_SECRET`
2. Verify secret matches Notion integration settings
3. Ensure webhook URL is correct in Notion
4. Check logs for the actual vs expected signature

---

### Problem: "Notion API may have misinterpreted our payload!"
**Symptoms:**
```
🚨 CRITICAL: Notion API may have misinterpreted our payload!
   This could cause property reordering or data corruption.
```

**Causes:**
1. Invalid field structure in update payload
2. Field type mismatch (sending wrong data type)
3. Attempting to update non-existent field

**Solutions:**
1. Check Notion database has the expected fields
2. Verify field types match (URL, Rich Text, Select, etc.)
3. Check logs for specific validation errors
4. **Manually inspect** Notion page for unexpected changes
5. Don't send updates to system fields (id, created_time, etc.)

**Prevention:**
- Service automatically validates payloads
- Rejects fields that could cause ordering issues
- Validates field structures before sending

---

### Problem: "Field validation failed - skipping update"
**Symptoms:**
```
❌ Target field 'Jira Link' validation failed - skipping update
```

**Causes:**
1. Field doesn't exist in Notion database
2. Field has wrong type
3. Field is archived or hidden

**Solutions:**
1. Add missing field to Notion database
2. Ensure field type is correct:
   - Jira Link: URL type
   - Description/Notes: Rich Text type
   - Status: Select or Status type
3. Un-archive field if needed
4. Check field name matches exactly (case-sensitive)

---

### Problem: "Jira connection test FAILED"
**Symptoms:**
```
❌ Jira connection test: FAILED
Error: Request failed with status code 401
```

**Causes:**
1. Invalid Jira credentials
2. API token expired
3. Incorrect Jira base URL
4. User doesn't have access to project

**Solutions:**
1. Regenerate Jira API token
2. Check `JIRA_EMAIL` matches API token owner
3. Verify `JIRA_BASE_URL` is correct format
4. Ensure user has permissions in `JIRA_PROJECT_KEY`
5. Test credentials manually:
   ```bash
   curl -u email@domain.com:YOUR_API_TOKEN \
     https://your-domain.atlassian.net/rest/api/3/myself
   ```

---

### Problem: "Notion connection test FAILED"
**Symptoms:**
```
❌ Notion connection test: FAILED
Error: Could not find database
```

**Causes:**
1. Invalid database ID
2. Integration not connected to database
3. Invalid API key

**Solutions:**
1. Check database IDs are correct (32 characters)
2. Connect integration to databases:
   - Open database in Notion
   - Click "..." → "Add connections"
   - Select your integration
3. Verify `NOTION_API_KEY` is correct
4. Test API key manually:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        -H "Notion-Version: 2022-06-28" \
        https://api.notion.com/v1/databases/YOUR_DB_ID
   ```

---

### Problem: "Duplicate issues being created"
**Symptoms:**
- Multiple Jira issues with same title
- Service didn't detect duplicate

**Causes:**
1. Title has slight differences (spaces, capitalization)
2. Issues created in different projects
3. Race condition (multiple webhooks at once)

**Solutions:**
1. Service searches by **exact title match** (case-insensitive)
2. Ensure titles match exactly
3. Wait a few seconds between status changes
4. Check Jira search to verify:
   ```
   summary = "Your Title" AND project = "YOUR_KEY"
   ```

**Prevention:**
- Service automatically checks for duplicates
- Links to existing issue if found
- Logs warning when duplicate detected

---

### Problem: "Epic not linking to Stories"
**Symptoms:**
- Story created but not under Epic
- Epic key not found

**Causes:**
1. Epic doesn't exist in Jira yet
2. Epic key incorrect in Notion
3. Epic in different project

**Solutions:**
1. Create Epic first (set status to "Approved")
2. Copy exact Epic key from Jira (e.g., PROJ-123)
3. Add Epic key to Story's "🚀 Initiatives" relation in Notion
4. Verify Epic is in same Jira project

---

### Problem: "Server won't start"
**Symptoms:**
```
Error: Cannot find module 'express'
Error: PORT already in use
```

**Solutions:**
1. **Missing dependencies:**
   ```bash
   npm install
   ```

2. **Port already in use:**
   ```bash
   # Change PORT in .env
   PORT=3001
   
   # Or kill existing process
   lsof -ti:3000 | xargs kill
   ```

3. **TypeScript not compiled:**
   ```bash
   npm run build
   ```

4. **Environment variables not loaded:**
   - Check `.env` file exists
   - Check file permissions
   - Verify no syntax errors in `.env`

---

### Problem: "Status changes not triggering actions"
**Symptoms:**
- Changed status in Notion
- No Jira comment or reopening

**Causes:**
1. Webhook not configured
2. Page doesn't have Jira link yet
3. Status doesn't match trigger conditions

**Solutions:**
1. Set up Notion webhook pointing to your server
2. Create Jira issue first (by setting Approved/Ready For Dev)
3. Check status matches exactly:
   - "Ready For Dev" (case-sensitive)
   - Not "Ready for Dev" or "ready for dev"

**Debug:**
Check server logs for:
```
📊 Status change detected: [old] → [new]
```

If you don't see this, webhook isn't firing.

---

### Problem: "Comments not appearing in Jira"
**Symptoms:**
- Service logs show comment added
- Comment not visible in Jira

**Causes:**
1. Jira API returned success but didn't actually add comment
2. User doesn't have permission to view comments
3. Comment filtered by Jira settings

**Solutions:**
1. Check Jira issue activity tab
2. Verify user has comment permissions
3. Check Jira API response in detailed logs
4. Try adding comment manually to test permissions

---

## 📚 API Reference

### Webhook Endpoint

#### `POST /webhook/notion`
Receives webhook events from Notion when pages are updated.

**Headers:**
```
Content-Type: application/json
Notion-Signature: sha256=xxx... (if webhook secret configured)
```

**Request Body:**
```json
{
  "type": "page.updated",
  "page_id": "abc123...",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Page update processed successfully"
}
```

**Status Codes:**
- `200 OK` - Successfully processed
- `400 Bad Request` - Invalid payload
- `403 Forbidden` - Signature verification failed
- `500 Internal Server Error` - Processing error

---

### Health Check Endpoint

#### `GET /health`
Check service status and API connections.

**Response:**
```json
{
  "status": "healthy",
  "connections": {
    "notion": true,
    "jira": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Status Codes:**
- `200 OK` - All systems operational
- `503 Service Unavailable` - One or more connections failed

---

### Notion API Calls Made

#### 1. Get Page
```
GET https://api.notion.com/v1/pages/{page_id}
```
**Purpose:** Fetch page properties and metadata
**Frequency:** Every webhook event

#### 2. Get Page Content
```
GET https://api.notion.com/v1/blocks/{page_id}/children
```
**Purpose:** Fetch page body content for description
**Frequency:** When description is empty in properties

#### 3. Query Database
```
POST https://api.notion.com/v1/databases/{database_id}/query
```
**Purpose:** Determine which database a page belongs to
**Frequency:** Every webhook event (first check)

#### 4. Update Page
```
PATCH https://api.notion.com/v1/pages/{page_id}
```
**Purpose:** Add Jira link back to Notion
**Frequency:** After creating Jira issue

---

### Jira API Calls Made

#### 1. Create Issue
```
POST {JIRA_BASE_URL}/rest/api/3/issue
```
**Purpose:** Create Epic or Story
**Frequency:** When status changes to Approved/Ready For Dev

#### 2. Search Issues
```
POST {JIRA_BASE_URL}/rest/api/3/search
```
**Purpose:** Check for duplicates, find parent Epics
**Frequency:** Before creating issue

#### 3. Get Issue
```
GET {JIRA_BASE_URL}/rest/api/3/issue/{issueKey}
```
**Purpose:** Check issue status for reopening
**Frequency:** On status changes

#### 4. Add Comment
```
POST {JIRA_BASE_URL}/rest/api/3/issue/{issueKey}/comment
```
**Purpose:** Add status change comments
**Frequency:** On status changes to/from Ready For Dev

#### 5. Transition Issue
```
POST {JIRA_BASE_URL}/rest/api/3/issue/{issueKey}/transitions
```
**Purpose:** Reopen or resolve issues
**Frequency:** On status changes to/from Ready For Dev

---

## 🔒 Security & Best Practices

### Security Measures

#### 1. **Environment Variables**
- ✅ Store all secrets in `.env` file
- ✅ Never commit `.env` to git (use `.gitignore`)
- ✅ Rotate API tokens every 30-90 days
- ✅ Use different tokens for dev/prod

#### 2. **Webhook Verification**
- ✅ Always use `NOTION_WEBHOOK_SECRET`
- ✅ Verify signature on every request
- ✅ Reject requests with invalid signatures
- ✅ Log verification failures

#### 3. **API Token Security**
- ✅ Use API tokens, never passwords
- ✅ Limit token permissions to what's needed
- ✅ Revoke tokens when no longer needed
- ✅ Don't share tokens between services

#### 4. **User Authorization**
- ✅ Configure `AUTHORIZED_USERS` to restrict access
- ✅ Validate user IDs from webhook payload
- ✅ Log unauthorized attempts

---

### Best Practices

#### **Notion Database Design**
1. **Use consistent field names**
   - Stick to: Name, Status, Priority, Description
   - Avoid renaming fields frequently

2. **Use Status/Select types correctly**
   - Make status values exact: "Approved" not "approved"
   - Use Select for single choice, Multi-select for multiple

3. **Add helpful descriptions**
   - Document what each status means
   - Note which statuses trigger automation

4. **Link databases properly**
   - Use Relations to connect Stories to Epics
   - Maintain parent-child relationships

#### **Jira Project Setup**
1. **Configure issue types**
   - Ensure Epic and Story types exist
   - Match field requirements in both systems

2. **Set up workflows**
   - Define clear status transitions
   - Match Notion statuses where possible

3. **Use custom fields wisely**
   - Document custom field IDs
   - Don't delete fields the service uses

#### **Operational Best Practices**
1. **Monitor logs regularly**
   - Check for errors daily
   - Set up log aggregation if possible
   - Alert on critical errors

2. **Test in development first**
   - Use separate Notion/Jira instances for testing
   - Test edge cases before production

3. **Document your workflow**
   - Document which statuses trigger what
   - Train team on proper Notion usage
   - Keep this guide updated

4. **Regular maintenance**
   - Update dependencies monthly
   - Review and clean old logs
   - Test backups and recovery

---

## 📊 Common Workflows

### Workflow 1: Creating a New Epic
```
1. Create page in Epics database
   └─> Service: No action (waiting for approval)

2. Fill in details:
   - Title: "Q1 User Authentication"
   - Description: Full epic details
   - Priority: High
   - Start Date: 2024-01-01
   - End Date: 2024-03-31

3. Change Status to "Approved"
   └─> Service: Creates Epic in Jira
       ├─> Jira: PROJ-100 created
       ├─> Adds full description
       ├─> Sets dates and priority
       └─> Links back to Notion

4. Result: Notion page now has Jira link
```

### Workflow 2: Creating Stories Under an Epic
```
1. Create page in User Stories database
   └─> Service: No action (waiting for ready)

2. Fill in details:
   - Title: "Implement login form"
   - 🚀 Initiatives: Link to Epic page
   - Story Points: 5
   - Priority: High

3. Change Status to "Ready For Dev"
   └─> Service: Creates Story in Jira
       ├─> Jira: PROJ-101 created
       ├─> Links to Epic PROJ-100
       ├─> Adds Notion link only (not full description)
       └─> Links back to Notion

4. Result: Story appears under Epic in Jira
```

### Workflow 3: Handling Status Changes
```
Story is in development (PROJ-101):

1. Developer completes work
   - Change Notion status: "Ready For Dev" → "Done"
   └─> Service: Resolves Jira issue
       ├─> Adds resolution comment
       └─> Transitions to Done

2. Requirements change, need rework
   - Change Notion status: "Done" → "Ready For Dev"
   └─> Service: Reopens Jira issue
       ├─> Checks if issue is closed
       ├─> Reopens if needed
       ├─> Adds comment explaining reopening
       └─> Tags requirements engineer

3. Result: Issue ready for development again
```

---

## 🎓 Advanced Topics

### Understanding Payload Validation

The service validates all Notion API payloads to prevent:
- Property reordering in Notion
- Data corruption
- API errors

**What gets validated:**
```typescript
✅ Field names (no 'order', 'position', 'sort')
✅ System fields (can't update 'id', 'created_time', etc.)
✅ Rich text structure (proper type and content)
✅ URL format (must be valid string)
✅ Select values (must have name property)
✅ Status values (must have name property)
```

**What happens when validation fails:**
```
⚠️ Skipping invalid field update: [field_name]
🚫 Rejecting field update that could affect ordering
```

### Understanding Status Change Detection

The service maintains an **in-memory cache** of page states:
```typescript
pageStateCache = {
  "page-id-123": {
    status: "Ready For Dev",
    lastUpdated: "2024-01-15T10:30:00Z"
  }
}
```

**On each webhook:**
1. Fetch current page data
2. Compare with cached state
3. Detect changes
4. Update cache
5. Take appropriate action

**Cache Limitations:**
- Cleared on service restart
- Doesn't persist to database
- First status change after restart may not trigger

**Solution:**
- Service treats "no cached state" as first update
- Handles gracefully even without history

### Understanding Duplicate Detection

**Detection Method:**
```sql
summary = "Exact Title" AND 
issuetype = "Epic|Story" AND 
project = "YOUR_KEY"
```

**Case Sensitivity:**
- Jira search: Case-insensitive
- Service comparison: Case-insensitive
- Result: "User Login" = "user login" = "USER LOGIN"

**When Duplicates Found:**
1. Log warning
2. Don't create new issue
3. Link Notion page to existing issue
4. Stop processing

---

## 📝 Maintenance & Monitoring

### Log Files
```
logs/
├── combined.log    # All logs (info + errors)
└── error.log       # Errors only
```

### Important Log Messages

**Success:**
```
✅ Epic created successfully: PROJ-123
✅ Story created successfully: PROJ-124
✅ Jira link added to Notion page
```

**Warnings:**
```
⚠️ Skipping Jira ticket creation - status is 'Draft'
⚠️ No suitable field found to add Jira link
⚠️ DUPLICATE ISSUE DETECTED
```

**Errors:**
```
❌ Error updating Notion page
❌ Jira connection test: FAILED
🚨 CRITICAL: Notion API may have misinterpreted our payload!
```

### Monitoring Checklist

**Daily:**
- [ ] Check error logs for failures
- [ ] Verify webhooks are being received
- [ ] Test one Epic/Story creation

**Weekly:**
- [ ] Review duplicate detections
- [ ] Check Notion-Jira link integrity
- [ ] Verify status changes work correctly

**Monthly:**
- [ ] Rotate API tokens
- [ ] Update dependencies
- [ ] Review and archive old logs
- [ ] Test disaster recovery

---

## 🚀 Deployment

### GitHub Deployment
1. Push code to GitHub repository
2. Configure environment variables in hosting platform
3. Set up automatic deployment on push
4. Configure webhook URL in Notion

### Environment Setup
```bash
# Production
NODE_ENV=production
PORT=3000

# All other vars same as .env
```

### Health Checks
Configure your hosting platform to check:
```
GET https://your-domain.com/health
```

Expected response: `200 OK`

---

## ❓ FAQ

**Q: Can I use this with multiple Jira projects?**
A: Currently, the service works with one Jira project at a time (specified by `JIRA_PROJECT_KEY`). To use multiple projects, you'd need to run multiple instances.

**Q: Does it work with Jira Cloud and Server?**
A: Designed for Jira Cloud. Jira Server/Data Center may work but haven't been tested.

**Q: Can I customize which fields sync?**
A: Yes, by modifying the `extractPageData` method in `src/services/notionService.ts`.

**Q: What happens if Notion or Jira is down?**
A: The service will log errors and skip that update. Webhooks from Notion may retry automatically.

**Q: Can I sync existing Notion pages?**
A: Yes, just change their status to "Approved" or "Ready For Dev" and they'll be created.

**Q: Does it sync from Jira back to Notion?**
A: No, it's one-way: Notion → Jira only.

**Q: Can I prevent certain pages from syncing?**
A: Yes, just don't set their status to "Approved" or "Ready For Dev".

**Q: How do I update a Jira issue's title?**
A: Currently not automated. Update manually in Jira, or modify the code to support updates.

---

## 📞 Support & Contribution

### Getting Help
1. Check this guide first
2. Review logs for error messages
3. Test API credentials manually
4. Check Notion and Jira documentation

### Reporting Issues
Include:
- Error message from logs
- Steps to reproduce
- Environment details (Node version, OS)
- Notion database structure
- Redacted `.env` configuration

### Contributing
Contributions welcome! Please:
- Write tests for new features
- Update this documentation
- Follow TypeScript best practices
- Keep dependencies minimal

---

## 📄 License
MIT License - See LICENSE file for details

---

**Last Updated:** January 2024
**Version:** 1.0.0
