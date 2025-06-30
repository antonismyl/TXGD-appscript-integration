/**
 * Transifex-Google Drive Integration
 * 
 * A Google Apps Script integration that provides bidirectional sync between
 * Google Drive files (DOCX/XLSX) and Transifex translation projects.
 * 
 * Features:
 * - Web-based configuration interface
 * - Automatic file monitoring and upload
 * - Webhook-driven translation downloads
 * - Real-time status updates
 */

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

/**
 * Initialize default configuration if none exists
 */
function initializeConfig() {
  const config = getConfig();
  if (!config.settings) {
    const defaultConfig = {
      settings: {
        apiToken: '',
        webhookSecret: '',
        checkInterval: 10,
        webhookUrl: getWebhookUrl()
      },
      folders: [],
      fileMappings: []
    };
    saveConfig(defaultConfig);
    Logger.log('Default configuration initialized');
  }
  return config;
}

/**
 * Get configuration from PropertiesService
 * @return {Object} Configuration object
 */
function getConfig() {
  try {
    const configStr = PropertiesService.getScriptProperties().getProperty('CONFIG');
    return configStr ? JSON.parse(configStr) : {};
  } catch (error) {
    Logger.log('Error getting config: ' + error.message);
    return {};
  }
}

/**
 * Save configuration to PropertiesService
 * @param {Object} config - Configuration object to save
 */
function saveConfig(config) {
  try {
    PropertiesService.getScriptProperties().setProperty('CONFIG', JSON.stringify(config));
    Logger.log('Configuration saved successfully');
  } catch (error) {
    Logger.log('Error saving config: ' + error.message);
    throw error;
  }
}

/**
 * Update specific configuration section
 * @param {string} section - Configuration section (settings, folders, fileMappings)
 * @param {Object} data - Data to update
 */
function updateConfigSection(section, data) {
  const config = getConfig();
  config[section] = data;
  saveConfig(config);
}

/**
 * Get webhook URL for this deployment
 * @return {string} Webhook URL
 */
function getWebhookUrl() {
  try {
    const url = ScriptApp.getService().getUrl();
    return url;
  } catch (error) {
    Logger.log('Error getting webhook URL: ' + error.message);
    return 'Deploy as web app to get webhook URL';
  }
}

// ============================================================================
// WEB APP FUNCTIONS
// ============================================================================

/**
 * Handle GET requests - serve the web interface
 * @param {Object} e - Event object
 * @return {HtmlOutput} HTML output for the web app
 */
function doGet(e) {
  try {
    // Initialize config if needed
    initializeConfig();
    
    const template = HtmlService.createTemplateFromFile('index');
    template.config = getConfig();
    
    return template.evaluate()
      .setTitle('Transifex-Google Drive Integration')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    Logger.log('Error in doGet: ' + error.message);
    return HtmlService.createHtmlOutput('<h1>Error loading application</h1><p>' + error.message + '</p>');
  }
}

/**
 * Handle POST requests - webhook endpoint
 * @param {Object} e - Event object containing webhook data
 * @return {TextOutput} Response to webhook
 */
function doPost(e) {
  try {
    Logger.log('Webhook received: ' + JSON.stringify(e.postData, null, 2));
    
    if (!e.postData || !e.postData.contents) {
      return ContentService.createTextOutput('No data received').setMimeType(ContentService.MimeType.TEXT);
    }
    
    const payload = JSON.parse(e.postData.contents);
    Logger.log('Webhook payload: ' + JSON.stringify(payload, null, 2));
    
    // Verify webhook signature if secret is configured
    const config = getConfig();
    if (config.settings && config.settings.webhookSecret) {
      const isValid = verifyWebhookSignature(e, config.settings.webhookSecret);
      if (!isValid) {
        Logger.log('Invalid webhook signature');
        return ContentService.createTextOutput('Invalid signature').setMimeType(ContentService.MimeType.TEXT);
      }
    }
    
    // Process webhook event
    handleWebhookEvent(payload);
    
    return ContentService.createTextOutput('Webhook processed successfully').setMimeType(ContentService.MimeType.TEXT);
    
  } catch (error) {
    Logger.log('Webhook error: ' + error.message);
    Logger.log('Error stack: ' + error.stack);
    return ContentService.createTextOutput('Error processing webhook: ' + error.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Include HTML files in templates
 * @param {string} filename - Name of file to include
 * @return {string} File contents
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================================
// WEBHOOK HANDLING
// ============================================================================

/**
 * Verify webhook signature for security
 * @param {Object} e - Event object from webhook
 * @param {string} secret - Webhook secret
 * @return {boolean} True if signature is valid
 */
function verifyWebhookSignature(e, secret) {
  try {
    const receivedSignature = e.parameter['X-TX-Signature-V2'] || 
                            (e.postData.headers && e.postData.headers['X-TX-Signature-V2']);
    const httpUrl = e.parameter['X-TX-Url'] || 
                   (e.postData.headers && e.postData.headers['X-TX-Url']);
    const httpDate = e.parameter['Date'] || 
                    (e.postData.headers && e.postData.headers['Date']);
    
    if (!receivedSignature || !httpUrl || !httpDate) {
      Logger.log('Missing webhook signature headers');
      return false;
    }
    
    const content = e.postData.contents;
    const contentMd5 = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, content)
      .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
      .join('');
    
    const message = ['POST', httpUrl, httpDate, contentMd5].join('\n');
    const signature = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(message, secret)
    );
    
    return signature === receivedSignature;
  } catch (error) {
    Logger.log('Signature verification error: ' + error.message);
    return false;
  }
}

/**
 * Handle incoming webhook events
 * @param {Object} payload - Webhook payload
 */
function handleWebhookEvent(payload) {
  try {
    Logger.log(`Processing webhook event: ${payload.event} for language: ${payload.language}`);
    
    switch (payload.event) {
      case 'translation_completed':
        handleTranslationCompleted(payload);
        break;
      case 'review_completed':
        handleReviewCompleted(payload);
        break;
      case 'proofread_completed':
        handleProofreadCompleted(payload);
        break;
      case 'translation_completed_updated':
        handleTranslationUpdated(payload);
        break;
      default:
        Logger.log('Unhandled webhook event: ' + payload.event);
    }
    
    // Log activity
    logActivity(`Webhook: ${payload.event} - ${payload.language} - ${payload.resource}`);
    
  } catch (error) {
    Logger.log('Error handling webhook event: ' + error.message);
    logActivity(`Webhook Error: ${error.message}`);
  }
}

/**
 * Handle translation completed webhook
 * @param {Object} payload - Webhook payload
 */
function handleTranslationCompleted(payload) {
  Logger.log(`Translation completed for ${payload.language} in resource ${payload.resource}`);
  
  // Check if this resource is configured for translation_completed trigger
  const config = getConfig();
  const fileMapping = findFileMappingByResource(payload.resource);
  
  if (fileMapping) {
    const folder = config.folders.find(f => f.id === fileMapping.folderId);
    if (folder && folder.triggers.includes('translated')) {
      Logger.log('Auto-downloading translated document for language: ' + payload.language);
      downloadTranslation(payload.resource, payload.language);
    }
  }
}

/**
 * Handle review completed webhook
 * @param {Object} payload - Webhook payload
 */
function handleReviewCompleted(payload) {
  Logger.log(`Review completed for ${payload.language} in resource ${payload.resource}`);
  
  const config = getConfig();
  const fileMapping = findFileMappingByResource(payload.resource);
  
  if (fileMapping) {
    const folder = config.folders.find(f => f.id === fileMapping.folderId);
    if (folder && folder.triggers.includes('reviewed')) {
      Logger.log('Auto-downloading reviewed document for language: ' + payload.language);
      downloadTranslation(payload.resource, payload.language);
    }
  }
}

/**
 * Handle proofread completed webhook
 * @param {Object} payload - Webhook payload
 */
function handleProofreadCompleted(payload) {
  Logger.log(`Proofread completed for ${payload.language} in resource ${payload.resource}`);
  
  const config = getConfig();
  const fileMapping = findFileMappingByResource(payload.resource);
  
  if (fileMapping) {
    const folder = config.folders.find(f => f.id === fileMapping.folderId);
    if (folder && folder.triggers.includes('proofread')) {
      Logger.log('Auto-downloading proofread document for language: ' + payload.language);
      downloadTranslation(payload.resource, payload.language);
    }
  }
}

/**
 * Handle translation updated webhook
 * @param {Object} payload - Webhook payload
 */
function handleTranslationUpdated(payload) {
  Logger.log(`Translation updated for ${payload.language} in resource ${payload.resource}`);
  
  const config = getConfig();
  const fileMapping = findFileMappingByResource(payload.resource);
  
  if (fileMapping) {
    const folder = config.folders.find(f => f.id === fileMapping.folderId);
    if (folder && folder.triggers.includes('updated')) {
      Logger.log('Auto-downloading updated translation for language: ' + payload.language);
      downloadTranslation(payload.resource, payload.language);
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Find file mapping by resource ID
 * @param {string} resourceId - Transifex resource ID
 * @return {Object|null} File mapping object or null
 */
function findFileMappingByResource(resourceId) {
  const config = getConfig();
  return config.fileMappings.find(mapping => 
    mapping.resourceId.includes(resourceId) || resourceId.includes(mapping.resourceId.split(':r:')[1])
  ) || null;
}

/**
 * Log activity to PropertiesService
 * @param {string} message - Activity message
 */
function logActivity(message) {
  try {
    const timestamp = new Date().toISOString();
    const activityLog = PropertiesService.getScriptProperties().getProperty('ACTIVITY_LOG');
    const activities = activityLog ? JSON.parse(activityLog) : [];
    
    activities.unshift(`${timestamp}: ${message}`);
    
    // Keep only last 100 activities
    if (activities.length > 100) {
      activities.splice(100);
    }
    
    PropertiesService.getScriptProperties().setProperty('ACTIVITY_LOG', JSON.stringify(activities));
  } catch (error) {
    Logger.log('Error logging activity: ' + error.message);
  }
}

/**
 * Get activity log
 * @return {Array} Array of activity messages
 */
function getActivityLog() {
  try {
    const activityLog = PropertiesService.getScriptProperties().getProperty('ACTIVITY_LOG');
    return activityLog ? JSON.parse(activityLog) : [];
  } catch (error) {
    Logger.log('Error getting activity log: ' + error.message);
    return [];
  }
}

// ============================================================================
// API FUNCTIONS FOR WEB INTERFACE
// ============================================================================

/**
 * Get current configuration for web interface
 * @return {Object} Current configuration
 */
function getConfigForUI() {
  const config = getConfig();
  // Don't expose sensitive data to UI
  if (config.settings && config.settings.apiToken) {
    config.settings.apiTokenMasked = '••••••••' + config.settings.apiToken.slice(-4);
  }
  config.activityLog = getActivityLog();
  return config;
}

/**
 * Save configuration from web interface
 * @param {Object} newConfig - New configuration from UI
 * @return {Object} Result object
 */
function saveConfigFromUI(newConfig) {
  try {
    // Validate required fields
    if (!newConfig.settings || !newConfig.settings.apiToken) {
      throw new Error('API Token is required');
    }
    
    // Keep existing API token if masked value is sent
    const existingConfig = getConfig();
    if (newConfig.settings.apiToken.includes('••••••••')) {
      newConfig.settings.apiToken = existingConfig.settings.apiToken;
    }
    
    saveConfig(newConfig);
    
    // Update triggers if interval changed
    if (existingConfig.settings.checkInterval !== newConfig.settings.checkInterval) {
      updateMonitoringTriggers(newConfig.settings.checkInterval);
    }
    
    logActivity('Configuration updated via web interface');
    
    return { success: true, message: 'Configuration saved successfully' };
  } catch (error) {
    Logger.log('Error saving config from UI: ' + error.message);
    return { success: false, message: error.message };
  }
}

// ============================================================================
// ADDITIONAL API FUNCTIONS FOR WEB INTERFACE
// ============================================================================

/**
 * Test Transifex connection from web interface
 * @param {string} apiToken - API token to test
 * @return {Object} Test result
 */
function testConnectionFromUI(apiToken) {
  try {
    return testTransifexConnection(apiToken);
  } catch (error) {
    Logger.log('Error testing connection from UI: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Manual file upload trigger
 * @param {string} fileId - Google Drive file ID  
 * @param {string} resourceId - Transifex resource ID
 * @return {Object} Upload result
 */
function uploadFileManually(fileId, resourceId) {
  try {
    Logger.log(`Manual upload triggered: ${fileId} -> ${resourceId}`);
    logActivity(`Manual upload started: ${DriveApp.getFileById(fileId).getName()}`);
    return uploadFileToTransifex(fileId, resourceId);
  } catch (error) {
    Logger.log('Error in manual upload: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Manual translation download trigger
 * @param {string} resourceId - Transifex resource ID
 * @param {string} languageCode - Language code
 * @return {Object} Download result  
 */
function downloadTranslationManually(resourceId, languageCode) {
  try {
    Logger.log(`Manual download triggered: ${resourceId} (${languageCode})`);
    logActivity(`Manual download started: ${languageCode} for ${resourceId}`);
    return downloadTranslation(resourceId, languageCode);
  } catch (error) {
    Logger.log('Error in manual download: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Get detailed file status for web interface
 * @return {Object} Detailed file status information
 */
function getDetailedFileStatus() {
  try {
    const config = getConfig();
    const results = {
      totalFiles: config.fileMappings.length,
      mappedFiles: config.fileMappings.filter(f => f.resourceId).length,
      pendingFiles: config.fileMappings.filter(f => !f.resourceId).length,
      folders: config.folders.length,
      recentActivity: getActivityLog().slice(0, 10)
    };
    
    return results;
  } catch (error) {
    Logger.log('Error getting detailed file status: ' + error.message);
    return { error: error.message };
  }
}

/**
 * Update file mapping with resource ID
 * @param {string} fileId - Google Drive file ID
 * @param {string} resourceId - Transifex resource ID
 * @return {Object} Update result
 */
function updateFileMappingResource(fileId, resourceId) {
  try {
    const config = getConfig();
    const mappingIndex = config.fileMappings.findIndex(m => m.fileId === fileId);
    
    if (mappingIndex === -1) {
      throw new Error('File mapping not found');
    }
    
    config.fileMappings[mappingIndex].resourceId = resourceId;
    config.fileMappings[mappingIndex].dateMapped = new Date().toISOString();
    
    saveConfig(config);
    
    const fileName = config.fileMappings[mappingIndex].fileName;
    logActivity(`File mapped to resource: ${fileName} -> ${resourceId}`);
    
    return { success: true, message: 'File mapping updated successfully' };
  } catch (error) {
    Logger.log('Error updating file mapping: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Clear activity log
 * @return {Object} Clear result
 */
function clearActivityLogFromUI() {
  try {
    PropertiesService.getScriptProperties().deleteProperty('ACTIVITY_LOG');
    logActivity('Activity log cleared');
    return { success: true, message: 'Activity log cleared successfully' };
  } catch (error) {
    Logger.log('Error clearing activity log: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Force file scan for specific folder
 * @param {string} folderId - Folder configuration ID
 * @return {Object} Scan result
 */
function forceFolderScan(folderId) {
  try {
    const config = getConfig();
    const folder = config.folders.find(f => f.id === folderId);
    
    if (!folder) {
      throw new Error('Folder configuration not found');
    }
    
    Logger.log(`Force scanning folder: ${folder.name}`);
    const files = scanFolderForFiles(folder.sourceFolder, folder.formats);
    
    logActivity(`Manual scan completed for ${folder.name}: ${files.length} files found`);
    
    return { 
      success: true, 
      message: `Scan completed: ${files.length} files found`,
      files: files 
    };
  } catch (error) {
    Logger.log('Error in force folder scan: ' + error.message);
    return { success: false, message: error.message };
  }
}

/**
 * Get project information and languages from Transifex
 * @param {string} organization - Organization slug
 * @param {string} project - Project slug
 * @return {Object} Project information
 */
function getProjectInfo(organization, project) {
  try {
    const projectId = `o:${organization}:p:${project}`;
    const languages = getProjectLanguages(projectId);
    
    return {
      success: true,
      projectId: projectId,
      languages: languages.map(lang => ({
        code: lang.id.replace('l:', ''),
        name: lang.attributes.name
      }))
    };
  } catch (error) {
    Logger.log('Error getting project info: ' + error.message);
    return { success: false, message: error.message };
  }
}

// ============================================================================
// INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * One-time setup function to initialize the integration
 */
function initializeIntegration() {
  try {
    Logger.log('=== Initializing Transifex-Google Drive Integration ===');
    
    // Initialize configuration
    const config = initializeConfig();
    Logger.log('Configuration initialized');
    
    // Set up initial monitoring trigger
    initializeMonitoringTrigger();
    Logger.log('Monitoring trigger initialized');
    
    // Log successful initialization
    logActivity('Integration initialized successfully');
    
    Logger.log('=== Integration Initialization Complete ===');
    return { success: true, message: 'Integration initialized successfully' };
  } catch (error) {
    Logger.log('Error initializing integration: ' + error.message);
    logActivity(`Initialization error: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Reset all triggers and configuration (use with caution)
 */
function resetIntegration() {
  try {
    Logger.log('=== Resetting Integration ===');
    
    // Delete all project triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
    });
    
    // Clear all properties
    PropertiesService.getScriptProperties().deleteProperty('CONFIG');
    PropertiesService.getScriptProperties().deleteProperty('ACTIVITY_LOG');
    
    Logger.log('Integration reset complete');
    return { success: true, message: 'Integration reset successfully' };
  } catch (error) {
    Logger.log('Error resetting integration: ' + error.message);
    return { success: false, message: error.message };
  }
}