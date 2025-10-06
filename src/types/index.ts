export interface NotionPage {
  id: string;
  properties: {
    [key: string]: any;
  };
  url: string;
  created_time: string;
  last_edited_time: string;
  // RGB dates for user stories and epics
  red_date?: string;    // Critical deadline
  green_date?: string;  // Target completion
  blue_date?: string;   // Start date
}

export interface NotionDatabase {
  id: string;
  title: string;
  properties: {
    [key: string]: {
      id: string;
      name: string;
      type: string;
    };
  };
}

export interface JiraIssue {
  key: string;
  id: string;
  self: string;
  fields: {
    summary: string;
    description?: string;
    issuetype: {
      name: string;
    };
    project: {
      key: string;
    };
    parent?: {
      key: string;
    };
    customfield_10016?: number; // Story Points
    labels?: string[];
    [key: string]: any;
  };
}

export interface JiraCreateIssueRequest {
  fields: {
    summary: string;
    description?: any; // Can be string or ADF format
    issuetype: {
      name: string;
    };
    project: {
      key: string;
    };
    parent?: {
      key: string;
    };
    customfield_10016?: number; // Story Points
    labels?: string[];
    [key: string]: any;
  };
}

export interface WebhookPayload {
  object: 'page' | 'database';
  entry: Array<{
    id: string;
    time: string;
    event_type: 'page.created' | 'page.updated' | 'page.deleted';
    page_id: string;
  }>;
}

export interface NotionToJiraMapping {
  notionField: string;
  jiraField: string;
  fieldType: 'text' | 'number' | 'select' | 'date' | 'url' | 'checkbox';
  required: boolean;
}

export interface Config {
  notion: {
    apiKey: string;
    databaseId: string;
    webhookSecret: string;
  };
  jira: {
    baseUrl: string;
    email: string;
    apiToken: string;
    projectKey: string;
  };
  server: {
    port: number;
    nodeEnv: string;
  };
  security: {
    authorizedUsers: string[];
  };
}
