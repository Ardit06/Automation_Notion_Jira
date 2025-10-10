# Render Deployment Guide

## Quick Deploy to Render (Free & Reliable)

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub
3. Free tier available!

### Step 2: Deploy
1. Click "New +"
2. Select "Web Service"
3. Connect your GitHub repository
4. Render auto-detects Node.js
5. Add environment variables:
   - NOTION_API_TOKEN
   - NOTION_USER_STORIES_DATABASE_ID
   - NOTION_EPICS_DATABASE_ID
   - JIRA_BASE_URL
   - JIRA_EMAIL
   - JIRA_API_TOKEN
   - JIRA_PROJECT_KEY

### Step 3: Get Your URL
Render will give you: `https://your-app-name.onrender.com`

### Step 4: Configure Notion Webhook
Use: `https://your-app-name.onrender.com/webhook/notion`

## Benefits:
✅ Free tier
✅ Automatic HTTPS
✅ Always online
✅ Easy setup
✅ No tunneling issues
