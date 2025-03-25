const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

// Create express app
const app = express();
app.use(cors());
app.use(express.json());

// Simple test endpoint
app.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ 
    success: true, 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Basic responses matching frontend expectations
app.get('/available-barbers', (req, res) => {
  res.json({ barbers: ['Test Barber 1', 'Test Barber 2'] });
});

app.get('/available-dates/:barber?', (req, res) => {
  res.json({ dates: ['2023-03-01', '2023-03-02', '2023-03-03'] });
});

app.get('/available-times/:date/:barber?', (req, res) => {
  const availableTimes = [
    { time: '9:00 AM', barber: 'Test Barber 1' },
    { time: '10:00 AM', barber: 'Test Barber 1' },
    { time: '11:00 AM', barber: 'Test Barber 2' }
  ];
  res.json({ availableTimes });
});

app.post('/submit-booking', (req, res) => {
  res.json({ success: true, message: 'Booking submitted successfully (test mode)' });
});

// Export the serverless function
exports.handler = serverless(app); 