const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Add a simple test endpoint for debugging
app.get('/test', (req, res) => {
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
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// API Routes
app.get('/available-barbers', async (req, res) => {
  try {
    console.log('Fetching available barbers...');
    const auth = await loadCredentials();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Barbers',
    });

    const barbers = response.data.values.slice(1).map(row => row[0]);
    console.log('Barbers found:', barbers);
    res.json({ barbers });
  } catch (error) {
    console.error('Error fetching barbers:', error);
    res.status(500).json({ error: 'Failed to fetch barbers' });
  }
});

app.get('/available-dates/:barber?', async (req, res) => {
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

app.get('/available-times/:date/:barber?', async (req, res) => {
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

app.post('/submit-booking', async (req, res) => {
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