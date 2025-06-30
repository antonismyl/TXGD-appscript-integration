# Transifex-Google Drive Integration Setup Guide

## Overview
This Google Apps Script integration provides automated bidirectional sync between Google Drive files (DOCX/XLSX) and Transifex translation projects.

## Prerequisites
- Google account with access to Google Apps Script
- Transifex account with API access
- Google Drive folders for source files and translations
- Basic understanding of Transifex projects and resources

## Installation Steps

### 1. Create Google Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Replace the default `Code.gs` content with the provided `Code.gs` file
4. Create additional files by clicking the "+" button:
   - `FileOperations.gs`
   - `TransifexAPI.gs`
   - `index.html`
   - `styles.html`
   - `script.html`
5. Copy the respective content into each file

### 2. Enable Required Services

1. In the Apps Script editor, click "Services" (⚙️) in the left sidebar
2. Click "Add a service"
3. Add these services:
   - **Drive API** (Advanced Google Services)
   - Enable with default settings

### 3. Enable Drive API in Google Cloud Console (Might not be necessary, skip for now unless it causes issues)

1. In Apps Script, click "Project Settings" (⚙️)
2. Copy the "Google Cloud Platform (GCP) Project ID"
3. Go to [Google Cloud Console](https://console.cloud.google.com)
4. Select your project using the copied ID
5. Go to "APIs & Services" > "Library"
6. Search for "Google Drive API" and enable it

### 4. Deploy as Web App

1. In Apps Script, click "Deploy" > "New deployment"
2. Choose "Web app" as the type
3. Configure deployment:
   - **Description**: "Transifex-Google Drive Integration"
   - **Execute as**: Me
   - **Who has access**: Only myself
4. Click "Deploy"
5. Copy the web app URL - you'll need this for webhooks

### 5. Get Transifex API Token

1. Log in to [Transifex](https://www.transifex.com)
2. Go to User Settings > API Token
3. Generate a new API token
4. Copy the token - you'll enter this in the web interface

### 6. Prepare Google Drive Folders

1. Create folders in Google Drive:
   - **Source folder**: Where you'll place files to translate
   - **Translations folder**: Where translated files will be saved
2. Get the folder IDs from the URLs:
   - Folder URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Copy the `FOLDER_ID_HERE` part

## Configuration

### 1. Initial Setup

1. Open the deployed web app URL
2. The first time you access it, you may need to authorize permissions:
   - Click "Advanced" if you see a security warning
   - Click "Go to [project name] (unsafe)"
   - Click "Allow" to grant necessary permissions

### 2. Configure Settings

1. **API Token**: Enter your Transifex API token
2. **Webhook Secret**: (Optional) Enter a secret for webhook security
3. **Check Interval**: Set how often to scan for file changes (default: 10 minutes)
4. **Webhook URL**: Copy this URL for Transifex webhook configuration
5. Click "Test Connection" to verify your API token
6. Click "Save Settings"

### 3. Add Source Folders

1. Click "Add Folder"
2. Fill in the form:
   - **Folder Name**: Descriptive name (e.g., "Marketing Materials")
   - **Source Folder ID**: Google Drive folder ID for source files
   - **Translations Folder ID**: Google Drive folder ID for translated files
   - **Organization**: Your Transifex organization slug
   - **Project**: Your Transifex project slug
   - **File Formats**: Select DOCX and/or XLSX
   - **Download Triggers**: Select when to download translations
3. Click "Add Folder"

### 4. Configure Transifex Webhooks

1. In Transifex, go to your project settings
2. Click "Webhooks"
3. Add a new webhook:
   - **URL**: Use the webhook URL from the web app
   - **Events**: Select the events matching your download triggers
   - **Secret**: Enter the same webhook secret from step 2 (if used)
4. Save the webhook

## Usage

### Adding Files for Translation

1. Place DOCX or XLSX files in your configured source folders
2. Wait for the next monitoring cycle (or manually refresh)
3. New files will appear in the "File Status" section with "Pending Mapping" status
4. Click "Map Resource" next to each file
5. Enter the Transifex resource ID (format: `o:org:p:project:r:resource`)
6. The file will be uploaded automatically

### Managing Translations

1. When translations are completed in Transifex, webhooks will trigger automatic downloads
2. Translated files will be saved to your translations folder
3. File names will include the language code (e.g., `document_ES.docx`)
4. You'll receive email notifications for completed translations

### Monitoring and Troubleshooting

1. **Activity Log**: Shows recent actions and any errors
2. **File Status**: Displays all tracked files and their mapping status
3. **Real-time Updates**: Interface refreshes automatically every 30 seconds
4. **Manual Actions**: Force folder scans, manual uploads/downloads available

## File Naming Convention

- **Source files**: Use clear, descriptive names (e.g., `marketing-brochure.docx`)
- **Translated files**: Automatically named as `{original-name}_{LANG}.{extension}`
- **Example**: `marketing-brochure.docx` → `marketing-brochure_ES.docx`

## Best Practices

### Folder Organization
```
📁 Project Source Files/
  ├── marketing-brochure.docx
  ├── product-specs.xlsx
  └── user-manual.docx

📁 Project Translations/
  ├── marketing-brochure_ES.docx
  ├── marketing-brochure_FR.docx
  ├── product-specs_ES.xlsx
  ├── product-specs_FR.xlsx
  ├── user-manual_ES.docx
  └── user-manual_FR.docx
```

### Transifex Resources
- Create descriptive resource names in Transifex
- Use consistent naming: `project-name_file-name`
- Example: `marketing_brochure`, `product_specs`

### Security
- Keep your API token secure and don't share it
- Use webhook secrets for additional security
- Regularly review access logs in both Google and Transifex

## Troubleshooting

### Common Issues

**"Invalid API token" error**
- Verify your Transifex API token is correct
- Check that the token has necessary permissions

**"Failed to export file" error**
- Ensure the file is accessible (not in trash, proper permissions)
- Check if the file is actually a Google Doc/Sheet (not uploaded Office file)

**"Webhook not working" error**
- Verify webhook URL matches the deployed web app URL
- Check webhook secret matches between Transifex and your settings
- Ensure webhook events are configured for your desired triggers

**Files not being detected**
- Check that files are in the correct folders
- Verify file formats match your folder configuration
- Check if monitoring trigger is active (may take up to configured interval)

### Getting Help

1. Check the Activity Log for specific error messages
2. Review Google Apps Script execution logs:
   - Go to script.google.com
   - Open your project
   - Click "Executions" to see detailed logs
3. Verify all services are properly enabled
4. Test individual components using the web interface

## Limitations

- **File Types**: Only DOCX (Google Docs) and XLSX (Google Sheets) supported
- **File Size**: Limited by Google Apps Script execution time (6 minutes)
- **API Calls**: Subject to Google Apps Script and Transifex API quotas
- **Real-time Sync**: Monitoring runs on configured intervals (not instant)
- **Concurrent Operations**: One file operation at a time to avoid conflicts

## Security Considerations

- Integration runs with owner permissions only
- API tokens stored encrypted in Google's PropertiesService
- Webhook signatures verified when secret is configured
- No sensitive data exposed in logs or error messages
- Files processed in memory without permanent storage

## Maintenance

### Regular Tasks
- Monitor activity logs for errors
- Update API tokens before expiration
- Review and clean up old translated files
- Check webhook configuration remains active

### Updates
- The integration will continue working with the deployed code
- To update functionality, redeploy the web app after making changes
- Configuration and file mappings persist across updates