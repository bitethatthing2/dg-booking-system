const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Create a router
const router = express.Router();

// Add a root route for testing
router.get('/', (req, res) => {
  console.log('Root endpoint called');
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Add test endpoint
router.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ 
    success: true, 
    message: 'API test endpoint is working!',
    timestamp: new Date().toISOString()
  });
});

// Add barbers endpoint
router.get('/available-barbers', (req, res) => {
  console.log('Barbers endpoint called');
  res.json({ barbers: ['Test Barber 1', 'Test Barber 2'] });
});

// Add dates endpoint
router.get('/available-dates/:barber?', (req, res) => {
  console.log('Dates endpoint called');
  res.json({ dates: ['2025-03-25', '2025-03-26', '2025-03-27'] });
});

// Add times endpoint
router.get('/available-times/:date/:barber?', (req, res) => {
  console.log('Times endpoint called');
  const availableTimes = [
    { time: '9:00 AM', barber: req.params.barber || 'Any barber' },
    { time: '10:00 AM', barber: req.params.barber || 'Any barber' },
    { time: '11:00 AM', barber: req.params.barber || 'Any barber' }
  ];
  res.json({ availableTimes });
});

// Add booking submission endpoint
router.post('/submit-booking', (req, res) => {
  console.log('Booking submitted:', req.body);
  res.json({ success: true, message: 'Booking received!' });
});

// Mount the router on the app
app.use('/', router);

// Export the serverless handler
module.exports.handler = serverless(app);