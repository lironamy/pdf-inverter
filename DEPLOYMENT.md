# Deployment Guide

## Vercel Deployment

This app is optimized for Vercel deployment. Here's what you need to know:

### Features
- ✅ **JavaScript Fallback**: Works in serverless environments
- ✅ **File Size Limits**: Handles files up to 50MB
- ✅ **Error Handling**: Proper JSON error responses
- ✅ **Multiple Processing Modes**: Reading, Printing, Presentation

### Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Connect your GitHub repo to Vercel
   - The app will automatically deploy
   - No additional configuration needed

### How It Works in Production

- **Python Processing**: Available via Vercel Python functions!
- **JavaScript Processing**: Used as fallback if Python fails
- **All Modes Work**: Reading, Printing, and Presentation modes all function
- **Performance**: True color inversion with Python, fast fallback with JavaScript

### File Size Limits

- **Maximum**: 15MB per file (extended limit)
- **Recommended**: Under 8MB for best performance
- **Error Handling**: Clear messages for oversized files
- **Client-side validation**: Checks file size before upload
- **Large files optimization**: Automatic DPI reduction for files >10MB
- **Large files tip**: Split PDF into separate pages if needed

### Troubleshooting

If you see errors:
1. **404 Error**: API route not found - check deployment logs
2. **413 Error**: File too large - reduce file size
3. **JSON Parse Error**: Server error - check API route configuration

The app is designed to work reliably in production environments!
