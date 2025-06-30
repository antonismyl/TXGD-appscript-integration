/**
 * Transifex API Integration Module
 * 
 * Handles all Transifex API operations including:
 * - Authentication and connection testing
 * - Resource upload (async)
 * - Resource update (async)  
 * - Translation download (async)
 * - Status polling for async operations
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const TRANSIFEX_API_BASE = 'https://rest.api.transifex.com';
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 10000; // 10 seconds
const POLL_DELAY_MS = 15000; // 15 seconds

// ============================================================================
// AUTHENTICATION AND TESTING
// ============================================================================

/**
 * Test connection to Transifex API
 * @param {string} apiToken - Transifex API token
 * @return {Object} Connection test result
 */
function testTransifexConnection(apiToken) {
  try {
    Logger.log('Testing Transifex API connection');
    
    if (!apiToken) {
      return { success: false, message: 'API token is required' };
    }
    
    // Test with a simple API call to get user info
    const response = UrlFetchApp.fetch(`${TRANSIFEX_API_BASE}/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/vnd.api+json'
      },
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    Logger.log(`Connection test response code: ${responseCode}`);
    
    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      Logger.log('Connection test successful');
      return {
        success: true,
        message: `Connected successfully as: ${data.data.attributes.username}`,
        userInfo: data.data.attributes
      };
    } else if (responseCode === 401) {
      return { success: false, message: 'Invalid API token - authentication failed' };
    } else {
      return { 
        success: false, 
        message: `Connection failed with status ${responseCode}: ${response.getContentText()}` 
      };
    }
  } catch (error) {
    Logger.log('Error testing Transifex connection: ' + error.message);
    return { success: false, message: 'Connection error: ' + error.message };
  }
}

/**
 * Get API headers for Transifex requests
 * @param {string} apiToken - Transifex API token
 * @return {Object} Headers object
 */
function getTransifexHeaders(apiToken) {
  return {
    'Authorization': `Bearer ${apiToken}`,
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json'
  };
}

// ============================================================================
// RESOURCE UPLOAD FUNCTIONS
// ============================================================================

/**
 * Upload file to Transifex as new resource
 * @param {string} fileId - Google Drive file ID
 * @param {string} resourceId - Transifex resource ID
 * @return {Object} Upload result
 */
function uploadFileToTransifex(fileId, resourceId) {
  try {
    const config = getConfig();
    const apiToken = config.settings.apiToken;
    
    if (!apiToken) {
      throw new Error('API token not configured');
    }
    
    Logger.log(`Starting upload of file ${fileId} to resource ${resourceId}`);
    
    // Export file from Google Drive
    const fileBlob = exportFile(fileId);
    Logger.log(`File exported. Size: ${fileBlob.getBytes().length} bytes`);
    
    // Prepare upload payload
    const payload = {
      content: fileBlob,
      resource: resourceId,
      callback_url: null,
      replace_edited_strings: 'false',
      keep_translations: 'true'
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/vnd.api+json'
      },
      payload: payload,
      muteHttpExceptions: true
    };
    
    Logger.log('Making upload request to Transifex');
    const response = UrlFetchApp.fetch(`${TRANSIFEX_API_BASE}/resource_strings_async_uploads`, options);
    
    Logger.log(`Upload response code: ${response.getResponseCode()}`);
    Logger.log(`Upload response body: ${response.getContentText()}`);
    
    const data = JSON.parse(response.getContentText());
    
    if (data.data && data.data.id) {
      Logger.log(`Async upload started. ID: ${data.data.id}`);
      logActivity(`Upload started for file: ${DriveApp.getFileById(fileId).getName()}`);
      
      // Poll for completion
      pollUploadStatus(data.data.id, 0, fileId);
      
      return { success: true, uploadId: data.data.id };
    } else {
      throw new Error('Failed to start async upload: ' + JSON.stringify(data));
    }
  } catch (error) {
    Logger.log('Upload error: ' + error.message);
    logActivity(`Upload failed: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Poll upload status until completion
 * @param {string} uploadId - Async upload ID
 * @param {number} attempt - Current attempt number
 * @param {string} fileId - Original file ID for logging
 */
function pollUploadStatus(uploadId, attempt, fileId) {
  if (attempt >= MAX_RETRIES) {
    Logger.log('Max upload retries reached. Giving up.');
    logActivity(`Upload timeout after ${MAX_RETRIES} attempts`);
    return;
  }
  
  const config = getConfig();
  const apiToken = config.settings.apiToken;
  
  const url = `${TRANSIFEX_API_BASE}/resource_strings_async_uploads/${uploadId}`;
  const options = {
    method: 'GET',
    headers: getTransifexHeaders(apiToken),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    
    Logger.log(`Upload poll attempt ${attempt + 1}, response code: ${code}`);
    
    if (code === 200) {
      const data = JSON.parse(response.getContentText());
      const status = data.data.attributes.status;
      
      Logger.log(`Upload status: ${status}`);
      
      switch (status) {
        case 'pending':
        case 'processing':
          Logger.log(`Still processing, will check again in ${POLL_DELAY_MS/1000} seconds...`);
          Utilities.sleep(POLL_DELAY_MS);
          pollUploadStatus(uploadId, attempt + 1, fileId);
          break;
          
        case 'succeeded':
          Logger.log('Upload succeeded!');
          const fileName = DriveApp.getFileById(fileId).getName();
          logActivity(`Upload completed successfully: ${fileName}`);
          
          // Update file mapping with last modified time
          updateFileMapping(fileId);
          break;
          
        case 'failed':
          Logger.log('Upload failed.');
          Logger.log('Failure details: ' + JSON.stringify(data.data.attributes.details, null, 2));
          logActivity(`Upload failed: ${JSON.stringify(data.data.attributes.details)}`);
          break;
          
        default:
          Logger.log('Unexpected upload status: ' + status);
          logActivity(`Unexpected upload status: ${status}`);
      }
    } else {
      Logger.log(`Unexpected poll response code: ${code}`);
      Logger.log('Response: ' + response.getContentText());
    }
  } catch (error) {
    Logger.log('Error polling upload status: ' + error.message);
    logActivity(`Upload polling error: ${error.message}`);
  }
}

/**
 * Update file mapping after successful upload
 * @param {string} fileId - Google Drive file ID
 */
function updateFileMapping(fileId) {
  try {
    const config = getConfig();
    const mappingIndex = config.fileMappings.findIndex(m => m.fileId === fileId);
    
    if (mappingIndex !== -1) {
      const file = DriveApp.getFileById(fileId);
      config.fileMappings[mappingIndex].lastModified = file.getLastUpdated().toISOString();
      saveConfig(config);
      Logger.log('File mapping updated after successful upload');
    }
  } catch (error) {
    Logger.log('Error updating file mapping: ' + error.message);
  }
}

// ============================================================================
// TRANSLATION DOWNLOAD FUNCTIONS
// ============================================================================

/**
 * Download translation from Transifex
 * @param {string} resourceId - Transifex resource ID
 * @param {string} languageCode - Language code (e.g., 'es', 'fr')
 */
function downloadTranslation(resourceId, languageCode) {
  try {
    const config = getConfig();
    const apiToken = config.settings.apiToken;
    
    if (!apiToken) {
      throw new Error('API token not configured');
    }
    
    Logger.log(`Starting translation download for ${resourceId} in ${languageCode}`);
    
    const url = `${TRANSIFEX_API_BASE}/resource_translations_async_downloads`;
    const payload = {
      data: {
        type: 'resource_translations_async_downloads',
        relationships: {
          resource: {
            data: { type: 'resources', id: resourceId }
          },
          language: {
            data: { type: 'languages', id: 'l:' + languageCode }
          }
        },
        attributes: {
          content_encoding: 'text',
          file_type: 'default',
          mode: 'default'
        }
      }
    };
    
    const options = {
      method: 'POST',
      headers: getTransifexHeaders(apiToken),
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    Logger.log('Translation download response: ' + JSON.stringify(data, null, 2));
    
    if (data.data && data.data.id) {
      const downloadId = data.data.id;
      Logger.log(`Async translation download started. ID: ${downloadId}`);
      logActivity(`Translation download started: ${languageCode} for ${resourceId}`);
      
      // Poll for completion
      pollTranslationDownload(downloadId, 0, resourceId, languageCode);
      
      return { success: true, downloadId: downloadId };
    } else {
      throw new Error('Failed to start async translation download: ' + JSON.stringify(data));
    }
  } catch (error) {
    Logger.log('Translation download error: ' + error.message);
    logActivity(`Translation download failed: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Poll translation download status until completion
 * @param {string} downloadId - Async download ID
 * @param {number} attempt - Current attempt number
 * @param {string} resourceId - Resource ID
 * @param {string} languageCode - Language code
 */
function pollTranslationDownload(downloadId, attempt, resourceId, languageCode) {
  if (attempt >= MAX_RETRIES) {
    Logger.log('Max translation download retries reached. Giving up.');
    logActivity(`Translation download timeout after ${MAX_RETRIES} attempts`);
    return;
  }
  
  const config = getConfig();
  const apiToken = config.settings.apiToken;
  
  const url = `${TRANSIFEX_API_BASE}/resource_translations_async_downloads/${downloadId}`;
  const options = {
    method: 'GET',
    headers: getTransifexHeaders(apiToken),
    muteHttpExceptions: true,
    followRedirects: false
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    
    Logger.log(`Translation download poll attempt ${attempt + 1}, response code: ${code}`);
    
    if (code === 200) {
      const data = JSON.parse(response.getContentText());
      const status = data.data.attributes.status;
      
      Logger.log(`Translation download status: ${status}`);
      
      switch (status) {
        case 'pending':
        case 'processing':
          Logger.log(`Still processing, will check again in ${POLL_DELAY_MS/1000} seconds...`);
          Utilities.sleep(POLL_DELAY_MS);
          pollTranslationDownload(downloadId, attempt + 1, resourceId, languageCode);
          break;
          
        case 'failed':
          Logger.log('Translation download failed.');
          Logger.log('Error details: ' + JSON.stringify(data.data.attributes, null, 2));
          logActivity(`Translation download failed: ${JSON.stringify(data.data.attributes)}`);
          break;
          
        default:
          Logger.log('Unexpected download status: ' + status);
          logActivity(`Unexpected translation download status: ${status}`);
      }
    } else if (code === 303) {
      // Download is ready - redirect contains the actual file URL
      const downloadUrl = response.getHeaders()['Location'];
      Logger.log('Translation download ready. URL: ' + downloadUrl);
      
      // Download and import the translated file
      downloadAndImportTranslation(downloadUrl, resourceId, languageCode);
    } else {
      Logger.log(`Unexpected translation download response code: ${code}`);
      Logger.log('Response: ' + response.getContentText());
      
      // Retry on certain error codes
      if (code >= 500) {
        Utilities.sleep(POLL_DELAY_MS);
        pollTranslationDownload(downloadId, attempt + 1, resourceId, languageCode);
      }
    }
  } catch (error) {
    Logger.log('Error polling translation download: ' + error.message);
    logActivity(`Translation download polling error: ${error.message}`);
  }
}

/**
 * Download and import translated file
 * @param {string} downloadUrl - Download URL from Transifex
 * @param {string} resourceId - Resource ID
 * @param {string} languageCode - Language code
 */
function downloadAndImportTranslation(downloadUrl, resourceId, languageCode) {
  try {
    const config = getConfig();
    const apiToken = config.settings.apiToken;
    
    Logger.log('Downloading translated file from: ' + downloadUrl);
    
    const response = UrlFetchApp.fetch(downloadUrl, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Failed to download file. Status: ${response.getResponseCode()}`);
    }
    
    const fileBlob = response.getBlob();
    Logger.log(`Downloaded file. Size: ${fileBlob.getBytes().length} bytes`);
    
    // Find the corresponding file mapping
    const fileMapping = findFileMappingByResource(resourceId);
    if (!fileMapping) {
      throw new Error('No file mapping found for resource: ' + resourceId);
    }
    
    // Find the folder configuration
    const folder = config.folders.find(f => f.id === fileMapping.folderId);
    if (!folder) {
      throw new Error('No folder configuration found for mapping');
    }
    
    // Import the translated file
    const importResult = importTranslatedFile(
      fileBlob, 
      fileMapping.fileName, 
      languageCode, 
      folder.translationsFolder
    );
    
    Logger.log('Translation imported successfully');
    Logger.log(`New file: ${importResult.name} (${importResult.id})`);
    Logger.log(`URL: ${importResult.url}`);
    
    logActivity(`Translation imported: ${importResult.name} (${languageCode})`);
    
    // Optional: Send notification email
    sendTranslationNotification(importResult, languageCode, fileMapping.fileName);
    
  } catch (error) {
    Logger.log('Error downloading and importing translation: ' + error.message);
    logActivity(`Translation import error: ${error.message}`);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Send email notification for completed translation
 * @param {Object} importResult - Import result object
 * @param {string} languageCode - Language code
 * @param {string} originalFileName - Original file name
 */
function sendTranslationNotification(importResult, languageCode, originalFileName) {
  try {
    const subject = `🌍 Translation Complete: ${languageCode.toUpperCase()}`;
    const body = `
Your document translation is ready!

Original File: ${originalFileName}
Language: ${languageCode.toUpperCase()}
Translated Document: ${importResult.url}

This translation was automatically imported when Transifex completed the translation process.

Best regards,
Your Transifex-Google Drive Integration
    `;
    
    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: subject,
      body: body
    });
    
    Logger.log('Translation notification email sent');
  } catch (error) {
    Logger.log('Failed to send notification email: ' + error.message);
  }
}

/**
 * Get resource information from Transifex
 * @param {string} resourceId - Transifex resource ID
 * @return {Object} Resource information
 */
function getResourceInfo(resourceId) {
  try {
    const config = getConfig();
    const apiToken = config.settings.apiToken;
    
    const response = UrlFetchApp.fetch(`${TRANSIFEX_API_BASE}/resources/${resourceId}`, {
      method: 'GET',
      headers: getTransifexHeaders(apiToken),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    } else {
      throw new Error(`Failed to get resource info. Status: ${response.getResponseCode()}`);
    }
  } catch (error) {
    Logger.log('Error getting resource info: ' + error.message);
    throw error;
  }
}

/**
 * List available languages for a project
 * @param {string} projectId - Transifex project ID  
 * @return {Array} Array of language objects
 */
function getProjectLanguages(projectId) {
  try {
    const config = getConfig();
    const apiToken = config.settings.apiToken;
    
    const response = UrlFetchApp.fetch(`${TRANSIFEX_API_BASE}/projects/${projectId}/languages`, {
      method: 'GET',
      headers: getTransifexHeaders(apiToken),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      return data.data || [];
    } else {
      throw new Error(`Failed to get project languages. Status: ${response.getResponseCode()}`);
    }
  } catch (error) {
    Logger.log('Error getting project languages: ' + error.message);
    throw error;
  }
}