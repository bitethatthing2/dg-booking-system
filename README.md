# Barber Shop Booking System

A booking system for a barber shop featuring appointment scheduling, service selection, and calendar integration.

## Project Structure

```
dg-booking-system/
├── .git/                   # Git repository data
├── css/                    # CSS styles
│   └── styles.css          # Main stylesheet with variables and components
├── js/                     # JavaScript files
│   └── booking.js          # Main booking functionality
├── netlify/                # Netlify deployment files
│   └── functions/          # Serverless functions
│       ├── api.js          # Main API handler for booking operations
│       ├── node_modules/   # Function dependencies 
│       ├── package.json    # Function dependencies definition
│       └── package-lock.json # Locked versions of dependencies
├── node_modules/           # Project dependencies
├── booking-form.html       # Main booking form
├── calendar.html           # Calendar view for administrators
├── index.html              # Site entry point
├── netlify.toml            # Netlify configuration
├── package.json            # Project dependencies and scripts
├── package-lock.json       # Locked versions of dependencies
├── serve-form.js           # Local development server
├── PRODUCTION_SETUP.md     # Production deployment instructions
└── README.md               # This file
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Email credentials
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Google Sheets credentials
GOOGLE_CLIENT_EMAIL=your-service-account@googleserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
SPREADSHEET_ID=your-spreadsheet-id
CALENDAR_ID=your-calendar-id
```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Setup your Google credentials:
   - Create a service account in Google Cloud Console
   - Download the credentials JSON file
   - Add the necessary environment variables to your `.env` file

3. Run the local development server:
   ```bash
   node serve-form.js
   ```

4. To test the Netlify functions locally, install the Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

5. Run the Netlify dev server:
   ```bash
   netlify dev
   ```

## Production Deployment

See [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md) for detailed instructions on deploying to Netlify.

## Features

- Online appointment booking
- Service selection
- Barber selection
- Date and time availability
- Email confirmations
- Google Calendar integration
- Mobile-friendly responsive design

## API Endpoints

The booking system provides the following API endpoints:

* `/.netlify/functions/api/available-barbers` - Get list of available barbers
* `/.netlify/functions/api/available-dates` - Get list of available dates
* `/.netlify/functions/api/available-times/:date/:barber?` - Get available times for a specific date (barber is optional)
* `/.netlify/functions/api/submit-booking` - Submit a new booking (POST)
* `/.netlify/functions/api/calendar-events` - Get calendar events for display

## Google Sheets Structure

The system works with a Google Sheet that has the following structure:

### Available_Times Sheet
Contains all appointment slots with:
* Column A: Date
* Column B: Time
* Column C: Barber
* Column D: Status (Available/Booked)
* Column E: Row number (optional)

### Form Responses Sheet (Optional)
Stores detailed booking information:
* Client Name
* Email
* Phone
* Date
* Time
* Barber
* Service

## License

Private - All Rights Reserved