# Production Setup Guide

This document outlines the steps needed to ensure your booking system is properly set up for production.

## 1. Environment Variables

Ensure the following environment variables are set in your Netlify dashboard:

```
GOOGLE_CREDENTIALS={"type":"service_account",...} # Your full service account JSON
SPREADSHEET_ID=1GwdJssNZR54l3LI9UMeuRN5G5YwQXVlzmIrDWzOJY90
EMAIL_USER=gthabarber1@gmail.com
EMAIL_PASS=your-app-password
```

## 2. Google Sheet Structure

The booking system relies on a specific Google Sheet structure:

### Available_Times Sheet
- Column A: Date
- Column B: Time
- Column C: Barber
- Column D: Status (Available/Booked)
- Column E: Row number (optional)

## 3. Netlify Configuration

The netlify.toml file already contains:

```toml
[build]
  command = "npm install"
  functions = "netlify/functions"
  publish = "."

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/booking-form.html"
  status = 200
```

## 4. Testing Endpoints

After deployment, test each endpoint:
- `/.netlify/functions/api/test`
- `/.netlify/functions/api/available-barbers`
- `/.netlify/functions/api/available-dates`
- `/.netlify/functions/api/available-times/YYYY-MM-DD`

## 5. Backup & Recovery

Regularly backup your Google Sheet to prevent data loss.

## 6. Maintenance

1. **Daily Checks**: Verify that the booking system is working correctly
2. **Weekly**: Review the logs in Netlify for any errors
3. **Monthly**: Check your Google service account credentials for expiration

## 7. Troubleshooting

If you encounter issues:

1. Check Netlify function logs for errors
2. Verify environment variables are set correctly
3. Ensure the Google Sheet structure matches expectations
4. Confirm that your service account has access to the spreadsheet

## 8. Support Contacts

For further assistance, contact:
- Technical Support: [Your Contact Info]
- Google Sheet Issues: [Your Contact Info]