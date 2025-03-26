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

// Utility functions
const setLoading = (element, isLoading) => {
  if (isLoading) {
    element.setAttribute('disabled', true);
    element.classList.add('loading');
    // Store the original text and add a loading spinner
    element.dataset.originalText = element.innerHTML;
    element.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Loading...';
  } else {
    element.removeAttribute('disabled');
    element.classList.remove('loading');
    // Restore the original text
    if (element.dataset.originalText) {
      element.innerHTML = element.dataset.originalText;
    }
  }
};

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
    <p class="note"><strong><i class="bi bi-info-circle"></i> Note:</strong> We are closed Sundays and Wednesdays. 
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
    
    // Add animation to the selected service
    option.classList.add('pulse');
    setTimeout(() => {
      option.classList.remove('pulse');
    }, 500);
  });
});

// Add event listeners to clear error messages when fields are filled
function setupErrorClearingListeners() {
  // Clear messages when barber is selected
  barberSelect.addEventListener('change', () => {
    if (barberSelect.value) {
      hideMessage();
    }
  });
  
  // Clear messages when service is selected
  serviceOptions.forEach(option => {
    option.addEventListener('click', () => {
      hideMessage();
    });
  });
  
  // Clear messages when date or time is selected
  dateSelect.addEventListener('change', () => {
    if (dateSelect.value) {
      hideMessage();
    }
  });
  
  timeSelect.addEventListener('change', () => {
    if (timeSelect.value) {
      hideMessage();
    }
  });
  
  // Clear messages when user information is entered
  document.getElementById('name').addEventListener('input', function() {
    if (this.value.trim()) {
      hideMessage();
    }
  });
}

// Load barbers when page loads
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Setup event listeners to clear error messages
    setupErrorClearingListeners();
    
    const fetchButton = document.querySelector('.btn-next[data-next="2"]');
    setLoading(fetchButton, true);
    
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
    
    setLoading(fetchButton, false);
  } catch (error) {
    console.error('Error loading barbers:', error);
    barberSelect.innerHTML = '<option value="">Error loading barbers</option>';
    showMessage(error.message || 'Error loading barbers. Please refresh the page.', 'error');
    
    const fetchButton = document.querySelector('.btn-next[data-next="2"]');
    setLoading(fetchButton, false);
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
    
    if (data.dates && data.dates.length > 0) {
      // Group dates by month for easier selection
      const datesByMonth = {};
      
      data.dates.forEach(date => {
        const dateObj = new Date(date);
        const monthYear = dateObj.toLocaleDateString('en-US', { 
          month: 'long', 
          year: 'numeric' 
        });
        
        if (!datesByMonth[monthYear]) {
          datesByMonth[monthYear] = [];
        }
        
        datesByMonth[monthYear].push({
          date: date,
          dateObj: dateObj
        });
      });
      
      // Create option groups by month
      Object.keys(datesByMonth).forEach(monthYear => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = monthYear;
        
        // Sort dates in chronological order
        datesByMonth[monthYear].sort((a, b) => a.dateObj - b.dateObj);
        
        datesByMonth[monthYear].forEach(dateInfo => {
          const option = document.createElement('option');
          option.value = dateInfo.date;
          
          // Get day of week for color coding
          const dayOfWeek = dateInfo.dateObj.getDay();
          const dayName = dateInfo.dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          
          // Color code by day of week
          let dayClass = '';
          switch(dayOfWeek) {
            case 1: dayClass = 'monday'; break;    // Monday
            case 2: dayClass = 'tuesday'; break;   // Tuesday
            case 4: dayClass = 'thursday'; break;  // Thursday
            case 5: dayClass = 'friday'; break;    // Friday
            case 6: dayClass = 'saturday'; break;  // Saturday
            default: dayClass = 'other';
          }
          
          const formattedDate = formatDate(dateInfo.date);
          option.textContent = `${dayName} - ${formattedDate}`;
          option.dataset.day = dayClass;
          optgroup.appendChild(option);
        });
        
        dateSelect.appendChild(optgroup);
      });
      
      // Enable custom styling for select options
      if (!document.getElementById('date-select-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'date-select-style';
        styleEl.textContent = `
          option[data-day="monday"] { color: #4285F4; font-weight: bold; }
          option[data-day="tuesday"] { color: #34A853; font-weight: bold; }
          option[data-day="thursday"] { color: #FBBC05; font-weight: bold; }
          option[data-day="friday"] { color: #EA4335; font-weight: bold; }
          option[data-day="saturday"] { color: #9C27B0; font-weight: bold; }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      dateSelect.innerHTML = '<option value="">No available dates</option>';
      showMessage('No available dates found for the selected barber.', 'warning');
    }
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
  
  // Add time icon container if it doesn't exist
  let timeContainer = document.querySelector('.time-container');
  if (!timeContainer) {
    const timeFormGroup = document.querySelector('.form-section[data-step="3"] .form-group:nth-child(2)');
    if (timeFormGroup) {
      // Create container for the time select
      timeContainer = document.createElement('div');
      timeContainer.className = 'time-container';
      
      // Create icon element
      const timeIcon = document.createElement('span');
      timeIcon.className = 'time-icon';
      timeIcon.innerHTML = '<i class="bi bi-clock"></i>';
      
      // Move the time select inside the container
      const timeSelectOriginal = timeFormGroup.querySelector('#time');
      if (timeSelectOriginal && timeSelectOriginal.parentNode === timeFormGroup) {
        timeFormGroup.removeChild(timeSelectOriginal);
        timeContainer.appendChild(timeIcon);
        timeContainer.appendChild(timeSelectOriginal);
        timeFormGroup.appendChild(timeContainer);
      } else {
        // If we can't find the time select as a direct child, just append the icon
        timeContainer.appendChild(timeIcon);
        timeContainer.appendChild(timeSelect); // Use the global timeSelect
        timeFormGroup.appendChild(timeContainer);
      }
    }
  }
  
  if (!selectedDate) {
    timeSelect.innerHTML = '<option value="">Select a date first</option>';
    return;
  }
  
  // Update the time icon with a loading spinner
  const timeIcon = document.querySelector('.time-icon');
  if (timeIcon) {
    timeIcon.innerHTML = '<i class="bi bi-arrow-repeat spin"></i>';
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
      // Reset time icon
      if (timeIcon) {
        timeIcon.innerHTML = '<i class="bi bi-x-circle"></i>';
      }
      return;
    }
    
    // Group times by period (morning, afternoon, evening)
    const timeGroups = {
      'Morning (10:00 AM - 12:00 PM)': [],
      'Afternoon (12:00 PM - 4:00 PM)': [],
      'Evening (4:00 PM - 6:00 PM)': []
    };
    
    // Add time options
    data.availableTimes.forEach(timeSlot => {
      const [time, period] = timeSlot.time.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      
      // Determine which group this time belongs to
      let group = 'Morning (10:00 AM - 12:00 PM)';
      
      if (period === 'PM') {
        if (hours === 12 || (hours >= 1 && hours < 4)) {
          group = 'Afternoon (12:00 PM - 4:00 PM)';
        } else if (hours >= 4 && hours <= 6) {
          group = 'Evening (4:00 PM - 6:00 PM)';
        }
      }
      
      timeGroups[group].push(timeSlot);
    });
    
    // Create option groups
    Object.keys(timeGroups).forEach(group => {
      if (timeGroups[group].length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = group;
        
        // Add icons based on time period
        let iconClass = '';
        if (group.includes('Morning')) {
          iconClass = 'sunrise';
        } else if (group.includes('Afternoon')) {
          iconClass = 'sun';
        } else if (group.includes('Evening')) {
          iconClass = 'moon';
        }
        
        timeGroups[group].forEach(timeSlot => {
          const option = document.createElement('option');
          option.value = timeSlot.time;
          option.textContent = `${timeSlot.time} - ${timeSlot.barber}`;
          option.dataset.icon = iconClass;
          optgroup.appendChild(option);
        });
        
        timeSelect.appendChild(optgroup);
      }
    });
    
    if (data.availableTimes.length === 0) {
      timeSelect.innerHTML = '<option value="">No available times</option>';
      if (timeIcon) {
        timeIcon.innerHTML = '<i class="bi bi-x-circle"></i>';
      }
    } else {
      // Reset time icon
      if (timeIcon) {
        timeIcon.innerHTML = '<i class="bi bi-clock"></i>';
      }
    }
  } catch (error) {
    console.error('Error loading times:', error);
    timeSelect.innerHTML = '<option value="">Error loading times</option>';
    if (timeIcon) {
      timeIcon.innerHTML = '<i class="bi bi-exclamation-circle"></i>';
    }
  }
});

// Add change event for time select to update icon
timeSelect.addEventListener('change', function() {
  const selectedOption = this.options[this.selectedIndex];
  const timeIcon = document.querySelector('.time-icon');
  
  if (timeIcon && selectedOption && selectedOption.dataset.icon) {
    timeIcon.innerHTML = `<i class="bi bi-${selectedOption.dataset.icon}"></i>`;
  } else if (timeIcon) {
    timeIcon.innerHTML = '<i class="bi bi-clock"></i>';
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
    const submitButton = document.querySelector('.btn-submit');
    setLoading(submitButton, true);
    
    const response = await fetch(`${API_BASE_URL}/submit-booking`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    const result = await handleApiResponse(response);
    
    setLoading(submitButton, false);
    
    if (result.success) {
      showMessage(`<i class="bi bi-check-circle"></i> Appointment booked successfully! ${formData.email ? 'A confirmation email will be sent shortly.' : ''}`, 'success');
      
      // Reset form with animation
      document.querySelectorAll('.form-section').forEach(section => {
        section.classList.add('fade-out');
      });
      
      setTimeout(() => {
        bookingForm.reset();
        serviceOptions.forEach(opt => opt.classList.remove('selected'));
        dateSelect.innerHTML = '<option value="">Select a barber first</option>';
        timeSelect.innerHTML = '<option value="">Select a date first</option>';
        
        // Return to step 1
        showStep(1);
        
        document.querySelectorAll('.form-section').forEach(section => {
          section.classList.remove('fade-out');
        });
      }, 500);
    } else {
      showMessage(`<i class="bi bi-exclamation-triangle"></i> Booking failed: ${result.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('Error submitting booking:', error);
    showMessage(`<i class="bi bi-exclamation-triangle"></i> ${error.message || 'There was a problem submitting your booking. Please try again later.'}`, 'error');
    
    const submitButton = document.querySelector('.btn-submit');
    setLoading(submitButton, false);
  }
});

// Helper Functions
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = {
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  };
  
  // Get day of month with suffix (1st, 2nd, 3rd, etc.)
  const day = date.getDate();
  const suffix = getDaySuffix(day);
  
  const formattedDate = date.toLocaleDateString('en-US', options);
  // Replace the day number with the day number + suffix
  return formattedDate.replace(day, `${day}${suffix}`);
}

function getDaySuffix(day) {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function showMessage(text, type) {
  messageDiv.innerHTML = text;
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
  // Hide any existing error messages when changing steps
  hideMessage();
  
  // Apply fade-out animation to the current active section
  const activeSection = document.querySelector('.form-section.active');
  if (activeSection) {
    activeSection.classList.add('fade-out');
    
    setTimeout(() => {
      // After animation completes, switch sections
      document.querySelectorAll('.form-section').forEach(section => {
        section.classList.remove('active', 'fade-out');
      });
      
      // Show the new section
      const newSection = document.querySelector(`.form-section[data-step="${stepNumber}"]`);
      newSection.classList.add('active');
      newSection.classList.add('fade-in');
      
      // Update progress bar
      updateProgressBar(stepNumber);
      
      // Remove animation class after it completes
      setTimeout(() => {
        newSection.classList.remove('fade-in');
      }, 500);
      
    }, 300); // Match with CSS transition duration
  } else {
    // Fallback if no active section (shouldn't happen)
    document.querySelectorAll('.form-section').forEach(section => {
      section.classList.remove('active');
    });
    document.querySelector(`.form-section[data-step="${stepNumber}"]`).classList.add('active');
    updateProgressBar(stepNumber);
  }
  
  // Add special days message when navigating to step 3
  if (stepNumber === 3) {
    addSpecialDaysMessage();
  }
}

// Helper function to hide message
function hideMessage() {
  messageDiv.textContent = '';
  messageDiv.className = '';
  messageDiv.style.display = 'none';
}

function validateStep(step) {
  switch(step) {
    case 1:
      if (!barberSelect.value) {
        showMessage('<i class="bi bi-exclamation-triangle"></i> Please select a barber to continue.', 'error');
        return false;
      }
      return true;
    case 2:
      const selectedService = document.querySelector('input[name="service"]:checked');
      if (!selectedService) {
        showMessage('<i class="bi bi-exclamation-triangle"></i> Please select a service to continue.', 'error');
        return false;
      }
      return true;
    case 3:
      if (!dateSelect.value || !timeSelect.value) {
        showMessage('<i class="bi bi-exclamation-triangle"></i> Please select both date and time to continue.', 'error');
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
    // No validation needed when going back, just hide any messages
    hideMessage();
    showStep(prevStep);
  });
}); 