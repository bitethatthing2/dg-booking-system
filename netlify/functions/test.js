const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Simple test endpoint that doesn't require any external services
app.get('/', (req, res) => {
  console.log('Test endpoint called');
  res.json({ 
    success: true, 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Export the serverless function
exports.handler = serverless(app); 