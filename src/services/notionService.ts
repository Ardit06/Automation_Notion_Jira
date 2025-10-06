import axios, { AxiosInstance } from 'axios';
import { NotionPage, NotionDatabase, WebhookPayload } from '../types';
import { config } from '../config';
import { logger } from './loggerService';

export class NotionService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.notion.com/v1',
      headers: {
        'Authorization': `Bearer ${config.notion.apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    });
  }

  async getPage(pageId: string): Promise<NotionPage> {
    try {
      const response = await this.client.get(`/pages/${pageId}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching Notion page:', error);
      throw error;
    }
  }

  async getPageContent(pageId: string): Promise<string> {
    try {
      const response = await this.client.get(`/blocks/${pageId}/children`);
      const blocks = response.data.results;
      
      // Extract text content from blocks
      let content = '';
      for (const block of blocks) {
        if (block.type === 'paragraph' && block.paragraph?.rich_text) {
          const text = block.paragraph.rich_text
            .map((text: any) => text.plain_text)
            .join('');
          content += text + '\n';
        } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
          const text = block.bulleted_list_item.rich_text
            .map((text: any) => text.plain_text)
            .join('');
          content += '• ' + text + '\n';
        } else if (block.type === 'numbered_list_item' && block.numbered_list_item?.rich_text) {
          const text = block.numbered_list_item.rich_text
            .map((text: any) => text.plain_text)
            .join('');
          content += '1. ' + text + '\n';
        }
      }
      
      return content.trim();
    } catch (error) {
      logger.error(`Error fetching page content for ${pageId}:`, error);
      return '';
    }
  }

  async getDatabase(databaseId: string): Promise<NotionDatabase> {
    try {
      const response = await this.client.get(`/databases/${databaseId}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching Notion database:', error);
      throw error;
    }
  }

  async queryDatabase(databaseId: string, filter?: any): Promise<NotionPage[]> {
    try {
      const response = await this.client.post(`/databases/${databaseId}/query`, {
        filter,
      });
      return response.data.results;
    } catch (error) {
      logger.error('Error querying Notion database:', error);
      throw error;
    }
  }

  async updatePage(pageId: string, properties: any): Promise<NotionPage> {
    try {
      logger.debug(`🔄 Updating Notion page ${pageId} with properties:`, JSON.stringify(properties, null, 2));
      
      const response = await this.client.patch(`/pages/${pageId}`, {
        properties,
      });
      
      logger.debug(`✅ Successfully updated Notion page ${pageId}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Error updating Notion page ${pageId}:`, error);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}`);
        logger.error(`Response data:`, JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async addJiraLink(pageId: string, jiraKey: string, jiraUrl: string): Promise<void> {
    try {
      // Get the page to check available properties
      const page = await this.getPage(pageId);
      const properties = page.properties;
      
      logger.debug(`🔗 Adding Jira link to page ${pageId}`);
      logger.debug(`📋 Available properties: ${Object.keys(properties).join(', ')}`);
      
      // Try to find a suitable field to add the Jira link
      let targetField = null;
      let currentContent = '';
      
      // Check for common field names that might be rich_text
      const possibleFields = ['Notes', 'Description', 'Comments', 'Details', 'Jira Link'];
      
      for (const fieldName of possibleFields) {
        if (properties[fieldName] && properties[fieldName].type === 'rich_text') {
          targetField = fieldName;
          currentContent = this.extractTextValue(properties[fieldName]) || '';
          logger.debug(`📝 Found suitable field: ${fieldName}`);
          break;
        }
      }
      
      // If no suitable field found, try to find any rich_text field
      if (!targetField) {
        for (const [fieldName, field] of Object.entries(properties)) {
          if (field.type === 'rich_text') {
            targetField = fieldName;
            currentContent = this.extractTextValue(field) || '';
            logger.debug(`📝 Using fallback field: ${fieldName}`);
            break;
          }
        }
      }
      
      if (!targetField) {
        logger.warn(`⚠️ No suitable rich_text field found in page ${pageId} to add Jira link`);
        return;
      }
      
      // Create clickable Jira link using Notion's rich text format
      const jiraInfo = `\n\n🔗 Jira: `;
      const newContent = currentContent + jiraInfo;
      
      // Build rich_text content with clickable link
      const richTextContent = [{
        type: 'text',
        text: {
          content: newContent
        }
      }, {
        type: 'text',
        text: {
          content: jiraKey,
          link: {
            url: jiraUrl
          }
        },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        }
      }];
      
      await this.updatePage(pageId, {
        [targetField]: {
          rich_text: richTextContent,
        },
      });
      
      logger.info(`✅ Added clickable Jira link to Notion page ${pageId} in field '${targetField}': ${jiraKey}`);
    } catch (error) {
      logger.error(`❌ Error adding Jira link to Notion page ${pageId}:`, error);
      throw error;
    }
  }

  async checkJiraLinkExists(pageId: string): Promise<{ exists: boolean; jiraKey?: string; jiraUrl?: string }> {
    try {
      const page = await this.getPage(pageId);
      
      // Check both Description and Notes fields for Jira links
      const descriptionProperty = page.properties['Description'];
      const notesProperty = page.properties['Notes'];
      
      // Extract all text from rich_text properties
      let description = '';
      let notes = '';
      
      if (descriptionProperty?.type === 'rich_text' && descriptionProperty.rich_text) {
        description = descriptionProperty.rich_text
          .map((text: any) => text.plain_text || '')
          .join('');
      }
      
      if (notesProperty?.type === 'rich_text' && notesProperty.rich_text) {
        notes = notesProperty.rich_text
          .map((text: any) => text.plain_text || '')
          .join('');
      }
      
      // Combine both fields to check for Jira links
      const combinedText = description + ' ' + notes;
      
      // Check if any field contains Jira link pattern (both old format and new clickable format)
      // Look for complete Jira links with actual keys (e.g., "🔗 Jira: OR-123" or "🔗 Jira: OR-123 - https://...")
      const jiraMatch = combinedText.match(/🔗 Jira: ([A-Z]+-\d+)(?:\s*-?\s*(https?:\/\/[^\s]+))?/);
      
      if (jiraMatch && jiraMatch[1] && jiraMatch[1].length > 3) {
        const jiraKey = jiraMatch[1];
        const jiraUrl = jiraMatch[2] || `https://mardit15-17.atlassian.net/browse/${jiraKey}`;
        
        logger.info(`🔗 EXISTING JIRA LINK FOUND:`);
        logger.info(`   📋 Jira Key: ${jiraKey}`);
        logger.info(`   🔗 Jira URL: ${jiraUrl}`);
        logger.info(`   📄 Notion Page: ${pageId}`);
        logger.info(`   💡 This page is already linked to a Jira issue - skipping creation`);
        return {
          exists: true,
          jiraKey: jiraKey,
          jiraUrl: jiraUrl,
        };
      }

      logger.info(`✅ NO EXISTING JIRA LINKS FOUND in page ${pageId} - proceeding with creation`);
      return { exists: false };
    } catch (error) {
      logger.error('Error checking Jira link in Notion page:', error);
      return { exists: false };
    }
  }

  async extractPageData(page: NotionPage): Promise<{
    title: string;
    description?: string;
    status?: string;
    issueType?: string;
    storyPoints?: number;
    labels?: string[];
    epicLink?: string;
    priority?: string;
    dueDate?: string;
    startDate?: string;
    endDate?: string;
    epicKey?: string;
    [key: string]: any;
  }> {
    const properties = page.properties;
    
    logger.debug(`🔍 Extracting page data for page ID: ${page.id}`);
    logger.debug(`📋 Available properties: ${Object.keys(properties).join(', ')}`);
    
    // Debug the Name property specifically
    const nameProperty = properties['Name'];
    logger.debug(`📝 Name property:`, JSON.stringify(nameProperty, null, 2));
    
    // Try to get description from Description property first, then Notes, then fall back to page content
    let description = this.extractTextValue(properties['Description']) || 
                     this.extractTextValue(properties['Notes']);
    if (!description) {
      // If no Description or Notes property, try to get content from page body
      logger.debug(`📄 No Description or Notes property, fetching page content...`);
      description = await this.getPageContent(page.id);
    }
    
    // Try to extract title from different possible property names
    let title = this.extractTextValue(properties['Name']) || 
                this.extractTextValue(properties['Title']) || 
                this.extractTextValue(properties['Task']) ||
                this.extractTextValue(properties['Ticket']) ||
                this.extractTextValue(properties['Summary']) ||
                '';
    
    logger.debug(`📝 Final extracted title: "${title}"`);
    
    const extractedData = {
      title: title,
      description: description,
      status: this.extractSelectValue(properties['Status']),
      issueType: 'Story', // Default to Story since no Issue Type property
      storyPoints: this.extractNumberValue(properties['Story Points']),
      labels: [], // No Labels property
      epicLink: this.extractTextValue(properties['Epic Key']),
      priority: this.extractSelectValue(properties['Priority']),
      dueDate: this.extractDateValue(properties['Due Date']),
      startDate: this.extractDateValue(properties['Start Date']),
      endDate: this.extractDateValue(properties['End Date']),
      epicKey: this.extractTextValue(properties['Epic Key']),
      // RGB dates for user stories and epics
      redDate: this.extractDateValue(properties['Red Date']) || this.extractDateValue(properties['Red']),
      greenDate: this.extractDateValue(properties['Green Date']) || this.extractDateValue(properties['Green']),
      blueDate: this.extractDateValue(properties['Blue Date']) || this.extractDateValue(properties['Blue']),
    };
    
    logger.debug(`📊 Final extracted data:`, JSON.stringify(extractedData, null, 2));
    return extractedData;
  }

  private extractTextValue(property: any): string | undefined {
    if (!property) {
      logger.debug('Property is null or undefined');
      return undefined;
    }
    
    logger.debug(`Extracting text from property type: ${property.type}`);
    
    if (property.type === 'title' && property.title?.[0]?.text?.content) {
      const title = property.title[0].text.content;
      logger.debug(`Extracted title: "${title}"`);
      return title;
    }
    
    if (property.type === 'rich_text' && property.rich_text?.[0]?.text?.content) {
      const text = property.rich_text[0].text.content;
      logger.debug(`Extracted rich_text: "${text}"`);
      return text;
    }
    
    if (property.type === 'url' && property.url) {
      const url = property.url;
      logger.debug(`Extracted URL: "${url}"`);
      return url;
    }
    
    logger.debug(`No text content found in property:`, JSON.stringify(property, null, 2));
    return undefined;
  }

  private extractSelectValue(property: any): string | undefined {
    if (!property) return undefined;
    
    // Handle select properties
    if (property.type === 'select') {
      return property.select?.name;
    }
    
    // Handle status properties
    if (property.type === 'status') {
      return property.status?.name;
    }
    
    return undefined;
  }

  private extractNumberValue(property: any): number | undefined {
    if (!property || property.type !== 'number') return undefined;
    return property.number;
  }

  private extractMultiSelectValue(property: any): string[] | undefined {
    if (!property || property.type !== 'multi_select') return undefined;
    return property.multi_select?.map((item: any) => item.name) || [];
  }

  private extractDateValue(property: any): string | undefined {
    if (!property || property.type !== 'date') return undefined;
    return property.date?.start;
  }

  private async validateFieldType(pageId: string, fieldName: string): Promise<boolean> {
    try {
      const page = await this.getPage(pageId);
      const field = page.properties[fieldName];
      const isValid = field && field.type === 'rich_text';
      logger.debug(`Field ${fieldName} validation: ${isValid ? 'VALID' : 'INVALID'} (type: ${field?.type})`);
      return isValid;
    } catch (error) {
      logger.error(`Error validating field ${fieldName}:`, error);
      return false;
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', config.notion.webhookSecret)
        .update(payload)
        .digest('hex');
      
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      
      // Check if buffers have the same length before comparing
      if (signatureBuffer.length !== expectedBuffer.length) {
        logger.warn(`Signature length mismatch: received ${signatureBuffer.length}, expected ${expectedBuffer.length}`);
        return false;
      }
      
      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }
}
