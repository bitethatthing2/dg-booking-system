const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

// Create express app
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

// API Routes with dummy data for testing
app.get('/available-barbers', (req, res) => {
  res.json({ barbers: ['Michael', 'John', 'David'] });
});

app.get('/available-dates/:barber?', (req, res) => {
  res.json({ dates: ['2023-03-25', '2023-03-26', '2023-03-27'] });
});

app.get('/available-times/:date/:barber?', (req, res) => {
  const availableTimes = [
    { time: '9:00 AM', barber: 'Michael' },
    { time: '10:00 AM', barber: 'Michael' },
    { time: '11:00 AM', barber: 'John' }
  ];
  res.json({ availableTimes });
});

app.post('/submit-booking', (req, res) => {
  res.json({ success: true, message: 'Booking submitted successfully (test mode)' });
});

// Export the serverless function
exports.handler = serverless(app);
