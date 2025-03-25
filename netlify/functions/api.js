const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Create a router instead of using app directly
const router = express.Router();

// Move all routes to use router instead of app
router.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ 
    success: true, 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Google Sheets setup
async function loadCredentials() {
  try {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  } catch (error) {
    console.error('Error loading credentials:', error);
    throw error;
  }
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// API Routes - using router instead of app
router.get('/available-barbers', async (req, res) => {
  try {
    console.log('Fetching available barbers...');
    console.log('Loading credentials...');
    const auth = await loadCredentials();
    console.log('Credentials loaded successfully');
    
    console.log('Initializing Google Sheets...');
    const sheets = google.sheets({ version: 'v4', auth });
    console.log('Google Sheets initialized');
    
    console.log('Fetching data from spreadsheet...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Barbers',
    });
    console.log('Spreadsheet data fetched successfully');

    const barbers = response.data.values.slice(1).map(row => row[0]);
    console.log('Barbers found:', barbers);
    res.json({ barbers });
  } catch (error) {
    console.error('Detailed error in /available-barbers:', {
      message: error.message,
      stack: error.stack,
      spreadsheetId: SPREADSHEET_ID,
      googleCredentialsExist: !!process.env.GOOGLE_CREDENTIALS
    });
    res.status(500).json({ error: 'Failed to fetch barbers', details: error.message });
  }
});

router.get('/available-dates/:barber?', async (req, res) => {
  try {
    const auth = await loadCredentials();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Availability',
    });

    let dates = response.data.values.slice(1).map(row => row[0]);
    res.json({ dates });
  } catch (error) {
    console.error('Error fetching dates:', error);
    res.status(500).json({ error: 'Failed to fetch dates' });
  }
});

router.get('/available-times/:date/:barber?', async (req, res) => {
  try {
    const { date, barber } = req.params;
    const auth = await loadCredentials();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Availability',
    });

    const rows = response.data.values;
    const dateIndex = rows.findIndex(row => row[0] === date);
    
    if (dateIndex === -1) {
      return res.json({ availableTimes: [] });
    }

    const times = rows[dateIndex].slice(1).filter(time => time !== '');
    const availableTimes = times.map(time => ({
      time,
      barber: barber || 'Any barber'
    }));
    res.json({ availableTimes });
  } catch (error) {
    console.error('Error fetching times:', error);
    res.status(500).json({ error: 'Failed to fetch times' });
  }
});

router.post('/submit-booking', async (req, res) => {
  try {
    const { barber, service, date, time, name, email, phone } = req.body;
    
    if (!barber || !service || !date || !time || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const auth = await loadCredentials();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Add booking to sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Form Responses',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[name, email, phone, date, time, barber, service]]
      }
    });

    // Send confirmation emails
    if (email) {
      const emailBody = `
Dear ${name},

Your appointment has been confirmed!

Details:
- Date: ${date}
- Time: ${time}
- Barber: ${barber}
- Service: ${service}

Need to reschedule or cancel? Please call (503) 400-8151.

Download our app at dgbarbers.com
iOS users: Click share button and "Add to Home Screen", then enable notifications
Android users: Install via main menu "Android Installation"

Thank you for choosing our service!

Michael Kahler, Barber
Distinguished Gentleman
      `;

      const emailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Appointment Confirmation',
        text: emailBody,
        html: emailBody.replace(/\n/g, '<br>')
      };

      await transporter.sendMail(emailOptions);

      // Send notification to barber
      const barberNotificationBody = `
New Booking Alert!

Booking Details:
- Client: ${name}
- Date: ${date}
- Time: ${time}
- Service: ${service}
- Client Phone: ${phone}
- Client Email: ${email}
`;

      const barberEmailOptions = {
        from: process.env.EMAIL_USER,
        to: 'gthabarber1@gmail.com',
        subject: 'New Booking Alert',
        text: barberNotificationBody
      };

      await transporter.sendMail(barberEmailOptions);
    }

    res.json({ success: true, message: 'Booking submitted successfully' });
  } catch (error) {
    console.error('Error submitting booking:', error);
    res.status(500).json({ success: false, error: 'Failed to submit booking' });
  }
});

router.get('/calendar-events', async (req, res) => {
  try {
    const auth = await loadCredentials();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Form Responses',
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];
    
    const nameIndex = headers.indexOf('Name');
    const dateIndex = headers.indexOf('Date');
    const timeIndex = headers.indexOf('Time');
    const serviceIndex = headers.indexOf('Service');
    
    const events = rows.slice(1).map(row => {
      const date = row[dateIndex];
      const time = row[timeIndex];
      const name = row[nameIndex];
      const service = row[serviceIndex];
      
      const startDate = new Date(`${date} ${time}`);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      
      return {
        title: `${name}`,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        extendedProps: {
          service: service
        }
      };
    });
    
    res.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Mount the router on the app
app.use('/.netlify/functions/api', router);

// Export the serverless handler
module.exports.handler = serverless(app);
