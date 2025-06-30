/**
 * File Operations Module
 * 
 * Handles all Google Drive file operations including:
 * - DOCX export from Google Docs
 * - XLSX export from Google Sheets  
 * - DOCX import to Google Docs
 * - XLSX import to Google Sheets
 * - File monitoring and change detection
 */

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export Google Doc as DOCX blob
 * @param {string} documentId - Google Docs ID
 * @return {Blob} DOCX blob
 */
function exportDocAsDocx(documentId) {
  try {
    Logger.log('Exporting Google Doc as DOCX: ' + documentId);
    
    // Verify document access
    const doc = DocumentApp.openById(documentId);
    Logger.log('Document name: ' + doc.getName());
    
    const exportUrl = `https://docs.google.com/document/d/${documentId}/export?format=docx`;
    const token = ScriptApp.getOAuthToken();
    
    const response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      muteHttpExceptions: true
    });
    
    Logger.log('Export response code: ' + response.getResponseCode());
    
    if (response.getResponseCode() === 200) {
      const blob = response.getBlob();
      blob.setName(doc.getName() + '.docx');
      blob.setContentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      // Validate DOCX file
      const bytes = blob.getBytes();
      const signature = String.fromCharCode(bytes[0]) + String.fromCharCode(bytes[1]);
      
      if (signature !== 'PK') {
        throw new Error('Invalid DOCX file - missing ZIP signature');
      }
      
      Logger.log('DOCX export successful. Size: ' + bytes.length + ' bytes');
      return blob;
    } else {
      throw new Error('Failed to export DOCX. Status: ' + response.getResponseCode() + ' - ' + response.getContentText());
    }
  } catch (error) {
    Logger.log('Error exporting Doc as DOCX: ' + error.message);
    throw error;
  }
}

/**
 * Export Google Sheet as XLSX blob
 * @param {string} spreadsheetId - Google Sheets ID
 * @return {Blob} XLSX blob
 */
function exportSheetAsXlsx(spreadsheetId) {
  try {
    Logger.log('Exporting Google Sheet as XLSX: ' + spreadsheetId);
    
    // Verify spreadsheet access
    const sheet = SpreadsheetApp.openById(spreadsheetId);
    Logger.log('Spreadsheet name: ' + sheet.getName());
    
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
    const token = ScriptApp.getOAuthToken();
    
    const response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      muteHttpExceptions: true
    });
    
    Logger.log('Export response code: ' + response.getResponseCode());
    
    if (response.getResponseCode() === 200) {
      const blob = response.getBlob();
      blob.setName(sheet.getName() + '.xlsx');
      blob.setContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      // Validate XLSX file
      const bytes = blob.getBytes();
      const signature = String.fromCharCode(bytes[0]) + String.fromCharCode(bytes[1]);
      
      if (signature !== 'PK') {
        throw new Error('Invalid XLSX file - missing ZIP signature');
      }
      
      Logger.log('XLSX export successful. Size: ' + bytes.length + ' bytes');
      return blob;
    } else {
      throw new Error('Failed to export XLSX. Status: ' + response.getResponseCode() + ' - ' + response.getContentText());
    }
  } catch (error) {
    Logger.log('Error exporting Sheet as XLSX: ' + error.message);
    throw error;
  }
}

/**
 * Export file based on its type
 * @param {string} fileId - Google Drive file ID
 * @return {Blob} Exported file blob
 */
function exportFile(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const mimeType = file.getBlob().getContentType();
    
    Logger.log(`Exporting file ${file.getName()} with mime type: ${mimeType}`);
    
    switch (mimeType) {
      case 'application/vnd.google-apps.document':
        return exportDocAsDocx(fileId);
      case 'application/vnd.google-apps.spreadsheet':
        return exportSheetAsXlsx(fileId);
      default:
        throw new Error('Unsupported file type: ' + mimeType);
    }
  } catch (error) {
    Logger.log('Error exporting file: ' + error.message);
    throw error;
  }
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

/**
 * Import DOCX blob as Google Doc
 * @param {Blob} docxBlob - DOCX file blob
 * @param {string} fileName - Name for the new document
 * @param {string} folderId - Target folder ID
 * @return {Object} Created file information
 */
function importDocxAsDoc(docxBlob, fileName, folderId) {
  try {
    Logger.log('Importing DOCX as Google Doc: ' + fileName);
    
    // Validate DOCX blob
    const bytes = docxBlob.getBytes();
    const signature = String.fromCharCode(bytes[0]) + String.fromCharCode(bytes[1]);
    
    if (signature !== 'PK') {
      throw new Error('Invalid DOCX file - not a valid ZIP archive');
    }
    
    // Create temporary DOCX file
    const tempFile = DriveApp.createFile(docxBlob.setName('temp_import.docx'));
    
    try {
      // Convert to Google Docs using Drive API
      const convertedFile = Drive.Files.create({
        name: fileName,
        parents: [folderId],
        mimeType: 'application/vnd.google-apps.document'
      }, tempFile.getBlob());
      
      Logger.log('DOCX imported successfully. New Google Doc ID: ' + convertedFile.id);
      
      return {
        id: convertedFile.id,
        name: convertedFile.name,
        url: `https://docs.google.com/document/d/${convertedFile.id}/edit`
      };
    } finally {
      // Clean up temporary file
      tempFile.setTrashed(true);
    }
  } catch (error) {
    Logger.log('Error importing DOCX as Doc: ' + error.message);
    throw error;
  }
}

/**
 * Import XLSX blob as Google Sheet
 * @param {Blob} xlsxBlob - XLSX file blob
 * @param {string} fileName - Name for the new spreadsheet
 * @param {string} folderId - Target folder ID
 * @return {Object} Created file information
 */
function importXlsxAsSheet(xlsxBlob, fileName, folderId) {
  try {
    Logger.log('Importing XLSX as Google Sheet: ' + fileName);
    
    // Validate XLSX blob
    const bytes = xlsxBlob.getBytes();
    const signature = String.fromCharCode(bytes[0]) + String.fromCharCode(bytes[1]);
    
    if (signature !== 'PK') {
      throw new Error('Invalid XLSX file - not a valid ZIP archive');
    }
    
    // Create temporary XLSX file
    const tempFile = DriveApp.createFile(xlsxBlob.setName('temp_import.xlsx'));
    
    try {
      // Convert to Google Sheets using Drive API
      const convertedFile = Drive.Files.create({
        name: fileName,
        parents: [folderId],
        mimeType: 'application/vnd.google-apps.spreadsheet'
      }, tempFile.getBlob());
      
      Logger.log('XLSX imported successfully. New Google Sheet ID: ' + convertedFile.id);
      
      return {
        id: convertedFile.id,
        name: convertedFile.name,
        url: `https://docs.google.com/spreadsheets/d/${convertedFile.id}/edit`
      };
    } finally {
      // Clean up temporary file
      tempFile.setTrashed(true);
    }
  } catch (error) {
    Logger.log('Error importing XLSX as Sheet: ' + error.message);
    throw error;
  }
}

/**
 * Import translated file to appropriate Google format
 * @param {Blob} fileBlob - Translated file blob
 * @param {string} originalFileName - Original file name
 * @param {string} languageCode - Language code
 * @param {string} folderId - Target folder ID
 * @return {Object} Created file information
 */
function importTranslatedFile(fileBlob, originalFileName, languageCode, folderId) {
  try {
    const fileExtension = originalFileName.split('.').pop().toLowerCase();
    const baseName = originalFileName.substring(0, originalFileName.lastIndexOf('.'));
    const translatedFileName = `${baseName}_${languageCode.toUpperCase()}`;
    
    Logger.log(`Importing translated file: ${translatedFileName}.${fileExtension}`);
    
    switch (fileExtension) {
      case 'docx':
        return importDocxAsDoc(fileBlob, translatedFileName, folderId);
      case 'xlsx':
        return importXlsxAsSheet(fileBlob, translatedFileName, folderId);
      default:
        throw new Error('Unsupported file extension: ' + fileExtension);
    }
  } catch (error) {
    Logger.log('Error importing translated file: ' + error.message);
    throw error;
  }
}

// ============================================================================
// FILE MONITORING FUNCTIONS
// ============================================================================

/**
 * Scan folder for files matching configured formats
 * @param {string} folderId - Google Drive folder ID
 * @param {Array} allowedFormats - Array of allowed file formats (e.g., ['docx', 'xlsx'])
 * @return {Array} Array of file objects
 */
function scanFolderForFiles(folderId, allowedFormats) {
  try {
    Logger.log(`Scanning folder ${folderId} for formats: ${allowedFormats.join(', ')}`);
    
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const foundFiles = [];
    
    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getBlob().getContentType();
      const fileName = file.getName();
      
      // Check if file is supported type
      let isSupported = false;
      if (allowedFormats.includes('docx') && mimeType === 'application/vnd.google-apps.document') {
        isSupported = true;
      }
      if (allowedFormats.includes('xlsx') && mimeType === 'application/vnd.google-apps.spreadsheet') {
        isSupported = true;
      }
      
      if (isSupported) {
        foundFiles.push({
          fileId: file.getId(),
          fileName: fileName,
          mimeType: mimeType,
          lastModified: file.getLastUpdated().toISOString(),
          size: file.getSize(),
          url: file.getUrl()
        });
      }
    }
    
    Logger.log(`Found ${foundFiles.length} supported files in folder`);
    return foundFiles;
  } catch (error) {
    Logger.log('Error scanning folder: ' + error.message);
    throw error;
  }
}

/**
 * Detect new and updated files across all configured folders
 * @return {Object} Object containing new and updated files
 */
function detectFileChanges() {
  try {
    const config = getConfig();
    const results = {
      newFiles: [],
      updatedFiles: []
    };
    
    if (!config.folders || config.folders.length === 0) {
      Logger.log('No folders configured for monitoring');
      return results;
    }
    
    for (const folder of config.folders) {
      Logger.log(`Checking folder: ${folder.name}`);
      
      try {
        const currentFiles = scanFolderForFiles(folder.sourceFolder, folder.formats);
        const existingMappings = config.fileMappings.filter(m => m.folderId === folder.id);
        
        for (const file of currentFiles) {
          const existingMapping = existingMappings.find(m => m.fileId === file.fileId);
          
          if (!existingMapping) {
            // New file
            Logger.log(`New file detected: ${file.fileName}`);
            results.newFiles.push({
              ...file,
              folderId: folder.id,
              folderName: folder.name
            });
          } else if (file.lastModified !== existingMapping.lastModified) {
            // Updated file
            Logger.log(`Updated file detected: ${file.fileName}`);
            results.updatedFiles.push({
              ...file,
              folderId: folder.id,
              folderName: folder.name,
              resourceId: existingMapping.resourceId
            });
          }
        }
      } catch (error) {
        Logger.log(`Error checking folder ${folder.name}: ${error.message}`);
        logActivity(`Error checking folder ${folder.name}: ${error.message}`);
      }
    }
    
    Logger.log(`File change detection complete. New: ${results.newFiles.length}, Updated: ${results.updatedFiles.length}`);
    return results;
  } catch (error) {
    Logger.log('Error detecting file changes: ' + error.message);
    throw error;
  }
}

/**
 * Process new files by adding them to file mappings
 * @param {Array} newFiles - Array of new file objects
 */
function processNewFiles(newFiles) {
  try {
    if (newFiles.length === 0) {
      return;
    }
    
    Logger.log(`Processing ${newFiles.length} new files`);
    const config = getConfig();
    
    for (const file of newFiles) {
      const fileMapping = {
        fileId: file.fileId,
        fileName: file.fileName,
        folderId: file.folderId,
        lastModified: file.lastModified,
        resourceId: '', // Will be set manually by user
        mimeType: file.mimeType,
        size: file.size,
        url: file.url,
        dateAdded: new Date().toISOString()
      };
      
      config.fileMappings.push(fileMapping);
      logActivity(`New file detected: ${file.fileName} in folder ${file.folderName}`);
    }
    
    saveConfig(config);
    Logger.log('New files processed and added to file mappings');
  } catch (error) {
    Logger.log('Error processing new files: ' + error.message);
    throw error;
  }
}

/**
 * Process updated files by uploading to Transifex
 * @param {Array} updatedFiles - Array of updated file objects
 */
function processUpdatedFiles(updatedFiles) {
  try {
    if (updatedFiles.length === 0) {
      return;
    }
    
    Logger.log(`Processing ${updatedFiles.length} updated files`);
    
    for (const file of updatedFiles) {
      if (file.resourceId) {
        Logger.log(`Uploading updated file: ${file.fileName}`);
        // TODO: Implement upload to Transifex
        uploadFileToTransifex(file.fileId, file.resourceId);
        logActivity(`Updated file uploaded: ${file.fileName}`);
      } else {
        Logger.log(`Skipping updated file ${file.fileName} - no resource mapping`);
      }
    }
  } catch (error) {
    Logger.log('Error processing updated files: ' + error.message);
    throw error;
  }
}

/**
 * Main file monitoring function (called by trigger)
 */
function monitorFiles() {
  try {
    Logger.log('=== File Monitoring Started ===');
    logActivity('File monitoring scan started');
    
    const changes = detectFileChanges();
    
    if (changes.newFiles.length > 0 || changes.updatedFiles.length > 0) {
      processNewFiles(changes.newFiles);
      processUpdatedFiles(changes.updatedFiles);
      
      logActivity(`Monitoring complete: ${changes.newFiles.length} new, ${changes.updatedFiles.length} updated`);
    } else {
      Logger.log('No file changes detected');
    }
    
    Logger.log('=== File Monitoring Complete ===');
  } catch (error) {
    Logger.log('Error in file monitoring: ' + error.message);
    logActivity(`File monitoring error: ${error.message}`);
  }
}

// ============================================================================
// TRIGGER MANAGEMENT
// ============================================================================

/**
 * Update monitoring triggers with new interval
 * @param {number} intervalMinutes - Interval in minutes
 */
function updateMonitoringTriggers(intervalMinutes) {
  try {
    Logger.log(`Updating monitoring triggers to ${intervalMinutes} minutes`);
    
    // Delete existing monitoring triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'monitorFiles') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Create new trigger
    ScriptApp.newTrigger('monitorFiles')
      .timeBased()
      .everyMinutes(intervalMinutes)
      .create();
    
    Logger.log('Monitoring triggers updated successfully');
    logActivity(`File monitoring interval updated to ${intervalMinutes} minutes`);
  } catch (error) {
    Logger.log('Error updating monitoring triggers: ' + error.message);
    throw error;
  }
}

/**
 * Initialize default monitoring trigger
 */
function initializeMonitoringTrigger() {
  try {
    // Check if monitoring trigger already exists
    const triggers = ScriptApp.getProjectTriggers();
    const hasMonitoringTrigger = triggers.some(trigger => 
      trigger.getHandlerFunction() === 'monitorFiles'
    );
    
    if (!hasMonitoringTrigger) {
      const config = getConfig();
      const interval = (config.settings && config.settings.checkInterval) || 10;
      updateMonitoringTriggers(interval);
      Logger.log('Default monitoring trigger initialized');
    }
  } catch (error) {
    Logger.log('Error initializing monitoring trigger: ' + error.message);
  }
}

// Placeholder function for Transifex upload (to be implemented in next phase)
function uploadFileToTransifex(fileId, resourceId) {
  Logger.log(`TODO: Upload file ${fileId} to resource ${resourceId}`);
}