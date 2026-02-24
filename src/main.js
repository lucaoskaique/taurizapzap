import './style.css';

// Show loading message briefly, then navigate to WhatsApp Web
document.querySelector('#app').innerHTML = `
  <div class="loading-container">
    <h1>Loading WhatsApp Web...</h1>
    <p>Please wait...</p>
  </div>
`;

// Navigate to WhatsApp Web after a brief moment
setTimeout(() => {
  window.location.href = 'https://web.whatsapp.com';
}, 1000);
