# Distinguished Gentleman Booking System

Online booking system for Distinguished Gentleman Barber.

## Features

- Online appointment booking
- Email confirmations for clients
- Barber notifications for new bookings
- Calendar view for appointments
- Mobile-friendly interface

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
SPREADSHEET_ID=your-google-sheets-id
```

3. Set up Google Sheets API:
- Place your `credentials.json` in the root directory
- Run the app once to generate `token.json`

## Development

Run both servers in development:
```bash
npm run dev
```

Or run them separately:
```bash
# API Server
npm start

# Form Server
npm run serve
```

## Deployment

This project is configured for Netlify deployment:

1. Connect your GitHub repository to Netlify
2. Add environment variables in Netlify settings
3. Deploy!

## Environment Variables

- `EMAIL_USER`: Gmail address for sending confirmations
- `EMAIL_PASS`: Gmail app-specific password
- `SPREADSHEET_ID`: Google Sheets ID for storing bookings

## License

Private - All Rights Reserved 