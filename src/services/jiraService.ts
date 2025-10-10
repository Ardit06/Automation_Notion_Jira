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

  // Helper method to find custom field IDs
  async findCustomFieldId(fieldName: string): Promise<string | null> {
    try {
      const response = await this.client.get('/field');
      const fields = response.data;
      
      const customField = fields.find((field: any) => 
        field.name.toLowerCase().includes(fieldName.toLowerCase()) ||
        field.name.toLowerCase().includes('requirements engineer') ||
        field.name.toLowerCase().includes('reporter')
      );
      
      if (customField) {
        logger.info(`🔍 Found custom field: ${customField.name} (ID: ${customField.id})`);
        return customField.id;
      }
      
      logger.warn(`⚠️ No custom field found matching: ${fieldName}`);
      return null;
    } catch (error) {
      logger.error(`❌ Error finding custom field: ${error}`);
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
    reporter?: string
  ): Promise<JiraIssue> {
    // Create ADF format description with Notion link
    let fullDescription = this.createDescriptionADF(description, notionUrl);

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
        labels: [],
      },
    };

    // Try to set Requirements Engineer as reporter, fallback to custom field if needed
    if (reporter) {
      logger.info(`👤 Requirements Engineer extracted: ${reporter}`);
      
      // First try the standard reporter field
      try {
        // issueData.fields.reporter = {
        //   accountId: reporter
        // };
        logger.debug(`🔧 Setting reporter with accountId: ${reporter}`);
      } catch (error) {
        logger.warn(`⚠️ Reporter field failed, trying custom field approach`);
        
        // Fallback: Try to set Requirements Engineer as assignee or custom field
        try {
          // Try assignee field as fallback
          issueData.fields.assignee = {
            accountId: reporter
          };
          logger.info(`✅ Set Requirements Engineer as assignee: ${reporter}`);
        } catch (assigneeError) {
          logger.warn(`⚠️ Assignee field also failed, trying custom field approach`);
          
          // Try to find and use a custom field
          const customFieldId = await this.findCustomFieldId('Requirements Engineer');
          if (customFieldId) {
            (issueData.fields as any)[customFieldId] = reporter;
            logger.info(`✅ Set Requirements Engineer in custom field ${customFieldId}: ${reporter}`);
          } else {
            logger.info(`ℹ️ Requirements Engineer logged: ${reporter} (no suitable field found)`);
          }
        }
      }
    }

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
    blueDate?: string,
    reporter?: string
  ): Promise<JiraIssue> {
    // Create ADF format description with Notion link
    let fullDescription = this.createDescriptionADF(description, notionUrl);

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
        labels: [...(labels || [])],
      },
    };

    // Try to set Requirements Engineer as reporter, fallback to custom field if needed
    if (reporter) {
      logger.info(`👤 Requirements Engineer extracted: ${reporter}`);
      
      // First try the standard reporter field
      try {
        // issueData.fields.reporter = {
        //   accountId: reporter
        // };
        logger.debug(`🔧 Setting reporter with accountId: ${reporter}`);
      } catch (error) {
        logger.warn(`⚠️ Reporter field failed, trying custom field approach`);
        
        // Fallback: Try to set Requirements Engineer as assignee or custom field
        try {
          // Try assignee field as fallback
          issueData.fields.assignee = {
            accountId: reporter
          };
          logger.info(`✅ Set Requirements Engineer as assignee: ${reporter}`);
        } catch (assigneeError) {
          logger.warn(`⚠️ Assignee field also failed, trying custom field approach`);
          
          // Try to find and use a custom field
          const customFieldId = await this.findCustomFieldId('Requirements Engineer');
          if (customFieldId) {
            (issueData.fields as any)[customFieldId] = reporter;
            logger.info(`✅ Set Requirements Engineer in custom field ${customFieldId}: ${reporter}`);
          } else {
            logger.info(`ℹ️ Requirements Engineer logged: ${reporter} (no suitable field found)`);
          }
        }
      }
    }

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

    // Add priority if provided (only if the field exists in the project)
    // Note: Priority field might not be available in all Jira configurations
    // if (priority) {
    //   issueData.fields.priority = {
    //     name: this.mapPriorityToJira(priority)
    //   };
    // }

    // Add RGB dates if provided (only if custom fields exist in the project)
    // Note: These custom fields might not be available in all Jira configurations
    // if (redDate) {
    //   issueData.fields.customfield_10020 = redDate; // Red date custom field
    // }
    // if (greenDate) {
    //   issueData.fields.customfield_10021 = greenDate; // Green date custom field
    // }
    // if (blueDate) {
    //   issueData.fields.customfield_10022 = blueDate; // Blue date custom field
    // }

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

  async addRequirementsEngineerComment(
    jiraKey: string,
    requirementsEngineerEmail: string,
    issueTitle: string
  ): Promise<boolean> {
    try {
      const commentText = `Hi @aurita@91.life,

This issue "${issueTitle}" has been moved back to **Ready For Dev** status.

The development team is ready to work on this item. Please review and let us know if there are any additional requirements or clarifications needed.

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
                  text: commentText,
                  marks: []
                }
              ]
            }
          ]
        }
      };

      await this.client.post(`/issue/${jiraKey}/comment`, commentData);
      logger.info(`✅ Requirements Engineer comment added to ${jiraKey} for ${requirementsEngineerEmail}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to add Requirements Engineer comment to ${jiraKey}:`, error);
      return false;
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

  async addStatusChangeComment(issueKey: string, oldStatus: string, newStatus: string, scrumMasterEmail?: string): Promise<boolean> {
    try {
      let comment = `🚀 **Back to Ready for Dev**\n\n`;
      comment += `This issue has been moved back to **Ready for Dev** status from **${oldStatus}**.\n\n`;
      comment += `The development team can now work on this item. Please review and let us know if there are any additional requirements or clarifications needed.\n\n`;
      
      if (scrumMasterEmail) {
        comment += `[~${scrumMasterEmail}] This item is ready for development.`;
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
                  text: scrumMasterEmail ? `[~${scrumMasterEmail}]` : '@scrum-master',
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

  public createDescriptionADF(description?: string, notionUrl?: string): any {
    const content: any[] = [];
    
    // Only add Notion link, not the description content
    // Add Notion link if provided
    if (notionUrl) {
      content.push({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '🔗 ',
            marks: []
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
      });
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
