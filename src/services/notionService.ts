import axios, { AxiosInstance } from 'axios';
import { NotionPage, NotionDatabase, WebhookPayload, NotionDatabaseType } from '../types';
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
      
      logger.debug(`📄 Fetching page content for ${pageId}: found ${blocks.length} blocks`);
      
      // Extract comprehensive text content from blocks
      let content = '';
      let listCounter = 1;
      
      for (const block of blocks) {
        switch (block.type) {
          case 'paragraph':
            if (block.paragraph?.rich_text) {
              const text = block.paragraph.rich_text
                .map((text: any) => text.plain_text)
                .join('');
              if (text.trim()) {
                content += text + '\n\n';
              }
            }
            break;
            
          case 'bulleted_list_item':
            if (block.bulleted_list_item?.rich_text) {
              const text = block.bulleted_list_item.rich_text
                .map((text: any) => text.plain_text)
                .join('');
              content += '• ' + text + '\n';
            }
            break;
            
          case 'numbered_list_item':
            if (block.numbered_list_item?.rich_text) {
              const text = block.numbered_list_item.rich_text
                .map((text: any) => text.plain_text)
                .join('');
              content += `${listCounter}. ` + text + '\n';
              listCounter++;
            }
            break;
            
          case 'heading_1':
            if (block.heading_1?.rich_text) {
              const text = block.heading_1.rich_text
                .map((text: any) => text.plain_text)
                .join('');
              content += `# ${text}\n\n`;
            }
            break;
            
          case 'heading_2':
            if (block.heading_2?.rich_text) {
              const text = block.heading_2.rich_text
                .map((text: any) => text.plain_text)
                .join('');
              content += `## ${text}\n\n`;
            }
            break;
            
          case 'heading_3':
            if (block.heading_3?.rich_text) {
              const text = block.heading_3.rich_text
                .map((text: any) => text.plain_text)
                .join('');
              content += `### ${text}\n\n`;
            }
            break;
            
          case 'quote':
            if (block.quote?.rich_text) {
              const text = block.quote.rich_text
                .map((text: any) => text.plain_text)
                .join('');
              content += `> ${text}\n\n`;
            }
            break;
            
          case 'code':
            if (block.code?.rich_text) {
              const text = block.code.rich_text
                .map((text: any) => text.plain_text)
                .join('');
              const language = block.code.language || '';
              
              // Make Gherkin tests collapsible
              if (language === 'gherkin' || text.toLowerCase().includes('given') || text.toLowerCase().includes('when') || text.toLowerCase().includes('then')) {
                content += `\`\`\`gherkin\n${text}\n\`\`\`\n\n`;
              } else {
                content += `\`\`\`${language}\n${text}\n\`\`\`\n\n`;
              }
            }
            break;
            
          case 'callout':
            if (block.callout?.rich_text) {
              const text = block.callout.rich_text
                .map((text: any) => text.plain_text)
                .join('');
              const icon = block.callout.icon?.emoji || '💡';
              content += `${icon} ${text}\n\n`;
            }
            break;
            
          case 'toggle':
            if (block.toggle?.rich_text) {
              const text = block.toggle.rich_text
                .map((text: any) => text.plain_text)
                .join('');
              content += `▶ ${text}\n\n`;
            }
            break;
            
          case 'divider':
            content += '---\n\n';
            break;
            
          case 'to_do':
            if (block.to_do?.rich_text) {
              const text = block.to_do.rich_text
                .map((text: any) => text.plain_text)
                .join('');
              const checked = block.to_do.checked ? '☑' : '☐';
              content += `${checked} ${text}\n`;
            }
            break;
            
          default:
            // For any other block types, try to extract text if available
            if (block[block.type]?.rich_text) {
              const text = block[block.type].rich_text
                .map((text: any) => text.plain_text)
                .join('');
              if (text.trim()) {
                content += text + '\n';
              }
            }
            break;
        }
      }
      
      logger.debug(`✅ Extracted ${content.length} characters from page content for ${pageId}`);
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

  async queryUserStoriesDatabase(filter?: any): Promise<NotionPage[]> {
    return this.queryDatabase(config.notion.userStoriesDatabaseId, filter);
  }

  async queryEpicsDatabase(filter?: any): Promise<NotionPage[]> {
    return this.queryDatabase(config.notion.epicsDatabaseId, filter);
  }

  async getUserStoriesDatabase(): Promise<NotionDatabase> {
    return this.getDatabase(config.notion.userStoriesDatabaseId);
  }

  async getEpicsDatabase(): Promise<NotionDatabase> {
    return this.getDatabase(config.notion.epicsDatabaseId);
  }

  async determineDatabaseFromPage(pageId: string): Promise<NotionDatabaseType> {
    try {
      // First try to get the page from user stories database
      try {
        const userStoriesPages = await this.queryUserStoriesDatabase();
        const foundInUserStories = userStoriesPages.some(page => page.id === pageId);
        if (foundInUserStories) {
          return 'userStories';
        }
      } catch (error) {
        // Page not found in user stories database, continue to check epics
      }

      // Then try to get the page from epics database
      try {
        const epicsPages = await this.queryEpicsDatabase();
        const foundInEpics = epicsPages.some(page => page.id === pageId);
        if (foundInEpics) {
          return 'epics';
        }
      } catch (error) {
        // Page not found in epics database either
      }

      // If we can't determine from query, try to get the page directly and check its properties
      const page = await this.getPage(pageId);
      const pageData = await this.extractPageData(page);
      
      // Determine based on page content/fields
      const isEpic = pageData.isEpic === true || 
                    pageData.devStartDate || 
                    pageData.devEndDate || 
                    pageData.owner ||
                    pageData.roadmap ||
                    pageData.vertical ||
                    pageData.issueType === 'Epic';
      
      return isEpic ? 'epics' : 'userStories';
    } catch (error) {
      logger.error('Error determining database from page:', error);
      // Default to user stories if we can't determine
      return 'userStories';
    }
  }

  async updatePage(pageId: string, properties: any): Promise<NotionPage> {
    try {
      // Validate payload before sending to prevent API misinterpretation
      const validatedProperties = this.validateUpdatePayload(properties);
      
      logger.debug(`🔄 Updating Notion page ${pageId} with validated properties:`, JSON.stringify(validatedProperties, null, 2));
      
      const response = await this.client.patch(`/pages/${pageId}`, {
        properties: validatedProperties,
      });
      
      logger.debug(`✅ Successfully updated Notion page ${pageId}`);
      return response.data;
    } catch (error: any) {
      logger.error(`❌ Error updating Notion page ${pageId}:`, error);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}`);
        logger.error(`Response data:`, JSON.stringify(error.response.data, null, 2));
        
        // Check for specific API misinterpretation errors
        if (this.isPayloadMisinterpretationError(error)) {
          logger.error(`🚨 CRITICAL: Notion API may have misinterpreted our payload!`);
          logger.error(`   This could cause property reordering or data corruption.`);
          logger.error(`   Please check the Notion page manually for unexpected changes.`);
        }
      }
      throw error;
    }
  }

  /**
   * Validates update payload to prevent Notion API misinterpretation
   * that could cause property reordering or data corruption
   */
  private validateUpdatePayload(properties: any): any {
    const validated: any = {};
    
    for (const [fieldName, fieldValue] of Object.entries(properties)) {
      // Only include fields that we explicitly want to update
      if (this.isValidFieldUpdate(fieldName, fieldValue)) {
        validated[fieldName] = fieldValue;
      } else {
        logger.warn(`⚠️ Skipping invalid field update: ${fieldName}`);
      }
    }
    
    return validated;
  }

  /**
   * Checks if a field update is safe and won't cause API misinterpretation
   */
  private isValidFieldUpdate(fieldName: string, fieldValue: any): boolean {
    // Reject any updates that could affect property ordering
    if (fieldName.includes('order') || fieldName.includes('position') || fieldName.includes('sort')) {
      logger.warn(`🚫 Rejecting field update that could affect ordering: ${fieldName}`);
      return false;
    }

    // Reject updates to system fields that could cause issues
    const systemFields = ['id', 'created_time', 'last_edited_time', 'parent', 'archived'];
    if (systemFields.includes(fieldName)) {
      logger.warn(`🚫 Rejecting update to system field: ${fieldName}`);
      return false;
    }

    // Validate field value structure
    if (fieldValue && typeof fieldValue === 'object') {
      // Ensure rich_text fields have proper structure
      if (fieldValue.rich_text && Array.isArray(fieldValue.rich_text)) {
        return this.validateRichTextStructure(fieldValue.rich_text);
      }
      
      // Ensure url fields have proper structure
      if (fieldValue.url && typeof fieldValue.url === 'string') {
        return true;
      }
      
      // Ensure select fields have proper structure
      if (fieldValue.select && typeof fieldValue.select === 'object') {
        return fieldValue.select.name && typeof fieldValue.select.name === 'string';
      }
      
      // Ensure status fields have proper structure
      if (fieldValue.status && typeof fieldValue.status === 'object') {
        return fieldValue.status.name && typeof fieldValue.status.name === 'string';
      }
    }

    return true;
  }

  /**
   * Validates rich_text structure to prevent API issues
   */
  private validateRichTextStructure(richText: any[]): boolean {
    if (!Array.isArray(richText)) return false;
    
    for (const textBlock of richText) {
      if (!textBlock.type || !textBlock.text) return false;
      if (textBlock.type !== 'text') return false;
      if (!textBlock.text.content || typeof textBlock.text.content !== 'string') return false;
    }
    
    return true;
  }

  /**
   * Detects if an error indicates payload misinterpretation by Notion API
   */
  private isPayloadMisinterpretationError(error: any): boolean {
    if (!error.response || !error.response.data) return false;
    
    const errorData = error.response.data;
    const errorMessage = JSON.stringify(errorData).toLowerCase();
    
    // Look for signs of API misinterpretation
    const misinterpretationIndicators = [
      'invalid property',
      'property not found',
      'unexpected field',
      'malformed request',
      'field type mismatch',
      'cannot update',
      'read-only property'
    ];
    
    return misinterpretationIndicators.some(indicator => 
      errorMessage.includes(indicator)
    );
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
      
      // Check for common field names that might be rich_text or url
      const possibleFields = ['Jira Epic Link', 'Jira Link', 'Notes', 'Description', 'Comments', 'Details'];
      
      for (const fieldName of possibleFields) {
        if (properties[fieldName] && (properties[fieldName].type === 'rich_text' || properties[fieldName].type === 'url')) {
          targetField = fieldName;
          currentContent = this.extractTextValue(properties[fieldName]) || '';
          logger.debug(`📝 Found suitable field: ${fieldName} (type: ${properties[fieldName].type})`);
          break;
        }
      }
      
      // If no suitable field found, try to find any rich_text or url field
      if (!targetField) {
        for (const [fieldName, field] of Object.entries(properties)) {
          if (field.type === 'rich_text' || field.type === 'url') {
            targetField = fieldName;
            currentContent = this.extractTextValue(field) || '';
            logger.debug(`📝 Using fallback field: ${fieldName} (type: ${field.type})`);
            break;
          }
        }
      }
      
      if (!targetField) {
        logger.warn(`⚠️ No suitable rich_text field found in page ${pageId} to add Jira link`);
        return;
      }
      
      // Validate that the target field exists and is accessible
      if (!this.validateFieldExists(pageId, targetField, properties[targetField])) {
        logger.error(`❌ Target field ${targetField} validation failed - skipping Jira link update`);
        return;
      }
      
      // Check if the target field is a URL field or rich_text field
      const fieldType = page.properties[targetField].type;
      
      if (fieldType === 'url') {
        // For URL fields, just set the URL directly
        await this.updatePage(pageId, {
          [targetField]: {
            url: jiraUrl,
          },
        });
      } else {
        // For rich_text fields, create clickable Jira link using Notion's rich text format
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
      }
      
      logger.info(`✅ Added clickable Jira link to Notion page ${pageId} in field '${targetField}': ${jiraKey}`);
    } catch (error) {
      logger.error(`❌ Error adding Jira link to Notion page ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Validates that a field exists and is safe to update
   */
  private validateFieldExists(pageId: string, fieldName: string, field: any): boolean {
    if (!field) {
      logger.error(`❌ Field ${fieldName} does not exist on page ${pageId}`);
      return false;
    }

    if (!field.type) {
      logger.error(`❌ Field ${fieldName} has no type information`);
      return false;
    }

    // Check if field is in a writable state
    const writableTypes = ['rich_text', 'url', 'select', 'status', 'date', 'number', 'checkbox'];
    if (!writableTypes.includes(field.type)) {
      logger.error(`❌ Field ${fieldName} type ${field.type} is not writable`);
      return false;
    }

    return true;
  }

  async updateJiraLink(pageId: string, jiraKey: string, jiraUrl: string): Promise<void> {
    // This method is for User Stories database
    await this.addJiraLink(pageId, jiraKey, jiraUrl);
  }

  async updateJiraEpicLink(pageId: string, jiraKey: string, jiraUrl: string): Promise<void> {
    // This method is for Epics database
    await this.addJiraLink(pageId, jiraKey, jiraUrl);
  }

  async checkJiraLinkExists(pageId: string): Promise<{ exists: boolean; jiraKey?: string; jiraUrl?: string }> {
    try {
      const page = await this.getPage(pageId);
      
      // First check the Jira Link URL field
      const jiraLinkProperty = page.properties['Jira Link'];
      if (jiraLinkProperty?.type === 'url' && jiraLinkProperty.url) {
        const jiraUrl = jiraLinkProperty.url;
        // Extract Jira key from URL 
        const jiraMatch = jiraUrl.match(/\/browse\/([A-Z]+-\d+)/);
        if (jiraMatch && jiraMatch[1]) {
          const jiraKey = jiraMatch[1];
          
          logger.info(`🔗 EXISTING JIRA LINK FOUND IN URL FIELD:`);
          logger.info(`   📋 Jira Key: ${jiraKey}`);
          logger.info(`   🔗 Jira URL: ${jiraUrl}`);
          logger.info(`   📄 Notion Page: ${pageId}`);
          
          return {
            exists: true,
            jiraKey,
            jiraUrl
          };
        }
      }
      
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
      // Look for complete Jira links with actual keys 
      const jiraMatch = combinedText.match(/🔗 Jira: ([A-Z]+-\d+)(?:\s*-?\s*(https?:\/\/[^\s]+))?/);
      
      if (jiraMatch && jiraMatch[1] && jiraMatch[1].length > 3) {
        const jiraKey = jiraMatch[1];
        const jiraUrl = jiraMatch[2] || `${config.jira.baseUrl}/browse/${jiraKey}`;
        
        logger.info(`🔗 EXISTING JIRA LINK FOUND IN TEXT FIELD:`);
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
    epicLink?: string;
    parentEpic?: string;
    priority?: string;
    dueDate?: string;
    startDate?: string;
    endDate?: string;
    epicKey?: string;
    redDate?: string;
    greenDate?: string;
    blueDate?: string;
    isEpic?: boolean;
    devStartDate?: string;
    devEndDate?: string;
    owner?: string;
    roadmap?: string;
    vertical?: string;
    figmaLink?: string;
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
    
    // Log description extraction for debugging
    if (!description || description.trim() === '') {
      logger.warn(`⚠️ No description found for page ${page.id} - Jira ticket will be created without description`);
    } else {
      logger.info(`✅ Description extracted successfully (${description.length} characters)`);
    }
    
    // Try to extract title from different possible property names
    let title = this.extractTextValue(properties['Name']) || 
                this.extractTextValue(properties['Title']) || 
                this.extractTextValue(properties['Task']) ||
                this.extractTextValue(properties['Ticket']) ||
                this.extractTextValue(properties['Summary']) ||
                '';
    
    logger.debug(`📝 Final extracted title: "${title}"`);
    
    // Extract epic key from relation field
    let epicKey = this.extractTextValue(properties['Epic Key']);
    if (!epicKey) {
      // Try to get epic key from the Initiatives relation
      epicKey = await this.extractEpicKeyFromRelation(properties['🚀 Initiatives']);
    }

    // Extract parent epic key if it exists
    let parentEpic = undefined;
    if (properties['Parent Epic'] || properties['Parent Epic Key']) {
      parentEpic = this.extractTextValue(properties['Parent Epic']) || 
                   this.extractTextValue(properties['Parent Epic Key']);
    }

    // Extract Figma link if it exists
    const figmaLink = this.extractTextValue(properties['Figma Link']) || 
                     this.extractTextValue(properties['Figma']) ||
                     this.extractTextValue(properties['Design Link']);
    
    if (figmaLink) {
      logger.info(`🎨 Figma link extracted: ${figmaLink}`);
    } else {
      logger.debug(`⚠️ No Figma link found in Notion page properties`);
    }

    const extractedData = {
      title: title,
      description: description,
      status: this.extractSelectValue(properties['Status']),
      issueType: 'Story', // Default to Story since no Issue Type property
      storyPoints: this.extractNumberValue(properties['Story Points']),
      epicLink: epicKey,
      parentEpic: parentEpic,
      priority: this.extractSelectValue(properties['Priority']),
      dueDate: this.extractDateValue(properties['Due Date']),
      startDate: this.extractDateValue(properties['Start Date']),
      endDate: this.extractDateValue(properties['End Date']),
      epicKey: epicKey,
      // RGB dates for user stories and epics
      redDate: this.extractDateValue(properties['Red Date']) || this.extractDateValue(properties['Red']),
      greenDate: this.extractDateValue(properties['Green Date']) || this.extractDateValue(properties['Green']),
      blueDate: this.extractDateValue(properties['Blue Date']) || this.extractDateValue(properties['Blue']),
      // Epic-specific fields
      isEpic: this.extractCheckboxValue(properties['Epic']) || this.extractCheckboxValue(properties['Is Epic']),
      devStartDate: this.extractDateValue(properties['Dev Start Date']) || this.extractDateValue(properties['Development Start']),
      devEndDate: this.extractDateValue(properties['Dev End Date']) || this.extractDateValue(properties['Development End']),
      owner: this.extractTextValue(properties['Owner']),
      roadmap: this.extractTextValue(properties['Roadmap']),
      vertical: this.extractTextValue(properties['Vertical']),
      figmaLink: figmaLink,
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
    
    // Handle people type properties (for Requirements Engineer field)
    if (property.type === 'people' && property.people?.[0]) {
      const person = property.people[0];
      if (person.person?.email) {
        const email = person.person.email;
        logger.debug(`Extracted people email: "${email}"`);
        return email;
      }
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

  private extractCheckboxValue(property: any): boolean | undefined {
    if (!property || property.type !== 'checkbox') return undefined;
    return property.checkbox;
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

  async extractEpicKeyFromRelation(relationProperty: any): Promise<string | undefined> {
    if (!relationProperty || relationProperty.type !== 'relation' || !relationProperty.relation) {
      return undefined;
    }

    const relations = relationProperty.relation;
    if (relations.length === 0) {
      return undefined;
    }

    try {
      // Get the first related page (epic)
      const relatedPageId = relations[0].id;
      const relatedPage = await this.getPage(relatedPageId);
      
      // Extract the Jira Epic Link from the related epic page
      const jiraLinkProperty = relatedPage.properties['Jira Epic Link'];
      if (jiraLinkProperty && jiraLinkProperty.type === 'url' && jiraLinkProperty.url) {
        // Extract the Jira key from the URL 
        const urlMatch = jiraLinkProperty.url.match(/\/browse\/([A-Z]+-\d+)/);
        if (urlMatch) {
          logger.debug(`🔗 Extracted epic key from relation: ${urlMatch[1]}`);
          return urlMatch[1];
        }
      }
    } catch (error) {
      logger.error('Error extracting epic key from relation:', error);
    }

    return undefined;
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
