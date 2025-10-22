import dotenv from 'dotenv';
import { Config } from '../types';

dotenv.config();


export const config: Config = {
  notion: {
    apiKey: process.env.NOTION_API_KEY || '',
    userStoriesDatabaseId: process.env.NOTION_USER_STORIES_DATABASE_ID || '',
    epicsDatabaseId: process.env.NOTION_EPICS_DATABASE_ID || '',
    webhookSecret: process.env.NOTION_WEBHOOK_SECRET || '',
  },
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || '',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    projectKey: process.env.JIRA_PROJECT_KEY || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3003', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  security: {
    authorizedUsers: (process.env.AUTHORIZED_USERS || '').split(',').map(u => u.trim()),
  },
  notifications: {
    scrumMasterEmails: (process.env.SCRUM_MASTER_EMAILS || '').split(',').map(e => e.trim()).filter(e => e),
    enableStatusChangeComments: process.env.ENABLE_STATUS_CHANGE_COMMENTS === 'true',
  },
};

// Field mapping configuration
export const NOTION_TO_JIRA_MAPPING: Record<string, string> = {
  'Title': 'summary',
  'Description': 'description',
  'Story Points': 'customfield_10016',
  'Labels': 'labels',
  'Priority': 'priority',
  'Assignee': 'assignee',
  'Epic Link': 'parent',
  'Status': 'status',
};

// Required fields for Jira issues
export const REQUIRED_JIRA_FIELDS = [
  'summary',
  'issuetype',
  'project',
];

// Issue type mapping
export const ISSUE_TYPE_MAPPING: Record<string, string> = {
  'Initiative': 'Epic',
  'Story': 'Story',
  'Task': 'Task',
  'Bug': 'Bug',
};

export default config;

