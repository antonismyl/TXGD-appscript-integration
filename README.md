# Transifex-Google Drive Integration

A comprehensive Google Apps Script solution that provides automated bidirectional synchronization between Google Drive files and Transifex translation projects.

## 🌟 Features

- **Bidirectional Sync**: Google Drive ↔ Transifex with DOCX/XLSX support
- **Web-Based Configuration**: Modern interface, no code editing required
- **Smart Monitoring**: Configurable file scanning with change detection
- **Flexible Triggers**: Multiple completion events (translated, reviewed, proofread)
- **Security & Reliability**: Private deployment with comprehensive error handling

## 📁 Project Files

- `Code.gs` - Main application logic and web app handlers
- `FileOperations.gs` - Google Drive file export/import functions
- `TransifexAPI.gs` - Transifex API integration and webhook handling
- `index.html` - Web interface structure
- `styles.html` - CSS styling for web interface
- `script.html` - JavaScript functionality
- `SETUP.md` - Detailed installation guide
- `transifex-gdrive-integration-plan.md` - Technical implementation plan

## 🚀 Quick Start

1. **Create Google Apps Script project** at script.google.com
2. **Copy all files** into the project
3. **Enable Drive API** in Services and Google Cloud Console
4. **Deploy as web app** with owner-only access
5. **Configure via web interface** with Transifex API token
6. **Set up webhooks** in Transifex using provided URL

## 🎯 Key Capabilities

### File Processing
- Automatic DOCX/XLSX format conversion
- Intelligent file naming with language codes
- Folder-based organization and monitoring
- Duplicate upload prevention

### Translation Management
- Webhook-driven automatic downloads
- Multiple completion trigger support
- Email notifications for completed translations
- Manual upload/download capabilities

### Monitoring & Control
- Real-time web interface with 30-second updates
- Comprehensive activity logging
- Test connection functionality
- Manual file mapping and resource management
