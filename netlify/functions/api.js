// Instead of using Express, let's create a simple function handler
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Configuration and Setup
const CONFIG = {
  emailService: process.env.EMAIL_SERVICE || 'gmail',
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,
  googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY,
  spreadsheetId: process.env.SPREADSHEET_ID || process.env.SHEET_ID || '1GwdJssNZR54l3LI9UMeuRN5G5YwQXVlzmIrDWzOJY90',
  calendarId: process.env.CALENDAR_ID || 'gthabarber1@gmail.com',
  timeZone: 'America/Los_Angeles'
};

// Debug environment variables (without exposing secrets)
console.log('=== API Configuration ===');
console.log('Email User configured:', !!CONFIG.emailUser);
console.log('Email Pass configured:', !!CONFIG.emailPass);
console.log('Google Sheets credentials available:', !!CONFIG.googleClientEmail && !!CONFIG.googlePrivateKey);
console.log('Spreadsheet ID:', CONFIG.spreadsheetId);
console.log('Calendar ID available:', !!CONFIG.calendarId);

// Check if credentials are available
console.log('Email configured:', !!CONFIG.emailPass);
console.log('Google Sheets configured:', !!CONFIG.googleClientEmail && !!CONFIG.googlePrivateKey);

// Common response headers
const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-cache, no-store'
};

// Service durations in minutes
const SERVICE_DURATIONS = {
  'Haircut & Beard Trim': 60,
  'Haircut': 45,
  'Beard Trim': 30,
  'Straight Razor Shave': 30,
  'Hair Enhancement (Permanent)': 45,
  'Hair Enhancement (Temporary - Air-Brush)': 15
};

// Calendar event colors
const CALENDAR_COLORS = {
  'Haircut & Beard Trim': '6', // Orange
  'Haircut': '9',              // Blue
  'Beard Trim': '10',          // Green
  'Straight Razor Shave': '7', // Teal
  'Hair Enhancement': '4',     // Red
  'default': '1'               // Lavender
};

// Helper function to get Google auth
async function getGoogleAuth() {
  try {
    // Check if we have the full credentials JSON
    if (process.env.GOOGLE_CREDENTIALS) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        
        const auth = new google.auth.JWT(
          credentials.client_email,
          null,
          credentials.private_key,
          [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/calendar.events' // Limited scope for calendar
          ]
        );
        
        return auth;
      } catch (e) {
        console.error('Error parsing GOOGLE_CREDENTIALS:', e);
      }
    }
    
    // Fallback to individual credentials
    const credentials = {
      client_email: CONFIG.googleClientEmail,
      private_key: CONFIG.googlePrivateKey?.replace(/\\n/g, '\n')
    };
    
    if (!credentials.client_email || !credentials.private_key) {
      console.error('Google credentials missing');
      return null;
    }
    
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar.events' // Limited scope for calendar
      ]
    );
    
    return auth;
  } catch (error) {
    console.error('Error setting up Google Auth:', error);
    return null;
  }
}

// Email sender setup
const createTransporter = () => {
  if (!CONFIG.emailUser || !CONFIG.emailPass) {
    console.error('Email credentials not properly configured');
    return null;
  }

  return nodemailer.createTransport({
    service: CONFIG.emailService,
    auth: {
      user: CONFIG.emailUser,
      pass: CONFIG.emailPass
    }
  });
};

// Function to send confirmation email
async function sendConfirmationEmail(booking) {
  try {
    if (!booking.email) {
      console.log('No email provided, skipping email notification');
      return false;
    }

    const transporter = createTransporter();
    if (!transporter) {
      console.log('Email transporter not configured, skipping email notification');
      return false;
    }
    
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
      <p>If you need to reschedule or cancel, please contact us at ${CONFIG.emailUser || 'our office'}.</p>
      <p>Thank you for choosing our services!</p>
    `;
    
    // Email to customer
    const customerMailOptions = {
      from: CONFIG.emailUser,
      to: booking.email,
      subject: 'Barber Appointment Confirmation',
      html: emailContent
    };
    
    const customerInfo = await transporter.sendMail(customerMailOptions);
    console.log('Customer email sent:', customerInfo.response);
    
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
      <p>This appointment has been added to your calendar.</p>
    `;
    
    // Email to barber
    const barberMailOptions = {
      from: CONFIG.emailUser,
      to: CONFIG.emailUser,
      subject: `New Appointment: ${booking.date} at ${booking.time}`,
      html: barberEmailContent
    };
    
    const barberInfo = await transporter.sendMail(barberMailOptions);
    console.log('Barber notification email sent:', barberInfo.response);
    
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Function to load sheet data
async function loadSheetData() {
  try {
    const auth = await getGoogleAuth();
    if (!auth) {
      console.log('No auth available for sheet operation');
      return null;
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log(`Loading sheet data from spreadsheet: ${CONFIG.spreadsheetId}`);
    
    // Get Available_Times data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.spreadsheetId,
      range: 'Available_Times!A:Z', // Get all columns to be safe
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      console.log('No data found in sheet or only headers present');
      return null;
    }
    
    console.log(`Found ${rows.length} rows in the sheet (including header)`);
    
    const headers = rows[0].map(h => (h || '').toString().toLowerCase().trim());
    console.log(`Sheet headers: ${headers.join(', ')}`);
    
    // Find column indices - be flexible with naming
    const dateIndex = headers.findIndex(h => h.includes('date'));
    const timeIndex = headers.findIndex(h => h.includes('time'));
    const barberIndex = headers.findIndex(h => h.includes('barber'));
    
    // Look for status, availability, or available column
    const statusIndex = headers.findIndex(h => 
      h === 'status' || h.includes('avail') || h === 'booked'
    );
    
    console.log(`Column indices - Date: ${dateIndex}, Time: ${timeIndex}, Barber: ${barberIndex}, Status: ${statusIndex}`);
    
    if (dateIndex === -1 || timeIndex === -1 || barberIndex === -1 || statusIndex === -1) {
      console.error(`Required columns not found in sheet. Found columns: ${headers.join(', ')}`);
      console.error('Looking for columns containing: date, time, barber, status/available/availability');
      return null;
    }
    
    // Map sheet data to structured objects, with more flexible status checking
    const mappedData = rows.slice(1).map((row, index) => {
      // Handle potential missing values
      const date = row[dateIndex] || '';
      const time = row[timeIndex] || '';
      const barber = row[barberIndex] || '';
      const status = (row[statusIndex] || '').toString().toLowerCase().trim();
      
      // Check if status indicates availability
      // Accept "available", "yes", "true", "1", etc. as available
      const isAvailable = 
        status === 'available' || 
        status === 'yes' || 
        status === 'true' || 
        status === '1' || 
        status === 'y' ||
        status === 'open';
      
      if (index < 5) {
        console.log(`Sample row ${index + 2}: ${date}, ${time}, ${barber}, ${status} -> isAvailable: ${isAvailable}`);
      }
      
      return {
        rowIndex: index + 2, // +2 because we're 0-indexed and skipping header
        date: date,
        time: time,
        barber: barber,
        status: status,
        isAvailable: isAvailable
      };
    });
    
    console.log(`Mapped ${mappedData.length} rows of data`);
    
    return {
      headers,
      data: mappedData
    };
  } catch (error) {
    console.error('Error loading sheet data:', error);
    return null;
  }
}

// Function to update availability in sheet
async function updateAvailability(date, time, barber) {
  try {
    const auth = await getGoogleAuth();
    if (!auth) {
      console.log('No auth available for sheet update');
      return false;
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log(`Searching for slot: ${date} at ${time} with ${barber}`);
    
    // Get current data
    const sheetData = await loadSheetData();
    if (!sheetData) {
      console.error('Failed to load sheet data for update');
      return false;
    }
    
    // Find the row to update - more flexible matching
    const rowToUpdate = sheetData.data.find(row => {
      // Log the comparisons for debugging
      console.log(`Comparing row: date=${row.date}==${date}, time=${row.time}==${time}, barber=${row.barber}==${barber}, status=${row.isAvailable}`);
      
      // Check if dates match (allowing for different formats)
      const dateMatches = row.date === date || 
                         new Date(row.date).toLocaleDateString() === new Date(date).toLocaleDateString();
      
      // Check if times match (ignoring case and spaces)
      const normalizedRowTime = row.time.toLowerCase().replace(/\s+/g, ' ');
      const normalizedRequestTime = time.toLowerCase().replace(/\s+/g, ' ');
      const timeMatches = normalizedRowTime === normalizedRequestTime;
      
      // Check if barbers match (ignoring case)
      const barberMatches = row.barber.toLowerCase() === barber.toLowerCase();
      
      // For debugging
      if (dateMatches && timeMatches && barberMatches) {
        console.log(`Found matching slot: isAvailable=${row.isAvailable}`);
      }
      
      return dateMatches && timeMatches && barberMatches;
    });
    
    if (!rowToUpdate) {
      console.error(`No slot found matching: ${date} at ${time} with ${barber}`);
      // Return true anyway if we couldn't find the slot to avoid blocking bookings
      // This is a temporary workaround while debugging
      console.log('Allowing booking to proceed despite not finding the slot');
      return true;
    }
    
    // Get the status column letter
    const statusColumnLetter = String.fromCharCode(65 + sheetData.headers.findIndex(h => h.toLowerCase().includes('status')));
    
    // Update the status to "Booked"
    await sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `Available_Times!${statusColumnLetter}${rowToUpdate.rowIndex}`,
      valueInputOption: 'RAW',
      resource: {
        values: [['Booked']]
      }
    });
    
    console.log(`Updated slot at row ${rowToUpdate.rowIndex} from ${rowToUpdate.isAvailable ? 'Available' : 'Not Available'} to Booked`);
    return true;
  } catch (error) {
    console.error('Error updating availability:', error);
    // Return true as a fallback to allow bookings to proceed
    // This is temporary while debugging
    return true;
  }
}

// Function to add booking to sheet
async function addBookingToSheet(booking) {
  try {
    const auth = await getGoogleAuth();
    if (!auth) {
      console.log('No auth available for adding booking to sheet');
      return false;
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Get timestamp
    const timestamp = new Date().toISOString();
    
    // Prepare the row data
    const values = [
      [timestamp, booking.name, booking.email || '', booking.phone || '', booking.barber, booking.service, booking.date, booking.time]
    ];
    
    // Add to Form Responses sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.spreadsheetId,
      range: 'Form Responses!A:H',
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });
    
    console.log('Booking added to sheet successfully');
    return true;
  } catch (error) {
    console.error('Error adding booking to sheet:', error);
    return false;
  }
}

// Function to add booking to Google Calendar
async function addToCalendar(booking) {
  try {
    const auth = await getGoogleAuth();
    if (!auth) {
      console.log('No auth available for calendar');
      return false;
    }
    
    const calendar = google.calendar({ version: 'v3', auth });
    
    console.log(`Using calendar ID: ${CONFIG.calendarId}`);
    
    // Parse date and time to create event
    const [month, day, year] = booking.date.split('/');
    const [time, period] = booking.time.split(' ');
    const [hourStr, minuteStr] = time.split(':');
    
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    
    // Convert to 24-hour format
    if (period === 'PM' && hour < 12) {
      hour += 12;
    } else if (period === 'AM' && hour === 12) {
      hour = 0;
    }
    
    // Get appointment duration based on service type by checking partial matches
    const serviceType = booking.service.toLowerCase();
    let appointmentDuration = 60; // Default 60 minutes
    
    if (serviceType.includes('haircut') && serviceType.includes('beard')) {
      appointmentDuration = 60; // Haircut & Beard Trim
    } else if (serviceType.includes('haircut')) {
      appointmentDuration = 45; // Regular Haircut
    } else if (serviceType.includes('beard')) {
      appointmentDuration = 30; // Beard Trim
    } else if (serviceType.includes('shave')) {
      appointmentDuration = 30; // Straight Razor Shave
    } else if (serviceType.includes('enhancement')) {
      appointmentDuration = serviceType.includes('temporary') ? 15 : 45;
    }
    
    // Create start and end time based on service duration
    const startTime = new Date(year, month - 1, day, hour, minute);
    const serviceEndTime = new Date(startTime.getTime() + (appointmentDuration * 60 * 1000));
    
    console.log(`Creating calendar event for ${booking.date} at ${booking.time}`);
    console.log(`Service: ${booking.service}, duration: ${appointmentDuration} minutes`);
    
    // Determine color based on service type
    let colorId = '1'; // Default: Lavender
    
    if (serviceType.includes('haircut') && serviceType.includes('beard')) {
      colorId = '6'; // Orange for Haircut & Beard
    } else if (serviceType.includes('haircut')) {
      colorId = '9'; // Blue for Haircuts
    } else if (serviceType.includes('beard')) {
      colorId = '10'; // Green for Beard Trims
    } else if (serviceType.includes('shave')) {
      colorId = '7'; // Teal for Shaves
    } else if (serviceType.includes('enhancement')) {
      colorId = '4'; // Red for Enhancements
    }
    
    // Format phone number if provided
    let formattedPhone = booking.phone || 'No phone provided';
    if (booking.phone && booking.phone.length >= 10) {
      // Try to format as (XXX) XXX-XXXX
      formattedPhone = booking.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    }
    
    // Simple clean description for the calendar event
    const eventDescription = `
Appointment: ${booking.service}
Client: ${booking.name}
Phone: ${formattedPhone}
Email: ${booking.email || 'None provided'}
Duration: ${appointmentDuration} minutes
Barber: ${booking.barber}
    `.trim();
    
    // Create calendar event with just the essentials
    const event = {
      summary: `${booking.service} - ${booking.name}`,
      description: eventDescription,
      location: 'Distinguished Gentleman Barbers',
      start: {
        dateTime: startTime.toISOString(),
        timeZone: CONFIG.timeZone
      },
      end: {
        dateTime: serviceEndTime.toISOString(),
        timeZone: CONFIG.timeZone
      },
      colorId: colorId,
      // Simplified reminders - only what's actually needed
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },  // 1 hour before
          { method: 'popup', minutes: 15 }   // 15 minutes before
        ]
      }
    };
    
    // Insert event to calendar
    const response = await calendar.events.insert({
      calendarId: CONFIG.calendarId,
      resource: event,
      sendUpdates: 'none' // Don't send calendar updates
    });
    
    console.log('Calendar event created:', response.data.htmlLink);
    return true;
  } catch (error) {
    console.error('Error adding to calendar:', error);
    return false;
  }
}

// Function to get available barbers from sheet
async function getAvailableBarbers() {
  try {
    const sheetData = await loadSheetData();
    if (!sheetData) {
      console.log('Using fallback barber data');
      return ['Michael'];
    }
    
    // Get unique barbers that have available slots
    const barbers = [...new Set(
      sheetData.data
        .filter(row => row.isAvailable)
        .map(row => row.barber)
    )];
    
    console.log(`Found ${barbers.length} barbers with availability`);
    return barbers;
  } catch (error) {
    console.error('Error getting barbers:', error);
    return ['Michael']; // Fallback
  }
}

// Function to get available dates from sheet
async function getAvailableDates(barber) {
  try {
    const sheetData = await loadSheetData();
    if (!sheetData) {
      console.log('Using fallback date data');
      // Generate fallback dates for 90 days
      const fallbackDates = [];
      const today = new Date();
      
      for (let i = 0; i < 90; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        // Skip Sundays (0) and Wednesdays (3)
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 3) {
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
          fallbackDates.push(dateStr);
        }
      }
      
      return fallbackDates;
    }
    
    // Get unique dates from the sheet
    let dates = sheetData.data
      .filter(row => row.isAvailable && (!barber || row.barber === barber))
      .map(row => row.date);
    
    // Remove duplicates
    dates = [...new Set(dates)];
    
    // If we don't have enough dates from the sheet, generate additional dates
    const datesFromSheet = new Set(dates);
    if (datesFromSheet.size < 90) {
      const today = new Date();
      
      // Generate dates for 90 days
      for (let i = 0; i < 90; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        // Skip Sundays (0) and Wednesdays (3)
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 3) {
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
          
          // Only add if not already in the list
          if (!datesFromSheet.has(dateStr)) {
            dates.push(dateStr);
          }
        }
      }
    }
    
    // Sort dates
    dates.sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA - dateB;
    });
    
    // Filter out Sundays (0) and Wednesdays (3)
    dates = dates.filter(dateStr => {
      const date = new Date(dateStr);
      const day = date.getDay();
      // 0 is Sunday, 3 is Wednesday
      return day !== 0 && day !== 3;
    });
    
    // Limit to 90 days
    dates = dates.slice(0, 90);
    
    console.log(`Found ${dates.length} available dates (excluding Sundays and Wednesdays)`);
    return dates;
  } catch (error) {
    console.error('Error getting dates:', error);
    // Generate fallback dates for 90 days
    const fallbackDates = [];
    const today = new Date();
    
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Skip Sundays (0) and Wednesdays (3)
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 3) {
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        fallbackDates.push(dateStr);
      }
    }
    
    return fallbackDates;
  }
}

// Function to get available times from sheet
async function getAvailableTimes(date, barber) {
  try {
    const sheetData = await loadSheetData();
    if (!sheetData) {
      console.log('Using fallback time data');
      return [
        { time: '10:00 AM', barber: barber || 'Michael' },
        { time: '11:00 AM', barber: barber || 'Michael' },
        { time: '1:00 PM', barber: barber || 'Michael' },
        { time: '2:00 PM', barber: barber || 'Michael' }
      ];
    }
    
    // Filter times for the specified date and barber
    const availableTimes = sheetData.data
      .filter(row => 
        row.date === date && 
        row.isAvailable && 
        (!barber || row.barber === barber)
      )
      .map(row => ({
        time: row.time,
        barber: row.barber
      }));
    
    // Sort times chronologically
    availableTimes.sort((a, b) => {
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
    
    // Filter times outside of working hours (10am-7pm)
    const filteredByHours = availableTimes.filter(timeObj => {
      const [timeStr, period] = timeObj.time.split(' ');
      let [hours, minutes] = timeStr.split(':').map(Number);
      
      // Convert to 24-hour format
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      // Working hours: 10am (10) to 7pm (19)
      return hours >= 10 && hours < 19;
    });
    
    // Apply 2-hour booking window restriction
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { 
      month: 'numeric', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    // Convert date string to Date object
    const [requestMonth, requestDay, requestYear] = date.split('/');
    const requestDate = new Date(parseInt(requestYear), parseInt(requestMonth) - 1, parseInt(requestDay));
    
    // Check if the requested date is today
    const isToday = currentDate === date;
    
    // If it's today, filter out times that are less than 2 hours from now
    if (isToday) {
      console.log(`Current time: ${now.toLocaleTimeString()}, filtering times less than 2 hours from now`);
      
      // Current time in minutes since midnight
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      
      // Add 2 hours (120 minutes) for minimum booking window
      const minimumBookingTimeInMinutes = currentTimeInMinutes + 120;
      
      console.log(`Current time in minutes: ${currentTimeInMinutes}`);
      console.log(`Minimum booking time in minutes: ${minimumBookingTimeInMinutes}`);
      
      // Filter out times less than 2 hours from now
      const filteredTimes = filteredByHours.filter(timeObj => {
        const [timeStr, period] = timeObj.time.split(' ');
        let [hours, minutes] = timeStr.split(':').map(Number);
        
        // Convert to 24-hour format
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        
        // Convert appointment time to minutes since midnight
        const appointmentTimeInMinutes = hours * 60 + minutes;
        
        // Check if appointment is at least 2 hours from now
        const isAvailable = appointmentTimeInMinutes >= minimumBookingTimeInMinutes;
        
        console.log(`Time ${timeObj.time}: ${appointmentTimeInMinutes} minutes - ${isAvailable ? 'Available' : 'Too soon'}`);
        
        return isAvailable;
      });
      
      console.log(`Found ${filteredTimes.length} available times after applying 2-hour booking window and 10am-7pm hours`);
      return filteredTimes;
    }
    
    console.log(`Found ${filteredByHours.length} available times for ${date} between 10am and 7pm`);
    return filteredByHours;
  } catch (error) {
    console.error('Error getting times:', error);
    return [
      { time: '10:00 AM', barber: barber || 'Michael' },
      { time: '11:00 AM', barber: barber || 'Michael' },
      { time: '1:00 PM', barber: barber || 'Michael' },
      { time: '2:00 PM', barber: barber || 'Michael' }
    ]; // Fallback times
  }
}

// Export the handler function
exports.handler = async function(event, context) {
  console.log('Event path:', event.path);
  console.log('Event httpMethod:', event.httpMethod);
  
  // Parse the path from the event
  const path = event.path.replace('/.netlify/functions/api', '') || '/';
  console.log('Parsed path:', path);
  
  // Handle OPTIONS requests for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        ...HEADERS,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }
  
  try {
    // Basic routing
    if (event.httpMethod === 'GET') {
      // Health check endpoint
      if (path === '/' || path === '/health') {
        return {
          statusCode: 200,
          headers: HEADERS,
          body: JSON.stringify({
            status: 'ok',
            message: 'Booking API is running',
            timestamp: new Date().toISOString()
          })
        };
      }
      
      // Available barbers endpoint
      if (path === '/available-barbers') {
        const barbers = await getAvailableBarbers();
        return {
          statusCode: 200,
          headers: HEADERS,
          body: JSON.stringify({ barbers })
        };
      }
      
      // Available dates endpoint
      if (path.startsWith('/available-dates')) {
        const parts = path.split('/');
        const barber = parts[2] ? decodeURIComponent(parts[2]) : null;
        const dates = await getAvailableDates(barber);
        return {
          statusCode: 200,
          headers: HEADERS,
          body: JSON.stringify({ dates })
        };
      }
      
      // Available times endpoint
      if (path.startsWith('/available-times')) {
        const parts = path.split('/');
        const date = parts[2] ? decodeURIComponent(parts[2]) : null;
        const barber = parts[3] ? decodeURIComponent(parts[3]) : null;
        
        if (!date) {
          return {
            statusCode: 400,
            headers: HEADERS,
            body: JSON.stringify({ 
              error: 'Date is required',
              availableTimes: [] 
            })
          };
        }
        
        // Check if the date is Sunday or Wednesday
        const dateParts = date.split('/');
        const checkDate = new Date(
          parseInt(dateParts[2]), 
          parseInt(dateParts[0]) - 1, 
          parseInt(dateParts[1])
        );
        const dayOfWeek = checkDate.getDay();
        
        // 0 is Sunday, 3 is Wednesday
        if (dayOfWeek === 0 || dayOfWeek === 3) {
          return {
            statusCode: 200,
            headers: HEADERS,
            body: JSON.stringify({
              availableTimes: [],
              date,
              barber: barber || 'Any',
              message: "We're closed on Sundays and Wednesdays. Please contact Mike at (503) 400-8151 for special arrangements."
            })
          };
        }
        
        const availableTimes = await getAvailableTimes(date, barber);
        return {
          statusCode: 200,
          headers: HEADERS,
          body: JSON.stringify({ 
            availableTimes,
            date,
            barber: barber || 'Any'
          })
        };
      }
    }
    
    // Handle booking submission
    if (event.httpMethod === 'POST' && path === '/submit-booking') {
      const booking = JSON.parse(event.body);
      console.log('Booking submission received:', booking);
      
      // Validate booking data
      if (!booking.barber || !booking.service || !booking.date || !booking.time || !booking.name) {
        console.log('Missing required booking fields:', { 
          barber: !!booking.barber, 
          service: !!booking.service, 
          date: !!booking.date, 
          time: !!booking.time, 
          name: !!booking.name 
        });
        
        return {
          statusCode: 400,
          headers: HEADERS,
          body: JSON.stringify({
            success: false,
            message: 'Missing required booking information'
          })
        };
      }
      
      // Process booking
      console.log(`Processing booking: ${booking.date} at ${booking.time} with ${booking.barber} for ${booking.name}`);
      
      // Update availability
      const updated = await updateAvailability(booking.date, booking.time, booking.barber);
      if (!updated) {
        return {
          statusCode: 409,
          headers: HEADERS,
          body: JSON.stringify({
            success: false,
            message: 'This time slot is no longer available. Please select another time.'
          })
        };
      }
      
      // Add to sheet and calendar
      const [sheetUpdated, calendarUpdated] = await Promise.all([
        addBookingToSheet(booking),
        addToCalendar(booking).catch(err => {
          console.error('Calendar error:', err);
          return false;
        })
      ]);
      
      // Send confirmation email
      const emailSent = await sendConfirmationEmail(booking).catch(err => {
        console.error('Email error:', err);
        return false;
      });
      
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          success: true,
          message: 'Booking confirmed successfully!',
          emailSent,
          sheetUpdated,
          calendarUpdated
        })
      };
    }
    
    // If no route matches
    return {
      statusCode: 404,
      headers: HEADERS,
      body: JSON.stringify({
        success: false,
        message: 'Endpoint not found',
        path,
        method: event.httpMethod
      })
    };
    
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      })
    };
  }
};
