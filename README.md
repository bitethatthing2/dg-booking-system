# Distinguished Gentleman Booking System

Online booking system for Distinguished Gentleman Barber.

## Features

* Online appointment booking
* Email confirmations for clients
* Barber notifications for new bookings
* Calendar view for appointments
* Mobile-friendly interface

## API Endpoints

The booking system provides the following API endpoints:

* `/.netlify/functions/api/available-barbers` - Get list of available barbers
* `/.netlify/functions/api/available-dates` - Get list of available dates
* `/.netlify/functions/api/available-times/:date/:barber?` - Get available times for a specific date (barber is optional)
* `/.netlify/functions/api/submit-booking` - Submit a new booking (POST)
* `/.netlify/functions/api/calendar-events` - Get calendar events for display

## Environment Setup

### Required Environment Variables:

* `GOOGLE_CREDENTIALS` - The JSON credentials for Google Sheets access
* `SPREADSHEET_ID` - The ID of your booking spreadsheet
* `EMAIL_USER` - Gmail address for sending confirmations
* `EMAIL_PASS` - Gmail app-specific password

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

## Deployment

This project is configured for Netlify deployment:

1. Connect your GitHub repository to Netlify
2. Add environment variables in Netlify settings
3. Deploy!

## License

Private - All Rights Reserved