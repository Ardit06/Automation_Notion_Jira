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

  /**
   * Converts Notion rich_text array to markdown with formatting preserved
   */
  private convertRichTextToMarkdown(richText: any[]): string {
    if (!richText || richText.length === 0) return '';
    
    return richText.map((textItem: any) => {
      let text = textItem.plain_text || '';
      const annotations = textItem.annotations || {};
      const link = textItem.href;
      
      // Apply formatting in order: code, bold, italic, strikethrough
      if (annotations.code) {
        text = `\`${text}\``;
      }
      if (annotations.bold) {
        text = `**${text}**`;
      }
      if (annotations.italic) {
        text = `*${text}*`;
      }
      if (annotations.strikethrough) {
        text = `~~${text}~~`;
      }
      
      // Add link if present
      if (link) {
        text = `[${text}](${link})`;
      }
      
      return text;
    }).join('');
  }

  async getPageContent(pageId: string): Promise<string> {
    try {
      // Use recursive function to get all blocks including nested ones
      const allBlocks = await this.getAllBlocksRecursive(pageId);
      
      logger.debug(`📄 Fetching page content for ${pageId}: found ${allBlocks.length} blocks (including nested)`);
      
      // Extract comprehensive text content from blocks
      let content = '';
      let listCounter = 1;
      
      for (const block of allBlocks) {
        switch (block.type) {
          case 'paragraph':
            if (block.paragraph?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.paragraph.rich_text);
              if (text.trim()) {
                content += text + '\n\n';
              }
            }
            break;
            
          case 'bulleted_list_item':
            if (block.bulleted_list_item?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.bulleted_list_item.rich_text);
              content += '• ' + text + '\n';
            }
            break;
            
          case 'numbered_list_item':
            if (block.numbered_list_item?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.numbered_list_item.rich_text);
              content += `${listCounter}. ` + text + '\n';
              listCounter++;
            }
            break;
            
          case 'heading_1':
            if (block.heading_1?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.heading_1.rich_text);
              content += `# ${text}\n\n`;
            }
            break;
            
          case 'heading_2':
            if (block.heading_2?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.heading_2.rich_text);
              content += `## ${text}\n\n`;
            }
            break;
            
          case 'heading_3':
            if (block.heading_3?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.heading_3.rich_text);
              content += `### ${text}\n\n`;
            }
            break;
            
          case 'heading_4':
            if (block.heading_4?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.heading_4.rich_text);
              content += `#### ${text}\n\n`;
            }
            break;
            
          case 'heading_5':
            if (block.heading_5?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.heading_5.rich_text);
              content += `##### ${text}\n\n`;
            }
            break;
            
          case 'heading_6':
            if (block.heading_6?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.heading_6.rich_text);
              content += `###### ${text}\n\n`;
            }
            break;
            
          case 'quote':
            if (block.quote?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.quote.rich_text);
              content += `> ${text}\n\n`;
            }
            break;
            
          case 'code':
            if (block.code?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.code.rich_text);
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
              const text = this.convertRichTextToMarkdown(block.callout.rich_text);
              const icon = block.callout.icon?.emoji || '💡';
              content += `${icon} ${text}\n\n`;
            }
            break;
            
          case 'toggle':
            if (block.toggle?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.toggle.rich_text);
              content += `▶ ${text}\n\n`;
            }
            break;
            
          case 'divider':
            content += '---\n\n';
            break;
            
          case 'to_do':
            if (block.to_do?.rich_text) {
              const text = this.convertRichTextToMarkdown(block.to_do.rich_text);
              const checked = block.to_do.checked ? '☑' : '☐';
              content += `${checked} ${text}\n`;
            }
            break;
            
          case 'image':
            try {
              const imageUrl = block.image?.file?.url || block.image?.external?.url || '';
              const caption = block.image?.caption ? this.convertRichTextToMarkdown(block.image.caption) : '';
              if (imageUrl) {
                content += `![${caption || 'Image'}](${imageUrl})\n\n`;
              }
            } catch (error) {
              logger.warn(`⚠️ Could not extract image:`, error);
            }
            break;
            
          case 'video':
            try {
              const videoUrl = block.video?.file?.url || block.video?.external?.url || '';
              const caption = block.video?.caption ? this.convertRichTextToMarkdown(block.video.caption) : '';
              if (videoUrl) {
                content += `📹 [Video: ${caption || 'Video'}](${videoUrl})\n\n`;
              }
            } catch (error) {
              logger.warn(`⚠️ Could not extract video:`, error);
            }
            break;
            
          case 'file':
            try {
              const fileUrl = block.file?.file?.url || block.file?.external?.url || '';
              const fileName = block.file?.name || 'File';
              if (fileUrl) {
                content += `📎 [${fileName}](${fileUrl})\n\n`;
              }
            } catch (error) {
              logger.warn(`⚠️ Could not extract file:`, error);
            }
            break;
            
          case 'pdf':
            try {
              const pdfUrl = block.pdf?.file?.url || block.pdf?.external?.url || '';
              const caption = block.pdf?.caption ? this.convertRichTextToMarkdown(block.pdf.caption) : '';
              if (pdfUrl) {
                content += `📄 [PDF: ${caption || 'PDF'}](${pdfUrl})\n\n`;
              }
            } catch (error) {
              logger.warn(`⚠️ Could not extract PDF:`, error);
            }
            break;
            
          case 'bookmark':
            try {
              const bookmarkUrl = block.bookmark?.url || '';
              const caption = block.bookmark?.caption ? this.convertRichTextToMarkdown(block.bookmark.caption) : '';
              if (bookmarkUrl) {
                content += `🔖 [${caption || bookmarkUrl}](${bookmarkUrl})\n\n`;
              }
            } catch (error) {
              logger.warn(`⚠️ Could not extract bookmark:`, error);
            }
            break;
            
          case 'embed':
            try {
              const embedUrl = block.embed?.url || '';
              const caption = block.embed?.caption ? this.convertRichTextToMarkdown(block.embed.caption) : '';
              if (embedUrl) {
                content += `🔗 [Embed: ${caption || embedUrl}](${embedUrl})\n\n`;
              }
            } catch (error) {
              logger.warn(`⚠️ Could not extract embed:`, error);
            }
            break;
            
          case 'link_preview':
            try {
              const previewUrl = block.link_preview?.url || '';
              if (previewUrl) {
                content += `🔗 [Link Preview](${previewUrl})\n\n`;
              }
            } catch (error) {
              logger.warn(`⚠️ Could not extract link preview:`, error);
            }
            break;
            
          case 'link_to_page':
            try {
              const linkedPageId = block.link_to_page?.page_id || '';
              if (linkedPageId) {
                const linkedPageUrl = `https://www.notion.so/${linkedPageId.replace(/-/g, '')}`;
                content += `🔗 [Linked Page](${linkedPageUrl})\n\n`;
              }
            } catch (error) {
              logger.warn(`⚠️ Could not extract link to page:`, error);
            }
            break;
            
          case 'equation':
            try {
              const expression = block.equation?.expression || '';
              if (expression) {
                content += `\`\`\`\n$${expression}$\n\`\`\`\n\n`;
              }
            } catch (error) {
              logger.warn(`⚠️ Could not extract equation:`, error);
            }
            break;
            
          case 'child_database':
            // Extract child database as a table
            try {
              // For child_database blocks, we need to get the actual database ID from the block
              const databaseId = block.child_database?.database_id || block.id;
              logger.debug(`📊 Found child database block:`, {
                blockId: block.id,
                databaseId: databaseId,
                blockType: block.type,
                hasTitle: !!block.child_database?.title
              });
              const tableContent = await this.extractDatabaseAsTable(databaseId);
              if (tableContent) {
                content += tableContent + '\n\n';
              }
            } catch (error: any) {
              logger.warn(`⚠️ Could not extract child database (${block.id}):`, {
                error: error.message,
                code: error.code,
                status: error.status
              });
            }
            break;
            
          case 'table':
            // Extract table content
            try {
              logger.debug(`📊 Found table block: ${block.id}`);
              const tableText = await this.extractTableBlock(block.id);
              if (tableText) {
                content += tableText + '\n\n';
              }
            } catch (error) {
              logger.warn(`⚠️ Could not extract table:`, error);
            }
            break;
            
          default:
            // For any other block types, try to extract text if available
            if (block[block.type]?.rich_text) {
              const text = this.convertRichTextToMarkdown(block[block.type].rich_text);
              if (text.trim()) {
                content += text + '\n';
              }
            } else {
              // Log unsupported block type for debugging
              logger.debug(`⚠️ Unsupported block type: ${block.type}`);
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

  /**
   * Recursively fetch all blocks including nested children
   */
  private async getAllBlocksRecursive(blockId: string, allBlocks: any[] = []): Promise<any[]> {
    try {
      let hasMore = true;
      let startCursor: string | undefined = undefined;
      
      while (hasMore) {
        const params: any = { page_size: 100 };
        if (startCursor) {
          params.start_cursor = startCursor;
        }
        
        const response = await this.client.get(`/blocks/${blockId}/children`, { params });
        const blocks = response.data.results;
        const nextCursor = response.data.next_cursor;
        
        // Process each block and recursively get its children
        for (const block of blocks) {
          allBlocks.push(block);
          
          // Check if block has children (nested blocks)
          if (block.has_children) {
            // Recursively get children blocks
            await this.getAllBlocksRecursive(block.id, allBlocks);
          }
        }
        
        hasMore = !!nextCursor;
        startCursor = nextCursor;
      }
      
      return allBlocks;
    } catch (error) {
      logger.error(`Error fetching blocks recursively for ${blockId}:`, error);
      return allBlocks; // Return what we have so far
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
      const allPages: NotionPage[] = [];
      let hasMore = true;
      let startCursor: string | undefined = undefined;
      
      while (hasMore) {
        const params: any = {
          page_size: 100,
        };
        
        if (filter) {
          params.filter = filter;
        }
        
        if (startCursor) {
          params.start_cursor = startCursor;
        }
        
        const response = await this.client.post(`/databases/${databaseId}/query`, params);
        const results = response.data.results || [];
        allPages.push(...results);
        
        hasMore = response.data.has_more || false;
        startCursor = response.data.next_cursor;
        
        logger.debug(`📊 Fetched ${results.length} pages (total: ${allPages.length}, has_more: ${hasMore})`);
      }
      
      logger.info(`✅ Query completed: Retrieved ${allPages.length} total pages from database`);
      return allPages;
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
      // Normalize page ID format (handle both with and without hyphens)
      const normalizePageId = (id: string): string => {
        // Remove hyphens and convert to standard format
        const cleanId = id.replace(/-/g, '');
        if (cleanId.length === 32) {
          // Format with hyphens: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
          return `${cleanId.substring(0, 8)}-${cleanId.substring(8, 12)}-${cleanId.substring(12, 16)}-${cleanId.substring(16, 20)}-${cleanId.substring(20, 32)}`;
        }
        return id;
      };
      
      const normalizedPageId = normalizePageId(pageId);
      logger.debug(`🔍 Normalized page ID: "${pageId}" → "${normalizedPageId}"`);
      
      // First try to get the page from user stories database
      try {
        logger.debug(`🔍 Checking User Stories database for page: ${normalizedPageId}`);
        const userStoriesPages = await this.queryUserStoriesDatabase();
        const foundInUserStories = userStoriesPages.some(page => {
          const pageIdNormalized = normalizePageId(page.id);
          return pageIdNormalized === normalizedPageId || page.id === normalizedPageId || page.id === pageId;
        });
        if (foundInUserStories) {
          logger.info(`✅ Page found in User Stories database`);
          return 'userStories';
        }
        logger.debug(`❌ Page not found in User Stories database (checked ${userStoriesPages.length} pages)`);
      } catch (error) {
        logger.warn(`⚠️ Error checking User Stories database:`, error);
        // Page not found in user stories database, continue to check epics
      }

      // Then try to get the page from epics database
      try {
        logger.debug(`🔍 Checking Epics database for page: ${normalizedPageId}`);
        const epicsPages = await this.queryEpicsDatabase();
        logger.info(`📊 Epics database contains ${epicsPages.length} pages`);
        const foundInEpics = epicsPages.some(page => {
          const pageIdNormalized = normalizePageId(page.id);
          return pageIdNormalized === normalizedPageId || page.id === normalizedPageId || page.id === pageId;
        });
        if (foundInEpics) {
          logger.info(`✅ Page found in Epics database`);
          return 'epics';
        }
        logger.debug(`❌ Page not found in Epics database (checked ${epicsPages.length} pages)`);
      } catch (error) {
        logger.warn(`⚠️ Error checking Epics database:`, error);
        // Page not found in epics database either
      }

      // If we can't determine from query, try to get the page directly and check its properties
      logger.info(`🔍 Page not found in database queries, fetching page directly to determine type...`);
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
      
      logger.info(`🔍 Determined database type from page properties: ${isEpic ? 'epics' : 'userStories'}`);
      logger.info(`   isEpic: ${pageData.isEpic}, devStartDate: ${pageData.devStartDate}, owner: ${pageData.owner}`);
      
      return isEpic ? 'epics' : 'userStories';
    } catch (error) {
      logger.error('Error determining database from page:', error);
      // Default to user stories if we can't determine
      logger.warn(`⚠️ Defaulting to 'userStories' database type`);
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
      
      // Check multiple possible Jira link field names
      const possibleJiraFields = ['Jira Link', 'Jira Epic Link', 'Jira Story Link', 'Jira Issue Link', 'Jira'];
      
      for (const fieldName of possibleJiraFields) {
        const jiraLinkProperty = page.properties[fieldName];
        if (jiraLinkProperty?.type === 'url' && jiraLinkProperty.url) {
          const jiraUrl = jiraLinkProperty.url;
          // Extract Jira key from URL 
          const jiraMatch = jiraUrl.match(/\/browse\/([A-Z]+-\d+)/);
          if (jiraMatch && jiraMatch[1]) {
            const jiraKey = jiraMatch[1];
            
            logger.info(`🔗 EXISTING JIRA LINK FOUND:`);
            logger.info(`   📋 Jira Key: ${jiraKey}`);
            logger.info(`   🔗 Jira URL: ${jiraUrl}`);
            logger.info(`   📄 Notion Page: ${pageId}`);
            logger.info(`   📝 Field Name: "${fieldName}"`);
            
            return {
              exists: true,
              jiraKey,
              jiraUrl
            };
          }
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
    
    // Always try to get full page content - combine property-based description with page body content
    let description = '';
    
    // First, try to get description from Description or Notes properties
    const propertyDescription = this.extractTextValue(properties['Description']) || 
                               this.extractTextValue(properties['Notes']);
    
    // Always fetch page content to get the full content as it appears in Notion
    logger.debug(`📄 Fetching full page content from blocks...`);
    const pageContent = await this.getPageContent(page.id);
    
    // Combine property description with page content
    if (propertyDescription && pageContent) {
      // If both exist, combine them with a separator
      description = `${propertyDescription}\n\n---\n\n${pageContent}`;
    } else if (propertyDescription) {
      description = propertyDescription;
    } else if (pageContent) {
      description = pageContent;
    }
    
    // Log description extraction for debugging
    if (!description || description.trim() === '') {
      logger.warn(`⚠️ No description found for page ${page.id} - Jira ticket will be created without description`);
    } else {
      logger.info(`✅ Description extracted successfully (${description.length} characters)`);
      if (propertyDescription) {
        logger.debug(`   📝 From properties: ${propertyDescription.length} characters`);
      }
      if (pageContent) {
        logger.debug(`   📄 From page content: ${pageContent.length} characters`);
      }
    }
    
    // Try to extract title from different possible property names
    let title = this.extractTextValue(properties['Name']) || 
                this.extractTextValue(properties['Title']) || 
                this.extractTextValue(properties['Task']) ||
                this.extractTextValue(properties['Ticket']) ||
                this.extractTextValue(properties['Summary']) ||
                '';
    
    logger.debug(`📝 Final extracted title: "${title}"`);
    
    // Extract epic key from various possible fields
    let epicKey = this.extractTextValue(properties['Epic Key']) ||
                  this.extractTextValue(properties['Epic Link']) ||
                  this.extractTextValue(properties['Epic']);
    
    if (!epicKey) {
      // Try to get epic key from the Initiatives relation
      epicKey = await this.extractEpicKeyFromRelation(properties['🚀 Initiatives']);
    }

    // Extract parent epic key if it exists (check multiple field names)
    let parentEpic = undefined;
    
    // Check for Parent Epic field - handle both relation and text/url types
    if (properties['Parent Epic']) {
      const parentEpicProp = properties['Parent Epic'];
      if (parentEpicProp.type === 'relation') {
        // Handle relation type - extract epic key from related page
        logger.debug(`🔗 Parent Epic is a relation field, extracting epic key from related page...`);
        parentEpic = await this.extractEpicKeyFromRelation(parentEpicProp);
        if (parentEpic) {
          logger.info(`✅ Extracted parent epic key from relation: ${parentEpic}`);
        }
      } else {
        // Handle text/url types
        parentEpic = this.extractTextValue(parentEpicProp);
      }
    }
    
    // Fallback to other field names if Parent Epic not found
    if (!parentEpic) {
      if (properties['Parent Epic Key']) {
        const parentEpicKeyProp = properties['Parent Epic Key'];
        if (parentEpicKeyProp.type === 'relation') {
          parentEpic = await this.extractEpicKeyFromRelation(parentEpicKeyProp);
        } else {
          parentEpic = this.extractTextValue(parentEpicKeyProp);
        }
      }
    }
    
    if (!parentEpic) {
      if (properties['Epic Link']) {
        const epicLinkProp = properties['Epic Link'];
        if (epicLinkProp.type === 'relation') {
          parentEpic = await this.extractEpicKeyFromRelation(epicLinkProp);
        } else {
          parentEpic = this.extractTextValue(epicLinkProp);
        }
      }
    }
    
    if (!parentEpic) {
      if (properties['Epic']) {
        const epicProp = properties['Epic'];
        if (epicProp.type === 'relation') {
          parentEpic = await this.extractEpicKeyFromRelation(epicProp);
        } else {
          parentEpic = this.extractTextValue(epicProp);
        }
      }
    }
    
    // If parentEpic is not set but epicKey is, use epicKey as parentEpic
    if (!parentEpic && epicKey) {
      parentEpic = epicKey;
      logger.info(`📝 Using epicKey (${epicKey}) as parentEpic since Parent Epic field not found`);
    }

    // Extract Figma link if it exists - check multiple possible field names
    // Try each property name and log which one works
    let figmaLink: string | undefined = undefined;
    const figmaPropertyNames = ['Figma Link', 'Figma', 'Design Link', 'Design reference', 'Design Reference', 'Figma Design Link'];
    
    for (const propName of figmaPropertyNames) {
      const prop = properties[propName];
      if (prop) {
        logger.debug(`🔍 Checking Figma property "${propName}": type=${prop.type}, value=${prop.url || prop.rich_text?.[0]?.text?.content || 'N/A'}`);
        
        // Handle URL type properties directly
        let extracted: string | undefined = undefined;
        if (prop.type === 'url' && prop.url) {
          extracted = prop.url.trim();
          logger.debug(`✅ Found URL property "${propName}": ${extracted}`);
        } else if (prop.type === 'rich_text' && prop.rich_text) {
          // Handle rich_text fields - extract links from rich text
          for (const textItem of prop.rich_text) {
            // Check if this text item has a link
            if (textItem.href) {
              extracted = textItem.href.trim();
              logger.debug(`✅ Found link in rich_text property "${propName}": ${extracted}`);
              break;
            }
            // Also check plain_text for URL patterns
            if (textItem.plain_text && (textItem.plain_text.startsWith('http://') || textItem.plain_text.startsWith('https://'))) {
              extracted = textItem.plain_text.trim();
              logger.debug(`✅ Found URL in plain_text of "${propName}": ${extracted}`);
              break;
            }
          }
          // If no link found in rich_text, try extractTextValue as fallback
          if (!extracted) {
            extracted = this.extractTextValue(prop);
          }
        } else {
          // Try extractTextValue for other types
          extracted = this.extractTextValue(prop);
        }
        
        if (extracted && extracted.trim()) {
          // Validate that it's a valid URL
          const trimmedLink = extracted.trim();
          if (trimmedLink.startsWith('http://') || trimmedLink.startsWith('https://')) {
            figmaLink = trimmedLink;
            logger.info(`🎨 Figma link extracted from "${propName}": ${figmaLink}`);
            break;
          } else {
            logger.debug(`⚠️ Property "${propName}" contains text but not a valid URL: "${trimmedLink}"`);
          }
        } else if (prop) {
          logger.debug(`⚠️ Property "${propName}" exists but has no valid value (type: ${prop.type})`);
        }
      }
    }
    
    // Only log if we actually checked properties but didn't find one
    // Don't log if the property simply doesn't exist (which is normal)
    if (!figmaLink) {
      logger.debug(`ℹ️ No Figma link found in Notion page (this is normal if the field is empty or doesn't exist)`);
    }

    // Extract status with detailed logging - check multiple possible field names
    let statusProperty = properties['Status'] || properties['status'] || properties['State'] || properties['state'];
    
    // If Status field not found, log all available properties for debugging
    if (!statusProperty) {
      logger.warn(`⚠️ Status field not found. Available properties: ${Object.keys(properties).join(', ')}`);
      // Try to find any property that might be a status field
      for (const [key, value] of Object.entries(properties)) {
        if (value && (value as any).type === 'status' || (value as any).type === 'select') {
          logger.info(`💡 Found potential status field: "${key}" (type: ${(value as any).type})`);
          statusProperty = value as any;
          break;
        }
      }
    }
    
    logger.debug(`📊 Extracting Status field:`, JSON.stringify(statusProperty, null, 2));
    const extractedStatus = this.extractSelectValue(statusProperty);
    
    // Normalize status - trim whitespace and handle common variations
    let normalizedStatus = extractedStatus;
    if (normalizedStatus) {
      normalizedStatus = normalizedStatus.trim();
      // Handle common status name variations
      const statusVariations: { [key: string]: string } = {
        'ready for dev': 'Ready For Dev',
        'ready-for-dev': 'Ready For Dev',
        'ready_for_dev': 'Ready For Dev',
        'approved': 'Approved',
        'approve': 'Approved',
      };
      const lowerStatus = normalizedStatus.toLowerCase();
      if (statusVariations[lowerStatus]) {
        normalizedStatus = statusVariations[lowerStatus];
        logger.debug(`🔄 Normalized status from "${extractedStatus}" to "${normalizedStatus}"`);
      }
    }
    
    logger.info(`✅ Extracted Status: "${normalizedStatus || 'undefined'}" (from property type: ${statusProperty?.type || 'unknown'})`);
    
    // Extract Priority - check multiple possible field names
    let priority: string | undefined = undefined;
    const priorityPropertyNames = ['Priority', 'priority', 'Importance', 'importance', 'Urgency', 'urgency'];
    
    for (const propName of priorityPropertyNames) {
      const prop = properties[propName];
      if (prop) {
        logger.debug(`🔍 Checking Priority property "${propName}": type=${prop.type}`);
        const extracted = this.extractSelectValue(prop);
        if (extracted) {
          priority = extracted;
          logger.info(`⚡ Priority extracted from "${propName}": ${priority}`);
          break;
        }
      }
    }
    
    if (!priority) {
      logger.debug(`ℹ️ No Priority field found in Notion page (this is normal if the field is empty or doesn't exist)`);
    }
    
    const extractedData = {
      title: title,
      description: description,
      status: normalizedStatus,
      issueType: 'Story', // Default to Story since no Issue Type property
      storyPoints: this.extractNumberValue(properties['Story Points']),
      epicLink: epicKey,
      parentEpic: parentEpic,
      priority: priority,
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
    if (!property) {
      logger.debug('extractSelectValue: property is null or undefined');
      return undefined;
    }
    
    logger.debug(`extractSelectValue: property type is "${property.type}"`);
    
    // Handle select properties
    if (property.type === 'select') {
      const value = property.select?.name;
      logger.debug(`extractSelectValue: extracted select value: "${value}"`);
      return value;
    }
    
    // Handle status properties
    if (property.type === 'status') {
      const value = property.status?.name;
      logger.debug(`extractSelectValue: extracted status value: "${value}"`);
      return value;
    }
    
    logger.debug(`extractSelectValue: property type "${property.type}" is not select or status`);
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
      
      // Check multiple possible field names for Jira Epic Link
      const possibleJiraLinkFields = ['Jira Epic Link', 'Jira Link', 'Jira Story Link', 'Jira Issue Link', 'Jira'];
      
      for (const fieldName of possibleJiraLinkFields) {
        const jiraLinkProperty = relatedPage.properties[fieldName];
        if (jiraLinkProperty) {
          // Check if it's a URL type field
          if (jiraLinkProperty.type === 'url' && jiraLinkProperty.url) {
            // Extract the Jira key from the URL 
            const urlMatch = jiraLinkProperty.url.match(/\/browse\/([A-Z]+-\d+)/);
            if (urlMatch) {
              logger.debug(`🔗 Extracted epic key from relation field "${fieldName}": ${urlMatch[1]}`);
              return urlMatch[1];
            }
          }
          // Also check rich_text fields for Jira links
          if (jiraLinkProperty.type === 'rich_text' && jiraLinkProperty.rich_text) {
            // Look for Jira links in rich text
            for (const textItem of jiraLinkProperty.rich_text) {
              if (textItem.href) {
                const urlMatch = textItem.href.match(/\/browse\/([A-Z]+-\d+)/);
                if (urlMatch) {
                  logger.debug(`🔗 Extracted epic key from relation rich_text field "${fieldName}": ${urlMatch[1]}`);
                  return urlMatch[1];
                }
              }
              // Also check plain_text for Jira key patterns
              if (textItem.plain_text) {
                const keyMatch = textItem.plain_text.match(/([A-Z]+-\d+)/);
                if (keyMatch) {
                  logger.debug(`🔗 Extracted epic key from relation plain_text field "${fieldName}": ${keyMatch[1]}`);
                  return keyMatch[1];
                }
              }
            }
          }
        }
      }
      
      // Fallback: Check if the page title contains a Jira key pattern
      const titleProperty = relatedPage.properties['Name'] || relatedPage.properties['Title'];
      if (titleProperty) {
        const title = this.extractTextValue(titleProperty);
        if (title) {
          const keyMatch = title.match(/([A-Z]+-\d+)/);
          if (keyMatch) {
            logger.debug(`🔗 Extracted epic key from relation page title: ${keyMatch[1]}`);
            return keyMatch[1];
          }
        }
      }
    } catch (error) {
      logger.error('Error extracting epic key from relation:', error);
    }

    return undefined;
  }

  /**
   * Extract a Notion child database and format it as a markdown table
   */
  private async extractDatabaseAsTable(databaseId: string): Promise<string> {
    try {
      // Get database metadata to understand the schema
      const database = await this.getDatabase(databaseId);
      const databaseTitle = (Array.isArray(database.title) && database.title[0]?.plain_text) 
        ? database.title[0].plain_text 
        : 'Table';
      
      logger.debug(`📊 Extracting database: ${databaseTitle}`);
      
      // Query the database to get all rows
      const rows = await this.queryDatabase(databaseId);
      
      if (rows.length === 0) {
        logger.debug(`⚠️ Database ${databaseTitle} is empty`);
        return `**${databaseTitle}** (empty table)`;
      }
      
      // Get column headers from the database schema
      const properties = database.properties;
      const columnNames = Object.keys(properties).filter(key => {
        // Filter out some internal properties if needed
        return !['Created time', 'Last edited time', 'Created by', 'Last edited by'].includes(key);
      });
      
      if (columnNames.length === 0) {
        return '';
      }
      
      // Build markdown table
      let tableContent = `**${databaseTitle}**\n\n`;
      
      // Header row
      tableContent += '| ' + columnNames.join(' | ') + ' |\n';
      tableContent += '| ' + columnNames.map(() => '---').join(' | ') + ' |\n';
      
      // Data rows
      for (const row of rows) {
        const rowValues = columnNames.map(colName => {
          const prop = row.properties[colName];
          return this.extractPropertyValue(prop) || '';
        });
        tableContent += '| ' + rowValues.join(' | ') + ' |\n';
      }
      
      logger.debug(`✅ Extracted ${rows.length} rows from database ${databaseTitle}`);
      return tableContent;
      
    } catch (error: any) {
      logger.error(`Error extracting database as table (${databaseId}):`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      // If we can't extract the database, return a placeholder
      return `\n_[Linked Database - could not extract content]_\n\n`;
    }
  }

  /**
   * Extract a Notion table block and format it as markdown
   */
  private async extractTableBlock(tableBlockId: string): Promise<string> {
    try {
      // Get table rows (children of the table block)
      const response = await this.client.get(`/blocks/${tableBlockId}/children`);
      const rows = response.data.results;
      
      if (rows.length === 0) {
        return '';
      }
      
      let tableContent = '';
      let isFirstRow = true;
      
      for (const row of rows) {
        if (row.type === 'table_row' && row.table_row?.cells) {
          const cells = row.table_row.cells;
          const cellTexts = cells.map((cell: any[]) => {
            // Convert rich_text in cells to markdown with formatting preserved
            return this.convertRichTextToMarkdown(cell);
          });
          
          tableContent += '| ' + cellTexts.join(' | ') + ' |\n';
          
          // Add separator after first row (header)
          if (isFirstRow) {
            tableContent += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
            isFirstRow = false;
          }
        }
      }
      
      logger.debug(`✅ Extracted table with ${rows.length} rows`);
      return tableContent;
      
    } catch (error) {
      logger.error(`Error extracting table block:`, error);
      return '';
    }
  }

  /**
   * Extract value from a Notion property (used for database tables)
   */
  private extractPropertyValue(property: any): string {
    if (!property) return '';
    
    switch (property.type) {
      case 'title':
        return property.title ? this.convertRichTextToMarkdown(property.title) : '';
      case 'rich_text':
        return property.rich_text ? this.convertRichTextToMarkdown(property.rich_text) : '';
      case 'number':
        return property.number?.toString() || '';
      case 'select':
        return property.select?.name || '';
      case 'multi_select':
        return property.multi_select?.map((s: any) => s.name).join(', ') || '';
      case 'date':
        if (property.date?.start) {
          return property.date.end 
            ? `${property.date.start} to ${property.date.end}` 
            : property.date.start;
        }
        return '';
      case 'checkbox':
        return property.checkbox ? '☑' : '☐';
      case 'url':
        return property.url || '';
      case 'email':
        return property.email || '';
      case 'phone_number':
        return property.phone_number || '';
      case 'people':
        return property.people?.map((p: any) => p.name).join(', ') || '';
      case 'files':
        return property.files?.map((f: any) => f.name).join(', ') || '';
      case 'relation':
        return property.relation?.length > 0 ? `${property.relation.length} linked` : '';
      case 'formula':
        // Handle formula results based on their type
        if (property.formula?.type === 'string') {
          return property.formula.string || '';
        } else if (property.formula?.type === 'number') {
          return property.formula.number?.toString() || '';
        }
        return '';
      case 'status':
        return property.status?.name || '';
      default:
        return '';
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
