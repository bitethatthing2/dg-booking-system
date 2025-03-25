const express = require('express');
const path = require('path');
const app = express();
const PORT = 8080;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Route for the booking form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'booking-form.html'));
});

// Route for the calendar page
app.get('/calendar', (req, res) => {
  res.sendFile(path.join(__dirname, 'calendar.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Form server running at http://localhost:${PORT}`);
  console.log(`Make sure the booking API server is running on port 3002`);
}); 