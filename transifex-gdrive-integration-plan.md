# Transifex-Google Drive Integration Plan

## Project Overview
Build a Google Apps Script integration that replicates Zapier's Transifex-Google Drive functionality with enhanced features and user-friendly web interface.

## Core Requirements
- **File Types**: DOCX (Google Docs) and XLSX (Google Sheets)
- **Sync Direction**: Bidirectional (GD→TX for source files, TX→GD for translations)
- **Access Control**: Script owner only (private deployment)
- **Interface**: Real-time web app with automatic updates
- **Configuration**: Web-based (no code editing required)

## Technical Architecture

### 1. **Configuration Storage**
- **Method**: PropertiesService (JSON objects)
- **Scope**: Script properties (owner-only access)
- **Structure**:
  ```json
  {
    "settings": {
      "apiToken": "tx_api_token",
      "webhookSecret": "optional_secret",
      "checkInterval": 10
    },
    "folders": [{
      "id": "folder1",
      "name": "Marketing Materials",
      "sourceFolder": "1abc123...",
      "translationsFolder": "2def456...",
      "organization": "my-org",
      "project": "marketing-proj",
      "formats": ["docx", "xlsx"],
      "triggers": ["translated", "reviewed", "proofread"]
    }],
    "fileMappings": [{
      "fileId": "3ghi789...",
      "fileName": "brochure.docx",
      "resourceId": "o:my-org:p:marketing:r:brochure",
      "folderId": "folder1",
      "lastModified": "2024-01-15T10:30:00Z"
    }]
  }
  ```

### 2. **File Monitoring System**
- **Trigger Type**: Time-based (configurable interval, default 10 minutes)
- **Detection Logic**:
  - New files: Compare current folder contents with stored file list
  - Updated files: Compare `getLastUpdated()` timestamps
  - File types: Filter for `.docx` and `.xlsx` extensions only
- **Actions**:
  - New files: Add to file mappings, await manual resource assignment
  - Updated files: Upload to existing Transifex resource

### 3. **Webhook Handler**
- **Endpoint**: Google Apps Script Web App (doPost function)
- **Security**: Optional signature verification with webhook secret
- **Events Handled**:
  - `translation_completed` (100% translated)
  - `review_completed` (100% reviewed) 
  - `proofread_completed` (100% proofread)
  - `translation_completed_updated` (translated resource updated)
- **Payload Processing**: Extract language code and resource ID from webhook
- **Action**: Download translated file to designated translations folder

### 4. **Web Interface**
- **Framework**: Google Apps Script HTML Service
- **Authentication**: Owner-only access (private deployment)
- **Real-time Updates**: Polling with `google.script.run` every 30 seconds
- **UI Components**:
  - Settings panel (API token, webhook secret, check interval)
  - Folder management (add/edit/delete folder mappings)
  - File status dashboard (pending mappings, active files, translation progress)
  - Activity log (recent uploads, downloads, errors)
  - Test connection feature

### 5. **File Processing**
- **Export Methods**:
  - Google Docs → DOCX: `DriveApp.getFileById().getBlob()` with export format
  - Google Sheets → XLSX: Drive API export endpoint
- **Import Methods**:
  - DOCX → Google Docs: `Drive.Files.create()` with conversion
  - XLSX → Google Sheets: `Drive.Files.create()` with conversion
- **File Organization**:
  ```
  📁 Source Folder/
    ├── document.docx
    └── spreadsheet.xlsx
  
  📁 Translations Folder/
    ├── document_ES.docx
    ├── document_FR.docx
    ├── spreadsheet_ES.xlsx
    └── spreadsheet_FR.xlsx
  ```

## Implementation Todo List

### Phase 1: Core Infrastructure
- [ ] Set up Google Apps Script project with required services
- [ ] Implement PropertiesService configuration management
- [ ] Create basic web app structure (HTML/CSS/JS files)
- [ ] Implement authentication and access control
- [ ] Set up webhook endpoint (doPost function)

### Phase 2: File Operations
- [ ] Implement Google Docs DOCX export functionality
- [ ] Implement Google Sheets XLSX export functionality  
- [ ] Implement DOCX to Google Docs import functionality
- [ ] Implement XLSX to Google Sheets import functionality
- [ ] Create file monitoring system with time-based triggers
- [ ] Implement file change detection logic

### Phase 3: Transifex Integration
- [ ] Implement Transifex API authentication
- [ ] Create resource upload functionality (async upload handling)
- [ ] Implement resource update functionality
- [ ] Create translation download functionality (async download handling)
- [ ] Implement webhook signature verification
- [ ] Handle webhook events and trigger appropriate actions

### Phase 4: Web Interface
- [ ] Create main dashboard HTML template
- [ ] Implement settings management interface
- [ ] Create folder configuration interface
- [ ] Build file status dashboard with real-time updates
- [ ] Implement activity logging and display
- [ ] Add test connection functionality
- [ ] Create error handling and user feedback systems

### Phase 5: Advanced Features
- [ ] Implement dynamic trigger interval management
- [ ] Add bulk file operations
- [ ] Create detailed progress tracking for async operations
- [ ] Implement email notifications for completed translations
- [ ] Add export/import functionality for configurations
- [ ] Create comprehensive error recovery mechanisms

### Phase 6: Polish & Testing
- [ ] Implement comprehensive error handling
- [ ] Add input validation and sanitization
- [ ] Create user documentation and setup guide
- [ ] Perform end-to-end testing with real Transifex projects
- [ ] Optimize performance and reduce API calls
- [ ] Add logging and debugging capabilities

## API Integration Details

### Transifex API Endpoints
- **Authentication**: Bearer token in Authorization header
- **Upload**: `POST /resource_strings_async_uploads`
- **Download**: `POST /resource_translations_async_downloads`
- **Status Check**: `GET /resource_*_async_*/{id}`
- **Webhook**: User-configured endpoint receives POST requests

### Google Drive API Usage
- **Export URLs**: 
  - Docs: `https://docs.google.com/document/d/{id}/export?format=docx`
  - Sheets: `https://docs.google.com/spreadsheets/d/{id}/export?format=xlsx`
- **Import**: `Drive.Files.create()` with mime type conversion
- **Folder Monitoring**: `DriveApp.getFolderById().getFiles()`

## File Naming Convention
- **Source Files**: Original names (e.g., `document.docx`)
- **Translated Files**: `{original-name}_{language-code}.{extension}`
- **Example**: `marketing-brochure.docx` → `marketing-brochure_ES.docx`

## Error Handling Strategy
- **Retry Logic**: Exponential backoff for API failures
- **User Feedback**: Clear error messages in web interface
- **Logging**: Comprehensive logging for debugging
- **Graceful Degradation**: Continue processing other files if one fails
- **Recovery**: Manual retry options for failed operations

## Security Considerations
- **API Token Storage**: Encrypted in PropertiesService
- **Webhook Security**: Optional signature verification
- **Access Control**: Script owner only
- **Input Validation**: Sanitize all user inputs
- **Error Information**: Don't expose sensitive data in error messages

## Performance Optimization
- **Batch Operations**: Process multiple files in single execution
- **Caching**: Store folder contents to minimize API calls
- **Async Handling**: Proper polling for long-running operations
- **Resource Limits**: Respect Google Apps Script execution time limits

## Deployment Requirements
- **Google Apps Script Project**: With advanced services enabled
- **Drive API**: Enabled in Google Cloud Console
- **Transifex Account**: With API access and webhook support
- **Webhook URL**: Generated from deployed web app
- **Folder Structure**: Pre-created source and translation folders

## Success Metrics
- **File Detection**: New and updated files detected within configured interval
- **Upload Success**: Files successfully uploaded to Transifex
- **Download Success**: Translations automatically downloaded and converted
- **User Experience**: Web interface provides clear status and controls
- **Reliability**: System continues operating with minimal manual intervention

## Future Enhancements
- **Multi-user Support**: Expand beyond owner-only access
- **Advanced Filtering**: File type and content-based filters
- **Batch Translation**: Support for translation memory and machine translation
- **Integration Expansion**: Support for additional file formats
- **Analytics**: Detailed reporting on translation progress and usage