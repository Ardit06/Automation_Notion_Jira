import axios, { AxiosInstance } from 'axios';
import { JiraIssue, JiraCreateIssueRequest } from '../types';
import { config, ISSUE_TYPE_MAPPING } from '../config';
import { logger } from './loggerService';

export class JiraService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${config.jira.baseUrl}/rest/api/3`,
      auth: {
        username: config.jira.email,
        password: config.jira.apiToken,
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  async createIssue(issueData: JiraCreateIssueRequest): Promise<JiraIssue> {
    try {
      const response = await this.client.post('/issue', issueData);
      logger.info(`Created Jira issue: ${response.data.key}`);
      return response.data;
    } catch (error) {
      logger.error('Error creating Jira issue:', error);
      throw error;
    }
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      const response = await this.client.get(`/issue/${issueKey}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching Jira issue ${issueKey}:`, error);
      throw error;
    }
  }

  async updateIssue(issueKey: string, updateData: any): Promise<JiraIssue> {
    try {
      const response = await this.client.put(`/issue/${issueKey}`, updateData);
      logger.info(`Updated Jira issue: ${issueKey}`);
      return response.data;
    } catch (error) {
      logger.error(`Error updating Jira issue ${issueKey}:`, error);
      throw error;
    }
  }

  async addComment(issueKey: string, comment: string): Promise<any> {
    try {
      // Convert markdown-style comment to ADF format
      const adfComment = this.convertMarkdownToADF(comment);
      
      const response = await this.client.post(`/issue/${issueKey}/comment`, {
        body: adfComment
      });
      logger.info(`Added comment to Jira issue: ${issueKey}`);
      return response.data;
    } catch (error) {
      logger.error(`Error adding comment to Jira issue ${issueKey}:`, error);
      throw error;
    }
  }

  async searchIssues(jql: string): Promise<JiraIssue[]> {
    try {
      const response = await this.client.post('/search/jql', {
        jql,
        fields: ['key', 'summary', 'description', 'issuetype', 'status'],
        maxResults: 100,
      });
      return response.data.issues;
    } catch (error) {
      logger.error('Error searching Jira issues:', error);
      throw error;
    }
  }

  async findDuplicateIssue(summary: string, issueType: string): Promise<JiraIssue | null> {
    try {
      // Use exact match JQL query to avoid partial matches
      const jql = `summary = "${summary}" AND issuetype = "${issueType}" AND project = "${config.jira.projectKey}"`;
      logger.debug(`🔍 Searching for duplicates with JQL: ${jql}`);
      
      const issues = await this.searchIssues(jql);
      logger.debug(`🔍 Found ${issues.length} potential duplicates`);
      
      // Find exact match (case insensitive)
      const exactMatch = issues.find(issue => 
        issue.fields.summary.toLowerCase() === summary.toLowerCase()
      );
      
      if (exactMatch) {
        logger.info(`🔍 DUPLICATE DETECTED:`);
        logger.info(`   📋 Existing Issue: ${exactMatch.key}`);
        logger.info(`   📝 Title: "${exactMatch.fields.summary}"`);
        logger.info(`   🏷️ Type: ${exactMatch.fields.issuetype?.name || 'Unknown'}`);
        logger.info(`   📊 Status: ${exactMatch.fields.status?.name || 'Unknown'}`);
        logger.info(`   📅 Created: ${exactMatch.fields.created || 'Unknown'}`);
        logger.info(`   🔗 URL: ${this.buildJiraUrl(exactMatch.key)}`);
      } else {
        logger.info(`✅ NO DUPLICATES FOUND for title: "${summary}"`);
        logger.info(`   🆕 This is a new issue - proceeding with creation`);
      }
      
      return exactMatch || null;
    } catch (error) {
      logger.error('Error finding duplicate Jira issue:', error);
      return null;
    }
  }

  async findIssueByNotionPageId(notionPageId: string): Promise<JiraIssue | null> {
    try {
      const jql = `description ~ "${notionPageId}" AND project = "${config.jira.projectKey}"`;
      logger.debug(`🔍 Searching for Jira issue by Notion page ID: ${notionPageId}`);
      
      const issues = await this.searchIssues(jql);
      
      if (issues.length > 0) {
        logger.info(`🔗 FOUND JIRA ISSUE LINKED TO NOTION PAGE:`);
        logger.info(`   📋 Jira Key: ${issues[0].key}`);
        logger.info(`   📝 Title: "${issues[0].fields.summary}"`);
        logger.info(`   📊 Status: ${issues[0].fields.status?.name || 'Unknown'}`);
        logger.info(`   🔗 URL: ${this.buildJiraUrl(issues[0].key)}`);
        return issues[0];
      }
      
      logger.info(`❌ No Jira issue found for Notion page: ${notionPageId}`);
      return null;
    } catch (error) {
      logger.error('Error finding Jira issue by Notion page ID:', error);
      return null;
    }
  }

  async createEpic(
    title: string, 
    description?: string, 
    dueDate?: string, 
    priority?: string, 
    notionUrl?: string,
    startDate?: string,
    endDate?: string
  ): Promise<JiraIssue> {
    // Create clickable Notion link in ADF format
    let fullDescription = null;
    if (notionUrl) {
      fullDescription = this.createNotionLinkADF(notionUrl);
    }

    const issueData: JiraCreateIssueRequest = {
      fields: {
        summary: title,
        description: fullDescription,
        issuetype: {
          name: 'Epic',
        },
        project: {
          key: config.jira.projectKey,
        },
        labels: ['notion-sync', 'epic'],
      },
    };

    // Add due date if provided
    if (dueDate) {
      issueData.fields.duedate = dueDate;
    }

    // Add start and end dates to description since custom fields aren't available
    if (startDate || endDate) {
      let dateInfo = '\n\n**Epic Timeline:**\n';
      if (startDate) {
        dateInfo += `• Start Date: ${startDate}\n`;
      }
      if (endDate) {
        dateInfo += `• End Date: ${endDate}\n`;
      }
      fullDescription += dateInfo;
    }

    // Add priority if provided
    if (priority) {
      issueData.fields.priority = {
        name: this.mapPriorityToJira(priority)
      };
    }

    return this.createIssue(issueData);
  }

  async createStory(
    title: string, 
    description?: string, 
    epicKey?: string, 
    storyPoints?: number,
    labels?: string[],
    dueDate?: string,
    priority?: string,
    notionUrl?: string,
    redDate?: string,
    greenDate?: string,
    blueDate?: string
  ): Promise<JiraIssue> {
    // Create clickable Notion link in ADF format
    let fullDescription = null;
    if (notionUrl) {
      fullDescription = this.createNotionLinkADF(notionUrl);
    }

    const issueData: JiraCreateIssueRequest = {
      fields: {
        summary: title,
        description: fullDescription,
        issuetype: {
          name: 'Story',
        },
        project: {
          key: config.jira.projectKey,
        },
        labels: ['notion-sync', 'story', ...(labels || [])],
      },
    };

    // Add story points if provided
    if (storyPoints) {
      issueData.fields.customfield_10016 = storyPoints;
    }

    // Add epic link if provided
    if (epicKey) {
      issueData.fields.parent = {
        key: epicKey,
      };
    }

    // Add due date if provided
    if (dueDate) {
      issueData.fields.duedate = dueDate;
    }

    // Add priority if provided
    if (priority) {
      issueData.fields.priority = {
        name: this.mapPriorityToJira(priority)
      };
    }

    // Add RGB dates if provided
    if (redDate) {
      issueData.fields.customfield_10020 = redDate; // Red date custom field
    }
    if (greenDate) {
      issueData.fields.customfield_10021 = greenDate; // Green date custom field
    }
    if (blueDate) {
      issueData.fields.customfield_10022 = blueDate; // Blue date custom field
    }

    return this.createIssue(issueData);
  }

  async createTask(
    title: string, 
    description?: string, 
    parentKey?: string,
    labels?: string[]
  ): Promise<JiraIssue> {
    const issueData: JiraCreateIssueRequest = {
      fields: {
        summary: title,
        description: description || undefined,
        issuetype: {
          name: 'Task',
        },
        project: {
          key: config.jira.projectKey,
        },
        labels: ['notion-sync', ...(labels || [])],
      },
    };

    // Add parent link if provided
    if (parentKey) {
      issueData.fields.parent = {
        key: parentKey,
      };
    }

    return this.createIssue(issueData);
  }

  async getEpicKey(epicTitle: string): Promise<string | null> {
    try {
      const jql = `summary ~ "${epicTitle}" AND issuetype = "Epic" AND project = "${config.jira.projectKey}"`;
      const issues = await this.searchIssues(jql);
      
      const exactMatch = issues.find(issue => 
        issue.fields.summary.toLowerCase() === epicTitle.toLowerCase()
      );
      
      return exactMatch ? exactMatch.key : null;
    } catch (error) {
      logger.error('Error finding epic key:', error);
      return null;
    }
  }

  buildJiraUrl(issueKey: string): string {
    return `${config.jira.baseUrl}/browse/${issueKey}`;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/myself');
      return true;
    } catch (error) {
      logger.error('Jira connection test failed:', error);
      return false;
    }
  }

  private mapPriorityToJira(notionPriority: string): string {
    const priorityMap: { [key: string]: string } = {
      'High': 'Highest',
      'Medium': 'High', 
      'Low': 'Medium',
      'Critical': 'Critical'
    };
    
    return priorityMap[notionPriority] || 'Medium';
  }

  private convertToADF(text: string): any {
    // Convert plain text to Atlassian Document Format (ADF)
    const lines = text.split('\n');
    const content = lines.map(line => ({
      type: 'paragraph',
      content: line.trim() ? [{
        type: 'text',
        text: line
      }] : []
    }));

    return {
      type: 'doc',
      version: 1,
      content: content.filter(block => block.content.length > 0)
    };
  }

  public convertMarkdownToADF(markdown: string): any {
    const lines = markdown.split('\n');
    const content: any[] = [];
    
    for (const line of lines) {
      if (!line.trim()) {
        // Empty line - add empty paragraph
        content.push({
          type: 'paragraph',
          content: []
        });
        continue;
      }
      
      // Handle bold text (**text**)
      if (line.includes('**')) {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const paragraphContent: any[] = [];
        
        for (const part of parts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            // Bold text
            const boldText = part.slice(2, -2);
            paragraphContent.push({
              type: 'text',
              text: boldText,
              marks: [{ type: 'strong' }]
            });
          } else if (part.trim()) {
            // Regular text
            paragraphContent.push({
              type: 'text',
              text: part
            });
          }
        }
        
        content.push({
          type: 'paragraph',
          content: paragraphContent
        });
      } else {
        // Regular line
        content.push({
          type: 'paragraph',
          content: [{
            type: 'text',
            text: line
          }]
        });
      }
    }
    
    return {
      type: 'doc',
      version: 1,
      content: content
    };
  }

  public createNotionLinkADF(notionUrl: string): any {
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '🔗 '
            },
            {
              type: 'text',
              text: 'Notion Page: ',
              marks: [{ type: 'strong' }]
            },
            {
              type: 'text',
              text: 'View in Notion',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: notionUrl
                  }
                }
              ]
            }
          ]
        }
      ]
    };
  }
}
