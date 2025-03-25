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
      try {
        const auth = await loadCredentials();
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Get all sheet names to help debug
        const sheetsMetadata = await sheets.spreadsheets.get({
          spreadsheetId: SPREADSHEET_ID
        });
        
        const sheetNames = sheetsMetadata.data.sheets.map(sheet => sheet.properties.title);
        
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
            sheetNames: sheetNames,
            timestamp: new Date().toISOString()
          })
        };
      } catch (error) {
        console.error('Error in test endpoint:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            error: 'Test endpoint error', 
            details: error.message,
            spreadsheetId: SPREADSHEET_ID,
            googleCredentialsExist: !!process.env.GOOGLE_CREDENTIALS
          })
        };
      }
    }
    
    // Barbers endpoint
    if (path === '/available-barbers') {
      try {
        console.log('Fetching available barbers...');
        const auth = await loadCredentials();
        console.log('Credentials loaded successfully');
        
        const sheets = google.sheets({ version: 'v4', auth });
        console.log('Google Sheets initialized');
        
        // Use the Available_Times sheet and extract unique barber names
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Available_Times',
        });
        console.log('Spreadsheet data fetched successfully');

        // Extract unique barber names from column C (index 2)
        const allBarberEntries = response.data.values.slice(1).map(row => row[2]);
        const uniqueBarbers = [...new Set(allBarberEntries)].filter(Boolean);
        
        console.log('Barbers found:', uniqueBarbers);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ barbers: uniqueBarbers })
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
          range: 'Available_Times',
        });

        // Extract unique dates from column A (index 0)
        const allDateEntries = response.data.values.slice(1).map(row => row[0]);
        const uniqueDates = [...new Set(allDateEntries)].filter(Boolean);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ dates: uniqueDates })
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
        const barber = parts[3] || null;
        
        const auth = await loadCredentials();
        const sheets = google.sheets({ version: 'v4', auth });
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Available_Times',
        });

        const rows = response.data.values.slice(1);
        
        // Filter rows by date and status
        const availableSlots = rows.filter(row => 
          row[0] === date && 
          row[3] === 'Available' && 
          (!barber || row[2] === barber)
        );
        
        // Map to time slots
        const availableTimes = availableSlots.map(row => ({
          time: row[1],
          barber: row[2]
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
        
        // Get both Available_Times and Form Responses
        const availableTimes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Available_Times',
        });
        
        let formResponses = [];
        try {
          const formResponsesData = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Form Responses',
          });
          formResponses = formResponsesData.data.values || [];
        } catch (err) {
          console.log('No Form Responses sheet found or empty, continuing with Available_Times only');
        }
        
        // Use booked slots from Available_Times
        const rows = availableTimes.data.values.slice(1);
        const bookedSlots = rows.filter(row => row[3] === 'Booked');
        
        const events = bookedSlots.map(row => {
          const date = row[0];
          const time = row[1];
          const barber = row[2];
          
          const startDate = new Date(`${date} ${time}`);
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          
          return {
            title: `Booked - ${barber}`,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            extendedProps: {
              barber: barber
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
      
      // Update the Available_Times to mark the slot as booked
      const timesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Available_Times',
      });
      
      const rows = timesResponse.data.values.slice(1);
      const rowIndex = rows.findIndex(row => 
        row[0] === date && 
        row[1] === time && 
        row[2] === barber &&
        row[3] === 'Available'
      );
      
      if (rowIndex === -1) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Time slot no longer available' })
        };
      }
      
      // Mark as booked (update status column)
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Available_Times!D${rowIndex + 2}`, // +2 because we have a header row and slice(1)
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [['Booked']]
        }
      });
      
      // Also add to Form Responses if it exists
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Form Responses',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [[name, email, phone, date, time, barber, service]]
          }
        });
      } catch (err) {
        console.log('No Form Responses sheet found, skipping append');
      }

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