// Instead of using Express, let's create a simple function handler
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
          'Content-Type': 'application/json'
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
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: 'API test endpoint is working!',
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Barbers endpoint
    if (path === '/available-barbers') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          barbers: ['Test Barber 1', 'Test Barber 2']
        })
      };
    }
    
    // Dates endpoint
    if (path.startsWith('/available-dates')) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dates: ['2025-03-25', '2025-03-26', '2025-03-27']
        })
      };
    }
    
    // Times endpoint
    if (path.startsWith('/available-times')) {
      const parts = path.split('/');
      const date = parts[2];
      const barber = parts[3] || 'Any barber';
      
      const availableTimes = [
        { time: '9:00 AM', barber: barber },
        { time: '10:00 AM', barber: barber },
        { time: '11:00 AM', barber: barber }
      ];
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ availableTimes })
      };
    }
  }
  
  // Handle POST request for booking
  if (event.httpMethod === 'POST' && path === '/submit-booking') {
    try {
      const body = JSON.parse(event.body);
      console.log('Booking submitted:', body);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: 'Booking received!'
        })
      };
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          message: 'Invalid request body'
        })
      };
    }
  }
  
  // If no route matches, return 404
  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      success: false,
      message: 'Endpoint not found',
      path: path,
      method: event.httpMethod
    })
  };
};