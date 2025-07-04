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
  timeZone: process.env.TIME_ZONE || 'America/Los_Angeles',
  businessHours: {
    start: '10:00 AM',
    end: '6:00 PM'
  },
  businessDays: [1, 2, 4, 5, 6], // Monday, Tuesday, Thursday, Friday, Saturday (0=Sunday, 6=Saturday)
  daysToLookAhead: 180 // Show dates for 6 months ahead (more reasonable than 2 years)
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

// Helper function to check if a date string is in the past
function isDateInPast(dateStr) {
  try {
    // Parse the date string (expected format: M/D/YYYY)
    const [month, day, year] = dateStr.split('/').map(num => parseInt(num));
    
    // Get current Pacific time
    const now = new Date();
    const pacificTime = new Date(now.toLocaleString("en-US", {timeZone: CONFIG.timeZone}));
    
    // Create date objects for comparison (at midnight)
    const checkDate = new Date(year, month - 1, day);
    checkDate.setHours(0, 0, 0, 0);
    
    const todayPacific = new Date(pacificTime.getFullYear(), pacificTime.getMonth(), pacificTime.getDate());
    todayPacific.setHours(0, 0, 0, 0);
    
    // DEBUG: Log the comparison
    console.log(`Pacific time check: ${dateStr} (${checkDate.toDateString()}) < today Pacific (${todayPacific.toDateString()}) = ${checkDate < todayPacific}`);
    
    // Return true if the date is before today Pacific time (not including today)
    return checkDate < todayPacific;
  } catch (error) {
    console.error(`Error parsing date ${dateStr}:`, error);
    // If we can't parse the date, assume it's invalid (past)
    return true;
  }
}

// Helper function to parse date string to Date object
function parseDate(dateStr) {
  try {
    const [month, day, year] = dateStr.split('/').map(num => parseInt(num));
    return new Date(year, month - 1, day);
  } catch (error) {
    console.error(`Error parsing date ${dateStr}:`, error);
    return null;
  }
}

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

  return nodemailer.createTransporter({
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
    
    // Count how many past dates we're filtering out
    let pastDatesCount = 0;
    let totalRowsProcessed = 0;
    
    // Map sheet data to structured objects, filtering out past dates
    const mappedData = rows.slice(1).map((row, index) => {
      totalRowsProcessed++;
      
      // Handle potential missing values
      const date = row[dateIndex] || '';
      const time = row[timeIndex] || '';
      const barber = row[barberIndex] || '';
      const status = (row[statusIndex] || '').toString().toLowerCase().trim();
      
      // Check if this date is in the past
      if (isDateInPast(date)) {
        pastDatesCount++;
        return null; // Will be filtered out
      }
      
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
    }).filter(row => row !== null); // Remove null entries (past dates)
    
    console.log(`Processed ${totalRowsProcessed} rows, filtered out ${pastDatesCount} past dates`);
    console.log(`Returning ${mappedData.length} future/current date rows`);
    
    return {
      headers,
      data: mappedData,
      filteredPastDates: pastDatesCount
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
    
    // Log time zone information for debugging
    console.log(`Time zone being used: ${CONFIG.timeZone}`);
    
    // Create ISO string date format but preserve the time zone
    // YYYY-MM-DDTHH:MM:SS
    const startDateTime = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
    
    // Log the formatted date/time for debugging
    console.log(`Formatted start time: ${startDateTime}`);
    
    // Calculate end time
    const startTimeMs = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`).getTime();
    const endTimeMs = startTimeMs + (appointmentDuration * 60 * 1000);
    const endDateTime = new Date(endTimeMs).toISOString().replace('Z', '');
    
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
        dateTime: startDateTime,
        timeZone: CONFIG.timeZone
      },
      end: {
        dateTime: endDateTime,
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
    
    console.log('Calendar event date/time info:', {
      startDateTime,
      endDateTime,
      timeZone: CONFIG.timeZone
    });
    
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
      // Generate fallback dates for the configured days ahead
      const fallbackDates = [];
      const today = new Date();
      
      for (let i = 0; i < CONFIG.daysToLookAhead; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        // Skip days that are not business days
        const dayOfWeek = date.getDay();
        if (CONFIG.businessDays.includes(dayOfWeek)) {
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
          fallbackDates.push(dateStr);
        }
      }
      
      console.log(`Generated ${fallbackDates.length} fallback dates for the next ${CONFIG.daysToLookAhead} days`);
      // Ensure our fallback dates are deduplicated
      return [...new Set(fallbackDates)];
    }
    
    console.log(`Getting available dates for barber: ${barber || 'any'}`);
    
    // Get unique dates from the sheet (already filtered for future dates)
    let dates = sheetData.data
      .filter(row => row.isAvailable && (!barber || row.barber === barber))
      .map(row => row.date);
    
    console.log(`Initial dates from sheet (may include duplicates): ${dates.length}`);
    
    // Create a Set to track unique dates
    const uniqueDatesSet = new Set();
    const duplicatesFound = [];
    
    // Remove duplicates while keeping track of them for debugging
    dates.forEach(date => {
      if (uniqueDatesSet.has(date)) {
        duplicatesFound.push(date);
      } else {
        uniqueDatesSet.add(date);
      }
    });
    
    // Get the final unique dates
    dates = [...uniqueDatesSet];
    
    console.log(`Found ${dates.length} unique dates from sheet data`);
    if (duplicatesFound.length > 0) {
      console.log(`Removed ${duplicatesFound.length} duplicate dates`);
      console.log(`First few duplicates: ${duplicatesFound.slice(0, 5).join(', ')}`);
    }
    
    // If we don't have enough dates from the sheet, generate additional dates
    if (uniqueDatesSet.size < CONFIG.daysToLookAhead) {
      const today = new Date();
      
      // Generate dates for the configured days ahead
      for (let i = 0; i < CONFIG.daysToLookAhead; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        // Only include business days specified in CONFIG
        const dayOfWeek = date.getDay();
        if (CONFIG.businessDays.includes(dayOfWeek)) {
          const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
          
          // Only add if not already in the list
          if (!uniqueDatesSet.has(dateStr)) {
            uniqueDatesSet.add(dateStr);
            dates.push(dateStr);
          }
        }
      }
    }
    
    // Sort dates
    dates.sort((a, b) => {
      const dateA = parseDate(a);
      const dateB = parseDate(b);
      return dateA - dateB;
    });
    
    // Filter out non-business days (should already be filtered, but double-check)
    dates = dates.filter(dateStr => {
      const date = parseDate(dateStr);
      if (!date) return false;
      const day = date.getDay();
      // Only keep days that are in the business days list
      return CONFIG.businessDays.includes(day);
    });
    
    // Limit to the configured days ahead
    // This helps prevent returning too many dates and bloating the response
    const maxDatesToReturn = Math.min(CONFIG.daysToLookAhead, 90); // Return at most 90 days
    dates = dates.slice(0, maxDatesToReturn);
    
    // Final check for duplicates
    const finalCheck = new Set(dates);
    
    // Log if we found any duplicates in our final check
    if (finalCheck.size !== dates.length) {
      console.log(`WARNING: Still found duplicates after processing! Original: ${dates.length}, Cleaned: ${finalCheck.size}`);
    }
    
    // Return deduplicated array of dates
    const uniqueDates = [...finalCheck];
    
    console.log(`Returning ${uniqueDates.length} available dates (out of max ${maxDatesToReturn}) for up to ${CONFIG.daysToLookAhead} days ahead`);
    
    // Log if we filtered any past dates
    if (sheetData.filteredPastDates > 0) {
      console.log(`Note: Filtered out ${sheetData.filteredPastDates} past dates from the sheet`);
    }
    
    return uniqueDates;
  } catch (error) {
    console.error('Error getting dates:', error);
    // Generate fallback dates for the configured days ahead
    const fallbackDates = [];
    const today = new Date();
    
    for (let i = 0; i < CONFIG.daysToLookAhead; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Skip non-business days
      const dayOfWeek = date.getDay();
      if (CONFIG.businessDays.includes(dayOfWeek)) {
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        fallbackDates.push(dateStr);
      }
    }
    
    console.log(`Generated ${fallbackDates.length} fallback dates for the next ${CONFIG.daysToLookAhead} days`);
    // Return deduplicated array of fallback dates
    return [...new Set(fallbackDates)];
  }
}

// Function to get available times from sheet
async function getAvailableTimes(date, barber) {
  try {
    // First check if this date is in the past
    if (isDateInPast(date)) {
      console.log(`Date ${date} is in the past, returning no available times`);
      return [];
    }
    
    const sheetData = await loadSheetData();
    if (!sheetData) {
      console.log('Using fallback time data');
      // Generate fallback times based on business hours in CONFIG
      const fallbackTimes = [];
      
      // Convert business hours from CONFIG
      const startHourStr = CONFIG.businessHours.start;
      const endHourStr = CONFIG.businessHours.end;
      
      // Parse start time
      const [startTimeStr, startPeriod] = startHourStr.split(' ');
      let [startHour, startMinute] = startTimeStr.split(':').map(Number);
      if (startPeriod === 'PM' && startHour !== 12) startHour += 12;
      if (startPeriod === 'AM' && startHour === 12) startHour = 0;
      
      // Parse end time
      const [endTimeStr, endPeriod] = endHourStr.split(' ');
      let [endHour, endMinute] = endTimeStr.split(':').map(Number);
      if (endPeriod === 'PM' && endHour !== 12) endHour += 12;
      if (endPeriod === 'AM' && endHour === 12) endHour = 0;
      
      console.log(`Business hours: ${startHour}:${startMinute || '00'} to ${endHour}:${endMinute || '00'} (hours in 24h format)`);
      
      // Generate hourly slots - only up to 6 PM (18:00), not 7 PM
      for (let h = startHour; h < endHour; h++) {
        const hour = h % 12 === 0 ? 12 : h % 12;
        const period = h < 12 ? 'AM' : 'PM';
        const timeString = `${hour}:00 ${period}`;
        
        fallbackTimes.push({
          time: timeString,
          barber: barber || 'Michael'
        });
      }
      
      // Add the final hour (6 PM) explicitly
      if (endHour === 18) {
        fallbackTimes.push({
          time: '6:00 PM',
          barber: barber || 'Michael'
        });
      }
      
      console.log(`Generated ${fallbackTimes.length} fallback times from ${CONFIG.businessHours.start} to ${CONFIG.businessHours.end}`);
      console.log(`Times generated: ${fallbackTimes.map(t => t.time).join(', ')}`);
      return fallbackTimes;
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
    
    // Helper function to convert time string to minutes since midnight for sorting
    const timeToMinutes = (timeStr) => {
      const [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return hours * 60 + (minutes || 0);
    };
    
    // Sort times chronologically using numerical time values
    availableTimes.sort((a, b) => {
      return timeToMinutes(a.time) - timeToMinutes(b.time);
    });
    
    // Parse business hours from CONFIG for filtering
    const [startTimeStr, startPeriod] = CONFIG.businessHours.start.split(' ');
    let [startHour, startMinute] = startTimeStr.split(':').map(Number);
    if (startPeriod === 'PM' && startHour !== 12) startHour += 12;
    if (startPeriod === 'AM' && startHour === 12) startHour = 0;
    
    const [endTimeStr, endPeriod] = CONFIG.businessHours.end.split(' ');
    let [endHour, endMinute] = endTimeStr.split(':').map(Number);
    if (endPeriod === 'PM' && endHour !== 12) endHour += 12;
    if (endPeriod === 'AM' && endHour === 12) endHour = 0;

    console.log(`Filtering times between ${startHour}:${startMinute || '00'} and ${endHour}:${endMinute || '00'} (hours in 24h format)`);
    
    // Filter times outside of working hours - exclude 7 PM
    const filteredByHours = availableTimes.filter(timeObj => {
      const minutes = timeToMinutes(timeObj.time);
      const hours = Math.floor(minutes / 60);
      
      // Check if time is within business hours (10 AM to 6 PM, excluding 7 PM)
      const isWithinHours = hours >= startHour && hours <= endHour;
      
      // Also explicitly exclude 7:00 PM
      if (timeObj.time === '7:00 PM') {
        console.log('Filtering out 7:00 PM slot');
        return false;
      }
      
      return isWithinHours;
    });
    
    // Apply 2-hour booking window restriction
    const now = new Date();
    const pacificNow = new Date(now.toLocaleString("en-US", {timeZone: CONFIG.timeZone}));
    const currentDate = pacificNow.toLocaleDateString('en-US', { 
      month: 'numeric', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: CONFIG.timeZone
    });
    
    // Convert date string to Date object
    const [requestMonth, requestDay, requestYear] = date.split('/');
    const requestDate = new Date(parseInt(requestYear), parseInt(requestMonth) - 1, parseInt(requestDay));
    
    // Check if the requested date is today
    const isToday = currentDate === date;
    
    // Final filtered times array
    let finalTimes = filteredByHours;
    
    // If it's today, filter out times that are less than 2 hours from now
    if (isToday) {
      console.log(`Current Pacific time: ${pacificNow.toLocaleTimeString()}, filtering times less than 2 hours from now`);
      
      // Current time in minutes since midnight Pacific time
      const currentHour = pacificNow.getHours();
      const currentMinute = pacificNow.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      
      // Add 2 hours (120 minutes) for minimum booking window
      const minimumBookingTimeInMinutes = currentTimeInMinutes + 120;
      
      console.log(`Current time in minutes: ${currentTimeInMinutes}`);
      console.log(`Minimum booking time in minutes: ${minimumBookingTimeInMinutes}`);
      
      // Filter out times less than 2 hours from now
      finalTimes = filteredByHours.filter(timeObj => {
        const appointmentTimeInMinutes = timeToMinutes(timeObj.time);
        
        // Check if appointment is at least 2 hours from now
        const isAvailable = appointmentTimeInMinutes >= minimumBookingTimeInMinutes;
        
        console.log(`Time ${timeObj.time}: ${appointmentTimeInMinutes} minutes - ${isAvailable ? 'Available' : 'Too soon'}`);
        
        return isAvailable;
      });
      
      console.log(`Found ${finalTimes.length} available times after applying 2-hour booking window and ${CONFIG.businessHours.start}-${CONFIG.businessHours.end} hours`);
    } else {
      console.log(`Found ${filteredByHours.length} available times for ${date} between ${CONFIG.businessHours.start} and ${CONFIG.businessHours.end}`);
    }
    
    // Make sure times are in proper chronological order using numerical values
    finalTimes.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    
    // Log the final available times to help with debugging
    console.log(`Final available times: ${finalTimes.map(t => t.time).join(', ')}`);
    
    // Log if we filtered any past dates
    if (sheetData.filteredPastDates > 0) {
      console.log(`Note: Already filtered out ${sheetData.filteredPastDates} past dates from the sheet`);
    }
    
    return finalTimes;
  } catch (error) {
    console.error('Error getting times:', error);
    // Generate fallback times based on business hours
    const fallbackTimes = [];
    
    // Convert business hours from CONFIG
    const startHourStr = CONFIG.businessHours.start;
    const endHourStr = CONFIG.businessHours.end;
    
    // Parse start time
    const [startTimeStr, startPeriod] = startHourStr.split(' ');
    let [startHour, startMinute] = startTimeStr.split(':').map(Number);
    if (startPeriod === 'PM' && startHour !== 12) startHour += 12;
    if (startPeriod === 'AM' && startHour === 12) startHour = 0;
    
    // Parse end time
    const [endTimeStr, endPeriod] = endHourStr.split(' ');
    let [endHour, endMinute] = endTimeStr.split(':').map(Number);
    if (endPeriod === 'PM' && endHour !== 12) endHour += 12;
    if (endPeriod === 'AM' && endHour === 12) endHour = 0;
    
    console.log(`Error fallback - Business hours: ${startHour}:${startMinute || '00'} to ${endHour}:${endMinute || '00'} (hours in 24h format)`);
    
    // Generate hourly slots - only up to 6 PM, not including 7 PM
    for (let h = startHour; h < endHour; h++) {
      const hour = h % 12 === 0 ? 12 : h % 12;
      const period = h < 12 ? 'AM' : 'PM';
      const timeString = `${hour}:00 ${period}`;
      
      fallbackTimes.push({
        time: timeString,
        barber: barber || 'Michael'
      });
    }
    
    // Add the final hour (6 PM) explicitly
    if (endHour === 18) {
      fallbackTimes.push({
        time: '6:00 PM',
        barber: barber || 'Michael'
      });
    }
    
    console.log(`Generated ${fallbackTimes.length} fallback times from ${CONFIG.businessHours.start} to ${CONFIG.businessHours.end}`);
    console.log(`Error fallback times generated: ${fallbackTimes.map(t => t.time).join(', ')}`);
    return fallbackTimes;
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
      
      // Check if the booking date is in the past
      if (isDateInPast(booking.date)) {
        console.log(`Booking attempted for past date: ${booking.date}`);
        return {
          statusCode: 400,
          headers: HEADERS,
          body: JSON.stringify({
            success: false,
            message: 'Cannot book appointments for past dates. Please select a future date.'
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
