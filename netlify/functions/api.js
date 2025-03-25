const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

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

// Email configuration
const getTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Main handler function for all routes
exports.handler = async function(event, context) {
  console.log('Event path:', event.path);
  console.log('Event httpMethod:', event.httpMethod);
  
  // Parse the path from the event
  const path = event.path.replace('/.netlify/functions/api', '') || '/';
  
  // Basic routing
  if (event.httpMethod === 'GET') {
    // Root endpoint
    if (path === '/') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: 'API is working!',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Test endpoint
    if (path === '/test') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'API test endpoint is working!',
          spreadsheetId: SPREADSHEET_ID,
          hasCredentials: !!process.env.GOOGLE_CREDENTIALS,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Barbers endpoint
    if (path === '/available-barbers') {
      try {
        console.log('Fetching available barbers...');
        const auth = await loadCredentials();
        console.log('Credentials loaded successfully');
        
        const sheets = google.sheets({ version: 'v4', auth });
        console.log('Google Sheets initialized');
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Barbers',
        });
        console.log('Spreadsheet data fetched successfully');

        const barbers = response.data.values.slice(1).map(row => row[0]);
        console.log('Barbers found:', barbers);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ barbers })
        };
      } catch (error) {
        console.error('Error fetching barbers:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            error: 'Failed to fetch barbers', 
            details: error.message,
            spreadsheetId: SPREADSHEET_ID,
            googleCredentialsExist: !!process.env.GOOGLE_CREDENTIALS
          })
        };
      }
    }
    
    // Dates endpoint
    if (path.startsWith('/available-dates')) {
      try {
        const auth = await loadCredentials();
        const sheets = google.sheets({ version: 'v4', auth });
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Availability',
        });

        let dates = response.data.values.slice(1).map(row => row[0]);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ dates })
        };
      } catch (error) {
        console.error('Error fetching dates:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Failed to fetch dates', details: error.message })
        };
      }
    }
    
    // Times endpoint
    if (path.startsWith('/available-times')) {
      try {
        const parts = path.split('/');
        const date = parts[2];
        const barber = parts[3] || 'Any barber';
        
        const auth = await loadCredentials();
        const sheets = google.sheets({ version: 'v4', auth });
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Availability',
        });

        const rows = response.data.values;
        const dateIndex = rows.findIndex(row => row[0] === date);
        
        if (dateIndex === -1) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ availableTimes: [] })
          };
        }

        const times = rows[dateIndex].slice(1).filter(time => time !== '');
        const availableTimes = times.map(time => ({
          time,
          barber: barber
        }));
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ availableTimes })
        };
      } catch (error) {
        console.error('Error fetching times:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Failed to fetch times', details: error.message })
        };
      }
    }
    
    // Calendar events endpoint
    if (path === '/calendar-events') {
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
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify(events)
        };
      } catch (error) {
        console.error('Error fetching calendar events:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Failed to fetch calendar events', details: error.message })
        };
      }
    }
  }
  
  // Handle POST request for booking
  if (event.httpMethod === 'POST' && path === '/submit-booking') {
    try {
      const body = JSON.parse(event.body);
      console.log('Booking submitted:', body);
      
      const { barber, service, date, time, name, email, phone } = body;
      
      if (!barber || !service || !date || !time || !name) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Missing required fields' })
        };
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
        const transporter = getTransporter();
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
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Booking submitted successfully'
        })
      };
    } catch (error) {
      console.error('Error submitting booking:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Failed to submit booking',
          details: error.message
        })
      };
    }
  }
  
  // OPTIONS request handling for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }
  
  // If no route matches, return 404
  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: false,
      message: 'Endpoint not found',
      path: path,
      method: event.httpMethod
    })
  };
};