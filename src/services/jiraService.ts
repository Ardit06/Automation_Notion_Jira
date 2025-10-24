import axios, { AxiosInstance } from 'axios';
import { JiraIssue, JiraCreateIssueRequest } from '../types';
import { config, ISSUE_TYPE_MAPPING, JIRA_CUSTOM_FIELDS } from '../config';
import { logger } from './loggerService';

export class JiraService {
  private client: AxiosInstance;

  constructor() {
    // Initialize with single user configuration
    this.client = this.createClient();
  }

  private createClient(): AxiosInstance {
    return axios.create({
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
      logger.debug(`📤 Sending issue data to Jira: ${JSON.stringify(issueData, null, 2)}`);
      const response = await this.client.post('/issue', issueData);
      logger.info(`✅ Created Jira issue: ${response.data.key}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Error creating Jira issue:`, error);
      if (error.response?.data) {
        logger.error(`   Response data:`, JSON.stringify(error.response.data, null, 2));
      }
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


  async searchIssues(jql: string): Promise<JiraIssue[]> {
    try {
      const response = await this.client.post('/search', {
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
    endDate?: string,
    figmaLink?: string
  ): Promise<JiraIssue> {
    // Create ADF format description for Epics: include Notion link + full content
    let fullDescription = this.createDescriptionADF(description, notionUrl, true, figmaLink);

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
        // Epic Type is required for Epics in this Jira project
        [JIRA_CUSTOM_FIELDS.EPIC_TYPE]: { id: JIRA_CUSTOM_FIELDS.EPIC_TYPE_VALUE }
      },
    };

    // Note: Reporter field is automatically set to the authenticated user (API token owner)
    // and cannot be changed during issue creation

    // Add due date if provided
    if (dueDate) {
      issueData.fields.duedate = dueDate;
    }

    // Add start and end dates to description since custom fields aren't available
    if (startDate || endDate) {
      let dateInfo = '\n\nEpic Timeline:';
      if (startDate) {
        dateInfo += `\n• Start Date: ${startDate}`;
      }
      if (endDate) {
        dateInfo += `\n• End Date: ${endDate}`;
      }
      fullDescription += dateInfo;
    }

    // Add priority if provided
    if (priority) {
      issueData.fields.priority = {
        name: this.mapPriorityToJira(priority)
      };
    }

    // Add Figma link if provided
    if (figmaLink) {
      // Add Figma link to custom field
      issueData.fields[JIRA_CUSTOM_FIELDS.FIGMA_LINK] = figmaLink;
      logger.info(`🎨 Figma link added to Epic: ${figmaLink}`);
    }

    return this.createIssue(issueData);
  }

  async createStory(
    title: string, 
    description?: string, 
    epicKey?: string, 
    storyPoints?: number,
    dueDate?: string,
    priority?: string,
    notionUrl?: string,
    redDate?: string,
    greenDate?: string,
    blueDate?: string,
    figmaLink?: string
  ): Promise<JiraIssue> {
    // Create ADF format description for Stories: include Notion link + full content
    let fullDescription = this.createDescriptionADF(description, notionUrl, true, figmaLink);

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
      },
    };

    // Note: Reporter field is automatically set to the authenticated user (API token owner)
    // and cannot be changed during issue creation

    // Add story points if provided
    if (storyPoints) {
      issueData.fields[JIRA_CUSTOM_FIELDS.STORY_POINTS] = storyPoints;
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

    // Add Figma link if provided
    if (figmaLink) {
      // Add Figma link to custom field
      issueData.fields[JIRA_CUSTOM_FIELDS.FIGMA_LINK] = figmaLink;
      logger.info(`🎨 Figma link added: ${figmaLink}`);
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
        labels: [...(labels || [])],
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

  getClient() {
    return this.client;
  }

  async addComment(issueKey: string, comment: string): Promise<boolean> {
    try {
      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: comment
                }
              ]
            }
          ]
        }
      };

      await this.client.post(`/issue/${issueKey}/comment`, commentData);
      logger.info(`✅ Comment added to ${issueKey}: "${comment.substring(0, 50)}..."`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to add comment to ${issueKey}:`, error);
      return false;
    }
  }

  async getIssueStatus(jiraKey: string): Promise<string | null> {
    try {
      const response = await this.client.get(`/issue/${jiraKey}`);
      return response.data.fields.status.name;
    } catch (error) {
      logger.error(`❌ Failed to get issue status for ${jiraKey}:`, error);
      return null;
    }
  }

  async reopenIssue(jiraKey: string, issueTitle: string): Promise<boolean> {
    try {
      // Add a comment explaining the reopening
      const commentText = `🔄 **Issue Reopened - Back to Ready For Dev**

This issue "${issueTitle}" has been reopened because the status in Notion changed back to "Ready For Dev".

The item is now ready for development again.

---
*Automated by Notion-Jira Integration*`;

      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: commentText,
                  marks: []
                }
              ]
            }
          ]
        }
      };

      await this.client.post(`/issue/${jiraKey}/comment`, commentData);
      logger.info(`✅ Reopening comment added to ${jiraKey}`);

      // Reopen the issue (transition to "To Do" or "Open")
      const transitionData = {
        transition: {
          id: '11' // "To Do" transition - you may need to adjust this ID based on your Jira setup
        }
      };

      await this.client.post(`/issue/${jiraKey}/transitions`, transitionData);
      logger.info(`✅ Jira issue ${jiraKey} reopened successfully`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to reopen Jira issue ${jiraKey}:`, error);
      return false;
    }
  }

  async resolveIssue(
    jiraKey: string,
    newStatus: string,
    issueTitle: string
  ): Promise<boolean> {
    try {
      // First, add a comment explaining why the issue is being resolved
      const commentText = `🔒 **Issue Resolved - Status Change**

This issue "${issueTitle}" has been resolved because the status in Notion changed from "Ready For Dev" to "${newStatus}".

This indicates that changes or additional work are needed before this item can be considered ready for development again.

The issue will be automatically reopened if the status returns to "Ready For Dev".

---
*Automated by Notion-Jira Integration*`;

      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: commentText,
                  marks: []
                }
              ]
            }
          ]
        }
      };

      await this.client.post(`/issue/${jiraKey}/comment`, commentData);
      logger.info(`✅ Resolution comment added to ${jiraKey}`);

      // Now resolve the issue
      const transitionData = {
        transition: {
          id: '21' // "Done" transition - you may need to adjust this ID based on your Jira setup
        }
      };

      await this.client.post(`/issue/${jiraKey}/transitions`, transitionData);
      logger.info(`✅ Jira issue ${jiraKey} resolved successfully`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to resolve Jira issue ${jiraKey}:`, error);
      return false;
    }
  }

  async addReviewNotificationComment(issueKey: string, oldStatus: string, newStatus: string, issueTitle: string, scrumMasterEmails?: string[]): Promise<void> {
    try {
      const mentions = scrumMasterEmails?.map(email => `[~${email}]`).join(' ') || '';
      
      const comment = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `🚨 HIGH PRIORITY: `,
                  marks: [{ type: 'strong' }]
                },
                {
                  type: 'text',
                  text: `Ticket "${issueTitle}" moved to Review status in production!`
                }
              ]
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Status changed from "${oldStatus}" to "${newStatus}". Please review and take action.`
                }
              ]
            },
            ...(mentions ? [{
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Scrum Masters: ${mentions}`,
                  marks: [{ type: 'strong' }]
                }
              ]
            }] : [])
          ]
        }
      };

      await this.client.post(`/issue/${issueKey}/comment`, comment);
      logger.info(`✅ Added review notification comment to ${issueKey}`);
    } catch (error) {
      logger.error(`❌ Failed to add review notification comment to ${issueKey}:`, error);
      throw error;
    }
  }

  async addReadyForDevUpdateComment(issueKey: string, oldStatus: string, newStatus: string, issueTitle: string, scrumMasterEmails?: string[]): Promise<void> {
    try {
      const mentions = scrumMasterEmails?.map(email => `[~${email}]`).join(' ') || '';
      
      const comment = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `📝 MEDIUM PRIORITY: `,
                  marks: [{ type: 'strong' }]
                },
                {
                  type: 'text',
                  text: `Ticket "${issueTitle}" moved back to Ready For Dev with updated content!`
                }
              ]
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Status changed from "${oldStatus}" to "${newStatus}". Content has been updated from Notion.`
                }
              ]
            },
            ...(mentions ? [{
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Scrum Masters: ${mentions}`,
                  marks: [{ type: 'strong' }]
                }
              ]
            }] : [])
          ]
        }
      };

      await this.client.post(`/issue/${issueKey}/comment`, comment);
      logger.info(`✅ Added ready for dev update comment to ${issueKey}`);
    } catch (error) {
      logger.error(`❌ Failed to add ready for dev update comment to ${issueKey}:`, error);
      throw error;
    }
  }

  async addReadyForDevTagComment(
    jiraKey: string,
    issueTitle: string,
    taggedUserEmail?: string,
    taggedUserName?: string
  ): Promise<boolean> {
    try {
      // Create the comment text with tagging
      let commentText = `🚀 **Ready For Dev - Item Available for Development**

This issue "${issueTitle}" has been moved back to **Ready For Dev** status.

The development team can now work on this item. Please review and let us know if there are any additional requirements or clarifications needed.`;

      // Add tagging if user information is provided
      if (taggedUserEmail && taggedUserName) {
        commentText += `\n\nHi [~${taggedUserEmail}] (${taggedUserName}), please review this status change.`;
      } else if (taggedUserName) {
        // Fallback to just the name if email is not available
        commentText += `\n\nHi @${taggedUserName}, please review this status change.`;
      } else {
        // Default tagging to aurita@91.life if no specific user is provided
        commentText += `\n\nHi [~aurita@91.life], please review this status change.`;
      }

      commentText += `\n\nBest regards,\nAutomation System`;

      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: commentText,
                  marks: []
                }
              ]
            }
          ]
        }
      };

      await this.client.post(`/issue/${jiraKey}/comment`, commentData);
      
      const userInfo = taggedUserName ? `${taggedUserName} (${taggedUserEmail || 'no email'})` : 'aurita@91.life (default)';
      logger.info(`✅ Ready For Dev tag comment added to ${jiraKey} for ${userInfo}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to add Ready For Dev tag comment to ${jiraKey}:`, error);
      return false;
    }
  }

  async addStatusChangeComment(issueKey: string, oldStatus: string, newStatus: string, scrumMasterEmails?: string[]): Promise<boolean> {
    try {
      let comment = `🚀 **Back to Ready for Dev**\n\n`;
      comment += `This issue has been moved back to **Ready for Dev** status from **${oldStatus}**.\n\n`;
      comment += `The development team can now work on this item. Please review and let us know if there are any additional requirements or clarifications needed.\n\n`;
      
      if (scrumMasterEmails && scrumMasterEmails.length > 0) {
        const mentions = scrumMasterEmails.map(email => `[~${email}]`).join(' ');
        comment += `${mentions} This item is ready for development.`;
      } else {
        comment += `@scrum-master This item is ready for development.`;
      }

      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: '📊 ',
                  marks: []
                },
                {
                  type: 'text',
                  text: 'Status Update from Notion',
                  marks: [{ type: 'strong' }]
                }
              ]
            },
            {
              type: 'paragraph',
              content: []
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Status changed from `,
                  marks: []
                },
                {
                  type: 'text',
                  text: oldStatus,
                  marks: [{ type: 'strong' }]
                },
                {
                  type: 'text',
                  text: ' → ',
                  marks: []
                },
                {
                  type: 'text',
                  text: newStatus,
                  marks: [{ type: 'strong' }]
                }
              ]
            },
            {
              type: 'paragraph',
              content: []
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: scrumMasterEmails && scrumMasterEmails.length > 0 
                    ? scrumMasterEmails.map(email => `[~${email}]`).join(' ')
                    : '@scrum-master',
                  marks: []
                },
                {
                  type: 'text',
                  text: ' Please review this status change.',
                  marks: []
                }
              ]
            }
          ]
        }
      };

      await this.client.post(`/issue/${issueKey}/comment`, commentData);
      logger.info(`✅ Status change comment added to ${issueKey}: ${oldStatus} → ${newStatus}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to add status change comment to ${issueKey}:`, error);
      return false;
    }
  }

  async addNotionCreationComment(jiraKey: string, issueTitle: string): Promise<boolean> {
    try {
      logger.info(`💬 Adding Notion creation comment to: ${jiraKey}`);

      const creationComment = `📝 **Created from Notion**

This ticket "${issueTitle}" has been created from Notion.

Please review the requirements and let us know if there are any questions or clarifications needed.

Best regards,
Automation System`;

      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: creationComment,
                  marks: []
                }
              ]
            }
          ]
        }
      };

      await this.client.post(`/issue/${jiraKey}/comment`, commentData);
      logger.info(`✅ Notion creation comment added to ${jiraKey}`);
      
      return true;
    } catch (error) {
      logger.error(`❌ Failed to add Notion creation comment to ${jiraKey}:`, error);
      return false;
    }
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
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      if (!line.trim()) {
        // Empty line - add empty paragraph
        content.push({
          type: 'paragraph',
          content: []
        });
        i++;
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
        i++;
        continue;
      }
      
      // Handle headings (# ## ###)
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s*/, '');
        
        content.push({
          type: 'heading',
          attrs: { level: Math.min(level, 6) },
          content: [{
            type: 'text',
            text: text
          }]
        });
        i++;
        continue;
      }
      
      // Handle code blocks (```language)
      if (line.startsWith('```')) {
        const language = line.slice(3).trim();
        const codeLines: string[] = [];
        let j = i + 1;
        
        // Collect code lines until closing ```
        while (j < lines.length) {
          const nextLine = lines[j];
          if (nextLine.startsWith('```')) {
            break;
          }
          codeLines.push(nextLine);
          j++;
        }
        
        const codeText = codeLines.join('\n');
        
        // Make Gherkin tests collapsible by using expand/collapse
        if (language === 'gherkin' || 
            codeText.toLowerCase().includes('given') || 
            codeText.toLowerCase().includes('when') || 
            codeText.toLowerCase().includes('then') ||
            codeText.toLowerCase().includes('feature:') ||
            codeText.toLowerCase().includes('scenario:')) {
          
          // Create collapsible section for Gherkin
          content.push({
            type: 'paragraph',
            content: [{
              type: 'text',
              text: '🧪 Acceptance Criteria (Click to expand)',
              marks: [{ type: 'strong' }]
            }]
          });
          
          content.push({
            type: 'codeBlock',
            attrs: { language: 'gherkin' },
            content: [{
              type: 'text',
              text: codeText
            }]
          });
        } else {
          // Regular code block
          content.push({
            type: 'codeBlock',
            attrs: { language: language || 'text' },
            content: [{
              type: 'text',
              text: codeText
            }]
          });
        }
        
        // Skip processed lines
        i = j + 1;
        continue;
      }
      
      // Handle lists (- item)
      if (line.startsWith('- ')) {
        const text = line.slice(2);
        content.push({
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{
                type: 'text',
                text: text
              }]
            }]
          }]
        });
        i++;
        continue;
      }
      
      // Regular paragraph
      content.push({
        type: 'paragraph',
        content: [{
          type: 'text',
          text: line
        }]
      });
      i++;
    }
    
    return {
      type: 'doc',
      version: 1,
      content: content
    };
  }

  public createDescriptionADF(description?: string, notionUrl?: string, includeDescription: boolean = false, figmaLink?: string): any {
    const content: any[] = [];
    
    // Always add a Notion link block if provided
    if (notionUrl) {
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '🔗 ', marks: [] },
          {
            type: 'text',
            text: 'View in Notion',
            marks: [{ type: 'link', attrs: { href: notionUrl } }]
          }
        ]
      });
      
      // Add a separator line
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '—', marks: [] }
        ]
      });
    }

    // Always include the full description content for both Epics and Stories
    if (includeDescription && description && description.trim()) {
      // Convert description to ADF format (handles markdown-like content)
      const adf = this.convertMarkdownToADF(description);
      if (Array.isArray(adf?.content)) {
        content.push(...adf.content);
      }
      
      // Add footer note
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '\n', marks: [] }
        ]
      });
      
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '📝 ', marks: [] },
          { type: 'text', text: 'Content synchronized from Notion', marks: [{ type: 'em' }] }
        ]
      });
    }

    // Add Figma link if provided
    if (figmaLink) {
      // Add separator before Figma link
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '—', marks: [] }
        ]
      });

      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '🎨 ', marks: [] },
          {
            type: 'text',
            text: 'View in Figma',
            marks: [{ type: 'link', attrs: { href: figmaLink } }]
          }
        ]
      });
    }
    
    return { type: 'doc', version: 1, content };
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
              text: '🔗 Notion Page: ',
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
