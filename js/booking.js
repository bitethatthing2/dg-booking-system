// API base URL configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8888/.netlify/functions/api'
  : '/.netlify/functions/api';

// DOM elements
const barberSelect = document.getElementById('barber');
const dateSelect = document.getElementById('date');
const timeSelect = document.getElementById('time');
const bookingForm = document.getElementById('bookingForm');
const messageDiv = document.getElementById('message');
const serviceOptions = document.querySelectorAll('.service-option');

// Add special days message
const addSpecialDaysMessage = () => {
  // First check if the message already exists to prevent duplicates
  if (document.querySelector('.special-days-message')) {
    return; // Don't add it again if it already exists
  }
  
  // Create message element
  const specialDaysMessageDiv = document.createElement('div');
  specialDaysMessageDiv.className = 'special-days-message';
  specialDaysMessageDiv.innerHTML = `
    <p class="note"><strong>Note:</strong> We are closed Sundays and Wednesdays. 
    For appointments on these days, please contact Mike directly at <a href="tel:5034008151">(503) 400-8151</a>.</p>
  `;
  
  // Try finding the element in Step 3
  const dateGroup = document.querySelector('.form-section[data-step="3"] .form-group:first-child');
  
  if (dateGroup) {
    // Found the element, append the message
    dateGroup.appendChild(specialDaysMessageDiv);
    console.log("Added special days message to date group");
  } else {
    console.log("Date group not found for special days message");
  }
};

// Helper function to handle API errors
async function handleApiResponse(response) {
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.error || errorJson.message || 'API request failed');
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(`API request failed: ${errorText}`);
      }
      throw e;
    }
  }
  return response.json();
}

// Service selection handling
serviceOptions.forEach(option => {
  option.addEventListener('click', function() {
    serviceOptions.forEach(opt => opt.classList.remove('selected'));
    this.classList.add('selected');
    const radio = this.querySelector('input[type="radio"]');
    radio.checked = true;
  });
});

// Load barbers when page loads
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/available-barbers`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await handleApiResponse(response);
    
    barberSelect.innerHTML = '<option value="">Select a barber</option>';
    
    if (Array.isArray(data.barbers) && data.barbers.length > 0) {
      data.barbers.forEach(barber => {
        const option = document.createElement('option');
        option.value = barber;
        option.textContent = barber;
        barberSelect.appendChild(option);
      });
    } else {
      barberSelect.innerHTML = '<option value="">No barbers available</option>';
      showMessage('No barbers are currently available. Please try again later.', 'warning');
    }
  } catch (error) {
    console.error('Error loading barbers:', error);
    barberSelect.innerHTML = '<option value="">Error loading barbers</option>';
    showMessage(error.message || 'Error loading barbers. Please refresh the page.', 'error');
  }
});

// Load available dates when barber is selected
barberSelect.addEventListener('change', async () => {
  const selectedBarber = barberSelect.value;
  
  dateSelect.innerHTML = '<option value="">Loading dates...</option>';
  timeSelect.innerHTML = '<option value="">Select a date first</option>';
  
  if (!selectedBarber) {
    dateSelect.innerHTML = '<option value="">Select a barber first</option>';
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/available-dates/${selectedBarber}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await handleApiResponse(response);
    
    dateSelect.innerHTML = '<option value="">Select a date</option>';
    
    data.dates.forEach(date => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = formatDate(date);
      dateSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading dates:', error);
    dateSelect.innerHTML = '<option value="">Error loading dates</option>';
    showMessage(error.message || 'Error loading dates. Please try again.', 'error');
  }
});

// Load available times when date is selected
dateSelect.addEventListener('change', async () => {
  const selectedDate = dateSelect.value;
  const selectedBarber = barberSelect.value;
  
  // Reset time select
  timeSelect.innerHTML = '<option value="">Loading times...</option>';
  
  if (!selectedDate) {
    timeSelect.innerHTML = '<option value="">Select a date first</option>';
    return;
  }
  
  try {
    // Ensure the date is properly encoded for the URL
    const encodedDate = encodeURIComponent(selectedDate);
    
    const url = selectedBarber
      ? `${API_BASE_URL}/available-times/${encodedDate}/${selectedBarber}`
      : `${API_BASE_URL}/available-times/${encodedDate}`;
      
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) throw new Error('Failed to fetch times');
    
    const data = await response.json();
    
    // Clear loading option
    timeSelect.innerHTML = '<option value="">Select a time</option>';
    
    // Check if there's a special message (for Sundays and Wednesdays)
    if (data.message) {
      showMessage(data.message, 'warning');
      timeSelect.innerHTML = '<option value="">No times available</option>';
      return;
    }
    
    // Add time options
    data.availableTimes.forEach(timeSlot => {
      const option = document.createElement('option');
      option.value = timeSlot.time;
      option.textContent = `${timeSlot.time} - ${timeSlot.barber}`;
      timeSelect.appendChild(option);
    });
    
    if (data.availableTimes.length === 0) {
      timeSelect.innerHTML = '<option value="">No available times</option>';
    }
  } catch (error) {
    console.error('Error loading times:', error);
    timeSelect.innerHTML = '<option value="">Error loading times</option>';
  }
});

// Form submission
bookingForm.addEventListener('submit', async event => {
  event.preventDefault();
  
  if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
    return;
  }
  
  const selectedServiceInput = document.querySelector('input[name="service"]:checked');
  if (!selectedServiceInput) {
    showMessage('Please select a service.', 'error');
    return;
  }
  
  const formData = {
    barber: barberSelect.value,
    service: selectedServiceInput.value,
    date: dateSelect.value,
    time: timeSelect.value,
    name: document.getElementById('name').value,
    phone: document.getElementById('phone').value,
    email: document.getElementById('email').value
  };
  
  if (!formData.barber || !formData.service || !formData.date || !formData.time || !formData.name) {
    showMessage('Please fill out all required fields.', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/submit-booking`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    const result = await handleApiResponse(response);
    
    if (result.success) {
      showMessage(`Appointment booked successfully! ${formData.email ? 'A confirmation email will be sent shortly.' : ''}`, 'success');
      
      bookingForm.reset();
      serviceOptions.forEach(opt => opt.classList.remove('selected'));
      dateSelect.innerHTML = '<option value="">Select a barber first</option>';
      timeSelect.innerHTML = '<option value="">Select a date first</option>';
    } else {
      showMessage(`Booking failed: ${result.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('Error submitting booking:', error);
    showMessage(error.message || 'There was a problem submitting your booking. Please try again later.', 'error');
  }
});

// Helper Functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function showMessage(text, type) {
  messageDiv.textContent = text;
  messageDiv.className = type;
  messageDiv.style.display = 'block';
  messageDiv.scrollIntoView({ behavior: 'smooth' });
}

function updateProgressBar(currentStep) {
  document.querySelectorAll('.progress-step').forEach(step => {
    const stepNum = parseInt(step.dataset.step);
    step.classList.remove('active', 'completed');
    if (stepNum < currentStep) {
      step.classList.add('completed');
    } else if (stepNum === currentStep) {
      step.classList.add('active');
    }
  });
}

function showStep(stepNumber) {
  document.querySelectorAll('.form-section').forEach(section => {
    section.classList.remove('active');
  });
  document.querySelector(`.form-section[data-step="${stepNumber}"]`).classList.add('active');
  updateProgressBar(stepNumber);
  
  // Add special days message when navigating to step 3
  if (stepNumber === 3) {
    addSpecialDaysMessage();
  }
}

function validateStep(step) {
  switch(step) {
    case 1:
      if (!barberSelect.value) {
        showMessage('Please select a barber to continue.', 'error');
        return false;
      }
      return true;
    case 2:
      const selectedService = document.querySelector('input[name="service"]:checked');
      if (!selectedService) {
        showMessage('Please select a service to continue.', 'error');
        return false;
      }
      return true;
    case 3:
      if (!dateSelect.value || !timeSelect.value) {
        showMessage('Please select both date and time to continue.', 'error');
        return false;
      }
      return true;
    default:
      return true;
  }
}

// Navigation button event listeners
document.querySelectorAll('.btn-next').forEach(button => {
  button.addEventListener('click', function() {
    const currentStep = parseInt(this.closest('.form-section').dataset.step);
    const nextStep = parseInt(this.dataset.next);
    
    if (validateStep(currentStep)) {
      showStep(nextStep);
    }
  });
});

document.querySelectorAll('.btn-prev').forEach(button => {
  button.addEventListener('click', function() {
    const prevStep = parseInt(this.dataset.prev);
    showStep(prevStep);
  });
}); 