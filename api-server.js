require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

// Constants
const PORT = process.env.PORT || 3002;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || process.env.SHEET_ID || '1GwdJssNZR54l3LI9UMeuRN5G5YwQXVlzmIrDWzOJY90';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'gthabarber1@gmail.com';

// Email configuration
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const app = express();

// Enable CORS for all routes with specific origins
app.use(cors({
  origin: ['https://dgbarbers.com', 'https://www.dgbarbers.com', 'https://booking1231.netlify.app', 'http://localhost:8080'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept']
}));

// Production security middleware
if (IS_PRODUCTION) {
  const helmet = require('helmet');
  app.use(helmet());
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://www.googleapis.com"],
    },
  }));
  
  // Rate limiting
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  });
  app.use(limiter);
}

// Parse JSON request bodies
app.use(express.json());

// Initialize email transporter
const transporter = EMAIL_USER && EMAIL_PASS ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
}) : null;

// Get Google authentication
async function getGoogleAuth() {
  try {
    // In production (Netlify), we use the environment variables directly
    if (IS_PRODUCTION) {
      const credentials = {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      };
      
      if (!credentials.client_email || !credentials.private_key) {
        console.error('Missing required Google credentials in production environment');
        return null;
      }

      return new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events'
        ]
      );
    }

    // Development environment handling
    if (process.env.GOOGLE_CREDENTIALS) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        return new google.auth.JWT(
          credentials.client_email,
          null,
          credentials.private_key,
          [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
          ]
        );
      } catch (e) {
        console.error('Error parsing GOOGLE_CREDENTIALS:', e);
      }
    }
    
    console.error('No valid Google credentials configuration found');
    return null;
  } catch (error) {
    console.error('Error setting up Google Auth:', error);
    return null;
  }
}

// Helper function to load sheet data
async function loadSheetData() {
  try {
    const auth = await getGoogleAuth();
    if (!auth) {
      console.error('No auth available for loading sheet data');
      return [];
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Available_Times!A:D'
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return []; // Return empty array if only header or no data

    // Skip header row and map data
    return rows.slice(1).map(row => ({
      date: row[0],
      time: row[1],
      barber: row[2],
      isAvailable: row[3]?.toLowerCase() === 'available'
    }));
  } catch (error) {
    console.error('Error loading sheet data:', error);
    return [];
  }
}

// Helper function to update availability
async function updateAvailability(date, time, barber, isAvailable) {
  try {
    const auth = await getGoogleAuth();
    if (!auth) {
      console.error('No auth available for updating availability');
      return false;
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // First, find the row to update
    const data = await loadSheetData();
    const matchingRow = data.findIndex(row => 
      row.date === date && 
      row.time === time && 
      row.barber === barber
    );

    if (matchingRow === -1) {
      console.error('No matching row found for', { date, time, barber });
      return false;
    }

    // Add 2 to account for 0-based index and header row
    const rowToUpdate = matchingRow + 2;
    
    // Update the sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Available_Times!D${rowToUpdate}`,
      valueInputOption: 'RAW',
      resource: {
        values: [[isAvailable ? 'Available' : 'Booked']]
      }
    });

    console.log(`Updated availability for ${date} ${time} with ${barber} to ${isAvailable ? 'Available' : 'Booked'}`);
    return true;
  } catch (error) {
    console.error('Error updating availability:', error);
    return false;
  }
}

// Add booking to Google Sheets
async function addBookingToSheet(booking) {
  try {
    const auth = await getGoogleAuth();
    if (!auth) {
      console.error('No auth available for adding booking');
      return false;
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Get timestamp
    const timestamp = new Date().toISOString();
    
    // Prepare the row data
    const values = [
      [timestamp, booking.name, booking.email, booking.barber, booking.service, booking.date, booking.time, booking.phone || '']
    ];
    
    // Append the row to the Form Responses sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Form Responses',
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
    
    console.log(`Booking added to sheet for ${booking.name} on ${booking.date} at ${booking.time}`);
    return true;
  } catch (error) {
    console.error('Error adding booking to sheet:', error);
    return false;
  }
}

// Function to send confirmation email
async function sendConfirmationEmail(booking) {
  if (!transporter || !booking.email) return false;
  
  try {
    const emailContent = `
      <h1>Booking Confirmation</h1>
      <p>Hello ${booking.name},</p>
      <p>Your appointment has been confirmed with the following details:</p>
      <ul>
        <li><strong>Date:</strong> ${booking.date}</li>
        <li><strong>Time:</strong> ${booking.time}</li>
        <li><strong>Barber:</strong> ${booking.barber}</li>
        <li><strong>Service:</strong> ${booking.service}</li>
      </ul>
      <p>If you need to reschedule or cancel, please contact us.</p>
      <p>Thank you for choosing our services!</p>
    `;
    
    // Email to customer
    const customerMailOptions = {
      from: EMAIL_USER,
      to: booking.email,
      subject: 'Barber Appointment Confirmation',
      html: emailContent
    };
    
    await transporter.sendMail(customerMailOptions);
    
    // Create email content for barber notification
    const barberEmailContent = `
      <h1>New Booking Alert</h1>
      <p>A new appointment has been booked:</p>
      <ul>
        <li><strong>Customer:</strong> ${booking.name}</li>
        <li><strong>Date:</strong> ${booking.date}</li>
        <li><strong>Time:</strong> ${booking.time}</li>
        <li><strong>Service:</strong> ${booking.service}</li>
        <li><strong>Contact Email:</strong> ${booking.email}</li>
        <li><strong>Phone:</strong> ${booking.phone || 'Not provided'}</li>
      </ul>
    `;
    
    // Email to barber/shop
    const barberMailOptions = {
      from: EMAIL_USER,
      to: EMAIL_USER, // Send to the shop's email
      subject: `New Appointment: ${booking.date} at ${booking.time}`,
      html: barberEmailContent
    };
    
    await transporter.sendMail(barberMailOptions);
    
    console.log(`Confirmation email sent to ${booking.email}`);
    return true;
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return false;
  }
}

// Add event to Google Calendar
async function addToGoogleCalendar(booking) {
  try {
    const auth = await getGoogleAuth();
    if (!auth) {
      console.error('No auth available for calendar');
      return null;
    }

    const calendar = google.calendar({ version: 'v3', auth });
    
    // Calculate end time based on service
    const startDateTime = new Date(`${booking.date} ${booking.time}`);
    
    // Calculate duration based on service
    let durationInMinutes = 60; // default duration
    if (booking.service.includes('Beard Trim') && !booking.service.includes('Haircut')) {
      durationInMinutes = 30;
    } else if (booking.service.includes('Hair Enhancement (Temporary)')) {
      durationInMinutes = 15;
    } else if (booking.service.includes('Haircut, Beard Trim & Straight Razor Shave')) {
      durationInMinutes = 90;
    }
    
    const endDateTime = new Date(startDateTime.getTime() + durationInMinutes * 60 * 1000);

    // Color coding based on service type
    let colorId;
    switch(true) {
      case booking.service.includes('Haircut') && booking.service.includes('Beard'):
        colorId = '6'; // Tangerine for combo services
        break;
      case booking.service.includes('Haircut'):
        colorId = '11'; // Tomato for haircuts
        break;
      case booking.service.includes('Beard'):
        colorId = '2'; // Sage for beard services
        break;
      case booking.service.includes('Enhancement'):
        colorId = '7'; // Peacock for enhancements
        break;
      case booking.service.includes('Shave'):
        colorId = '9'; // Blueberry for shaves
        break;
      default:
        colorId = '1'; // Lavender for other services
    }

    const event = {
      summary: `${booking.service} - ${booking.name}`,
      description: `Service: ${booking.service}\nBarber: ${booking.barber}\nClient: ${booking.name}\nPhone: ${booking.phone || 'Not provided'}\nEmail: ${booking.email || 'Not provided'}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: process.env.TIMEZONE || 'America/New_York',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: process.env.TIMEZONE || 'America/New_York',
      },
      attendees: booking.email ? [{ email: booking.email }] : [],
      colorId: colorId,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
      visibility: 'private',
      transparency: 'opaque',
    };

    try {
      const response = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        resource: event,
        sendUpdates: 'all',
      });

      if (IS_PRODUCTION) {
        console.log('Production calendar event created:', {
          eventId: response.data.id,
          summary: event.summary,
          start: event.start.dateTime,
          calendarId: CALENDAR_ID
        });
      } else {
        console.log('Event created:', response.data.htmlLink);
      }

      return response.data.htmlLink;
    } catch (calendarError) {
      console.error('Calendar API Error:', calendarError);
      if (IS_PRODUCTION) {
        console.error('Production Calendar Error Details:', {
          code: calendarError.code,
          message: calendarError.message,
          errors: calendarError.errors,
          timestamp: new Date().toISOString(),
          calendarId: CALENDAR_ID
        });
      }
      return null;
    }
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  console.log('Health check requested');
  
  let calendarAccess = false;
  try {
    const auth = await getGoogleAuth();
    if (auth) {
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.calendarList.list({ maxResults: 1 });
      calendarAccess = true;
    }
  } catch (error) {
    console.error('Calendar access check failed:', error);
  }
  
  res.json({ 
    status: 'ok', 
    message: 'Booking API server is running',
    hasAuth: !!process.env.GOOGLE_CREDENTIALS || (!!process.env.GOOGLE_CLIENT_EMAIL && !!process.env.GOOGLE_PRIVATE_KEY),
    hasEmail: !!transporter,
    hasCalendarAccess: calendarAccess
  });
});

// Endpoint to get available barbers
app.get('/available-barbers', async (req, res) => {
  console.log('Getting available barbers');
  
  try {
    const data = await loadSheetData();
    const barbers = [...new Set(data.filter(row => row.isAvailable).map(row => row.barber))];
    
    console.log(`Found ${barbers.length} barbers: ${barbers.join(', ')}`);
    
    res.json({ barbers });
    
  } catch (error) {
    console.error('Error getting barbers:', error);
    res.status(500).json({ error: 'Failed to fetch barbers' });
  }
});

// Endpoint to get available dates
app.get('/available-dates/:barber?', async (req, res) => {
  const barber = req.params.barber;
  console.log(`Getting available dates for barber: ${barber || 'any'}`);
  
  try {
    const data = await loadSheetData();
    
    let availableDates = data
      .filter(row => row.isAvailable && (!barber || row.barber === barber))
      .map(row => row.date);
    
    // Remove duplicates and sort
    availableDates = [...new Set(availableDates)].sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA - dateB;
    });
    
    console.log(`Found ${availableDates.length} available dates`);
    
    res.json({ dates: availableDates });
    
  } catch (error) {
    console.error('Error getting dates:', error);
    res.status(500).json({ error: 'Failed to fetch dates' });
  }
});

// Endpoint to get available times for a specific date
app.get('/available-times/:date/:barber?', async (req, res) => {
  console.log(`Getting available times for date: ${req.params.date}, barber: ${req.params.barber || 'any'}`);
  
  try {
    const data = await loadSheetData();
    
    const availableTimes = data
      .filter(row => 
        row.date === req.params.date && 
        row.isAvailable && 
        (!req.params.barber || row.barber === req.params.barber)
      )
      .map(row => ({
        time: row.time,
        barber: row.barber
      }))
      .sort((a, b) => {
        // Convert to 24h format for sorting
        const to24h = (timeStr) => {
          const [time, period] = timeStr.split(' ');
          let [hours, minutes] = time.split(':').map(Number);
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          return hours * 60 + minutes;
        };
        
        return to24h(a.time) - to24h(b.time);
      });
    
    console.log(`Found ${availableTimes.length} available times for ${req.params.date}`);
    
    res.json({ availableTimes });
    
  } catch (error) {
    console.error('Error getting times:', error);
    res.status(500).json({ error: 'Failed to fetch times' });
  }
});

// Endpoint to submit booking
app.post('/submit-booking', async (req, res) => {
  const booking = req.body;
  
  try {
    // First update availability
    const availabilityUpdated = await updateAvailability(booking.date, booking.time, booking.barber, false);
    if (!availabilityUpdated) {
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to update availability' 
      });
    }

    // Add booking to sheet
    const bookingAdded = await addBookingToSheet(booking);
    if (!bookingAdded) {
      // Revert availability if booking failed
      await updateAvailability(booking.date, booking.time, booking.barber, true);
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to add booking to sheet' 
      });
    }

    // Add to Google Calendar
    const calendarLink = await addToGoogleCalendar(booking);
    
    // Send confirmation email
    if (booking.email) {
      await sendConfirmationEmail(booking);
    }

    res.json({ 
      success: true, 
      calendarLink,
      message: 'Booking successful' 
    });
  } catch (error) {
    console.error('Error processing booking:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Booking API server running on port ${PORT}`);
  console.log('Available API endpoints:');
  console.log(`- GET /health`);
  console.log(`- GET /available-barbers`);
  console.log(`- GET /available-dates/:barber?`);
  console.log(`- GET /available-times/:date/:barber?`);
  console.log(`- POST /submit-booking`);
}); 