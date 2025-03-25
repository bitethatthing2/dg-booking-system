require('dotenv').config();
const fs = require('fs');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

// Constants
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const PORT = process.env.API_PORT || 3002;

// Email configuration
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const app = express();

// Enable CORS for all routes
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Initialize email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ status: 'ok', message: 'Booking API server is running' }));
});

// Endpoint to get available times for a specific date
app.get('/available-times/:date/:barber?', async (req, res) => {
  console.log(`Getting available times for date: ${req.params.date}, barber: ${req.params.barber || 'any'}`);
  
  try {
    // Load credentials
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // Get the Available_Times data
    console.log(`Attempting to fetch Available_Times data from spreadsheet: ${SPREADSHEET_ID}`);
    const availabilityResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Available_Times!A1:E1000',
    });
    
    if (!availabilityResponse.data.values) {
      console.log('No data found in Available_Times sheet');
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).send(JSON.stringify({ error: 'No availability data found' }));
    }
    
    console.log(`Retrieved ${availabilityResponse.data.values.length} rows from Available_Times sheet`);
    const availabilityData = availabilityResponse.data.values;
    const headers = availabilityData[0];
    console.log(`Headers: ${headers.join(', ')}`);
    
    // Find column indices
    const dateIndex = headers.findIndex(header => header.trim().toLowerCase().includes('date'));
    const timeIndex = headers.findIndex(header => header.trim().toLowerCase().includes('time'));
    const barberIndex = headers.findIndex(header => header.trim().toLowerCase().includes('barber'));
    const statusIndex = headers.findIndex(header => header.trim().toLowerCase() === 'status');
    
    console.log(`Column indices - Date: ${dateIndex}, Time: ${timeIndex}, Barber: ${barberIndex}, Status: ${statusIndex}`);
    
    if (dateIndex === -1 || timeIndex === -1 || barberIndex === -1 || statusIndex === -1) {
      console.log('Required columns not found in Available_Times sheet');
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).send(JSON.stringify({ error: 'Required columns not found in availability data' }));
    }
    
    // Filter available times for the specified date and barber
    const targetDate = req.params.date;
    const targetBarber = req.params.barber;
    
    console.log(`Filtering for date: ${targetDate}, barber: ${targetBarber || 'any'}`);
    const availableTimes = [];
    for (let i = 1; i < availabilityData.length; i++) {
      const row = availabilityData[i];
      if (row.length <= dateIndex || row.length <= timeIndex || 
          row.length <= barberIndex || row.length <= statusIndex) {
        console.log(`Skipping row ${i+1}: insufficient columns (row length: ${row.length})`);
        continue;
      }
      
      if (row[dateIndex] === targetDate && 
          row[statusIndex]?.trim().toLowerCase() === 'available' && 
          (!targetBarber || row[barberIndex] === targetBarber)) {
        availableTimes.push({
          time: row[timeIndex],
          barber: row[barberIndex]
        });
      }
    }
    
    // Sort by time
    availableTimes.sort((a, b) => {
      const timeA = new Date(`1/1/2000 ${a.time}`);
      const timeB = new Date(`1/1/2000 ${b.time}`);
      return timeA - timeB;
    });
    
    console.log(`Found ${availableTimes.length} available times for ${targetDate}`);
    
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ date: targetDate, availableTimes }));
    
  } catch (error) {
    console.error('Error getting available times:', error.message);
    console.error('Error stack:', error.stack);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).send(JSON.stringify({ error: 'Internal server error', details: error.message }));
  }
});

// Endpoint to get available barbers
app.get('/available-barbers', async (req, res) => {
  console.log('Getting available barbers');
  
  try {
    // Load credentials
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // Get the Available_Times data
    const availabilityResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Available_Times!A1:E1000',
    });
    
    if (!availabilityResponse.data.values) {
      console.log('No data found in Available_Times sheet');
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).send(JSON.stringify({ error: 'No availability data found' }));
    }
    
    const availabilityData = availabilityResponse.data.values;
    const headers = availabilityData[0];
    
    // Find barber column index
    const barberIndex = headers.findIndex(header => header.trim().toLowerCase().includes('barber'));
    
    if (barberIndex === -1) {
      console.log('Barber column not found in Available_Times sheet');
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).send(JSON.stringify({ error: 'Barber column not found in availability data' }));
    }
    
    // Get unique barbers
    const barbers = new Set();
    for (let i = 1; i < availabilityData.length; i++) {
      const row = availabilityData[i];
      if (row[barberIndex]) {
        barbers.add(row[barberIndex]);
      }
    }
    
    console.log(`Found ${barbers.size} barbers: ${Array.from(barbers).join(', ')}`);
    
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ barbers: Array.from(barbers).sort() }));
    
  } catch (error) {
    console.error('Error getting available barbers:', error.message);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).send(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Endpoint to get available dates
app.get('/available-dates/:barber?', async (req, res) => {
  console.log(`Getting available dates for barber: ${req.params.barber || 'any'}`);
  
  try {
    // Load credentials
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // Get the Available_Times data
    const availabilityResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Available_Times!A1:E1000',
    });
    
    if (!availabilityResponse.data.values) {
      console.log('No data found in Available_Times sheet');
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).send(JSON.stringify({ error: 'No availability data found' }));
    }
    
    const availabilityData = availabilityResponse.data.values;
    const headers = availabilityData[0];
    
    // Find column indices
    const dateIndex = headers.findIndex(header => header.trim().toLowerCase().includes('date'));
    const barberIndex = headers.findIndex(header => header.trim().toLowerCase().includes('barber'));
    const statusIndex = headers.findIndex(header => header.trim().toLowerCase() === 'status');
    
    if (dateIndex === -1 || barberIndex === -1 || statusIndex === -1) {
      console.log('Required columns not found in Available_Times sheet');
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).send(JSON.stringify({ error: 'Required columns not found in availability data' }));
    }
    
    // Filter available dates for the specified barber
    const targetBarber = req.params.barber;
    
    const availableDates = new Set();
    for (let i = 1; i < availabilityData.length; i++) {
      const row = availabilityData[i];
      if (row[statusIndex]?.trim().toLowerCase() === 'available' && 
          (!targetBarber || row[barberIndex] === targetBarber)) {
        availableDates.add(row[dateIndex]);
      }
    }
    
    // Convert to array and sort
    const dates = Array.from(availableDates);
    dates.sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA - dateB;
    });
    
    console.log(`Found ${dates.length} available dates`);
    
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ dates }));
    
  } catch (error) {
    console.error('Error getting available dates:', error.message);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).send(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Endpoint to submit a booking
app.post('/submit-booking', async (req, res) => {
  console.log('Booking submission received:', req.body);
  
  try {
    // Check required fields
    const { barber, service, date, time, name, email, phone } = req.body;
    
    if (!barber || !service || !date || !time || !name) {
      console.log('Missing required fields in booking submission');
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).send(JSON.stringify({ error: 'Missing required fields', success: false }));
    }
    
    // Load credentials
    console.log('Loading Google API credentials');
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // First, check if the time slot is still available
    console.log(`Checking availability for ${date} at ${time} with ${barber}`);
    const availabilityResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Available_Times!A1:E1000',
    });
    
    if (!availabilityResponse.data.values) {
      console.log('No data found in Available_Times sheet');
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).send(JSON.stringify({ error: 'Could not verify availability', success: false }));
    }
    
    console.log(`Retrieved ${availabilityResponse.data.values.length} rows from Available_Times sheet`);
    const availabilityData = availabilityResponse.data.values;
    const headers = availabilityData[0];
    console.log(`Headers: ${headers.join(', ')}`);
    
    // Find column indices
    const dateIndex = headers.findIndex(header => header.trim().toLowerCase().includes('date'));
    const timeIndex = headers.findIndex(header => header.trim().toLowerCase().includes('time'));
    const barberIndex = headers.findIndex(header => header.trim().toLowerCase().includes('barber'));
    const statusIndex = headers.findIndex(header => header.trim().toLowerCase() === 'status');
    const rowIndex = headers.findIndex(header => header.trim().toLowerCase() === 'row');
    
    console.log(`Column indices - Date: ${dateIndex}, Time: ${timeIndex}, Barber: ${barberIndex}, Status: ${statusIndex}, Row: ${rowIndex}`);
    
    if (dateIndex === -1 || timeIndex === -1 || barberIndex === -1 || statusIndex === -1) {
      console.log('Required columns not found in Available_Times sheet');
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).send(JSON.stringify({ error: 'Required columns not found', success: false }));
    }
    
    // Find the matching time slot
    let rowToUpdate = -1;
    for (let i = 1; i < availabilityData.length; i++) {
      const row = availabilityData[i];
      
      if (row.length <= dateIndex || row.length <= timeIndex || 
          row.length <= barberIndex || row.length <= statusIndex) {
        console.log(`Skipping row ${i+1}: insufficient columns (row length: ${row.length})`);
        continue;
      }
      
      if (row[dateIndex] === date && 
          row[timeIndex] === time && 
          row[barberIndex] === barber && 
          row[statusIndex]?.trim().toLowerCase() === 'available') {
        rowToUpdate = i;
        console.log(`Found matching available time slot at row ${i+1}`);
        break;
      }
    }
    
    if (rowToUpdate === -1) {
      console.log('Time slot not available');
      res.setHeader('Content-Type', 'application/json');
      return res.status(409).send(JSON.stringify({ error: 'Time slot not available', success: false }));
    }
    
    // Update the status to "Booked"
    console.log(`Updating status to "Booked" at row ${rowToUpdate + 1}, column ${String.fromCharCode(65 + statusIndex)}`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Available_Times!${String.fromCharCode(65 + statusIndex)}${rowToUpdate + 1}`,
      valueInputOption: 'RAW',
      resource: {
        values: [['Booked']]
      }
    });
    
    console.log(`Updated status to Booked for row ${rowToUpdate + 1}`);
    
    // Add the booking to Form Responses sheet
    const currentDate = new Date().toLocaleString();
    console.log('Retrieving Form Responses sheet');
    const formResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Form Responses!A1:G1000',
    });
    
    let responseHeaders = [];
    if (formResponse.data.values && formResponse.data.values.length > 0) {
      responseHeaders = formResponse.data.values[0];
      console.log(`Form Responses headers: ${responseHeaders.join(', ')}`);
    } else {
      // Create headers if they don't exist
      console.log('No existing Form Responses data, creating headers');
      responseHeaders = ['Timestamp', 'Name', 'Email', 'Barber', 'Service', 'Date', 'Time'];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Form Responses!A1:G1',
        valueInputOption: 'RAW',
        resource: {
          values: [responseHeaders]
        }
      });
    }
    
    // Add the new booking
    console.log(`Adding booking for ${name} to Form Responses sheet`);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Form Responses!A1:G1000',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[currentDate, name, email, barber, service, date, time]]
      }
    });
    
    console.log('Added booking to Form Responses sheet');
    
    // After successful booking, send confirmation email
    if (email) {
      console.log('=== Email Configuration ===');
      console.log('Email User:', EMAIL_USER);
      console.log('Email Pass:', EMAIL_PASS ? 'Set' : 'Not Set');
      
      console.log(`Preparing confirmation email to ${email}...`);
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
      
      // Send confirmation email to client
      console.log('Preparing confirmation email to ' + email + '...');
      const emailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Appointment Confirmation',
        text: emailBody,
        html: emailBody.replace(/\n/g, '<br>')
      };

      console.log('Attempting to send email with options:', emailOptions);
      await transporter.sendMail(emailOptions);
      console.log('Confirmation email sent successfully to ' + email);

      // Send notification to barber
      console.log('Preparing barber notification email...');
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

      console.log('Attempting to send barber notification...');
      await transporter.sendMail(barberEmailOptions);
      console.log('Barber notification sent successfully');
    } else {
      console.log('No email address provided, skipping confirmation email');
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ 
      success: true, 
      message: 'Booking confirmed',
      booking: {
        name,
        email,
        barber,
        service,
        date,
        time
      }
    }));
    
  } catch (error) {
    console.error('Error submitting booking:', error.message);
    console.error('Error stack:', error.stack);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).send(JSON.stringify({ error: 'Internal server error', details: error.message, success: false }));
  }
});

// Endpoint to fetch calendar events
app.get('/calendar-events', async (req, res) => {
  try {
    console.log('Fetching calendar events...');
    const auth = await loadCredentials();
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Fetch booked appointments from Form Responses sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Form Responses',
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    
    // Find column indices
    const nameIndex = headers.indexOf('Name');
    const dateIndex = headers.indexOf('Date');
    const timeIndex = headers.indexOf('Time');
    const serviceIndex = headers.indexOf('Service');
    
    // Convert sheet data to calendar events
    const events = rows.slice(1).map(row => {
      const date = row[dateIndex];
      const time = row[timeIndex];
      const name = row[nameIndex];
      const service = row[serviceIndex];
      
      // Combine date and time for start
      const startDate = new Date(`${date} ${time}`);
      // Add 1 hour for end time
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

// Add CORS headers for the calendar
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Start the server
app.listen(PORT, () => {
  console.log(`Booking API server running on port ${PORT}`);
  console.log('Available API endpoints:');
  console.log(`- GET http://localhost:${PORT}/health`);
  console.log(`- GET http://localhost:${PORT}/available-barbers`);
  console.log(`- GET http://localhost:${PORT}/available-dates/:barber?`);
  console.log(`- GET http://localhost:${PORT}/available-times/:date/:barber?`);
  console.log(`- POST http://localhost:${PORT}/submit-booking`);
  console.log(`- GET http://localhost:${PORT}/calendar-events`);
}); 