import './style.css';

// Prevent WhatsApp from detecting multiple instances
(function preventMultiInstanceDetection() {
  // Override localStorage methods to intercept WhatsApp's conflict detection
  const originalSetItem = localStorage.setItem;
  const originalGetItem = localStorage.getItem;
  
  localStorage.setItem = function(key, value) {
    // Prevent storing conflict markers
    if (key && (
      key.includes('WASecretBundle') ||
      key.includes('WAToken') ||
      key.includes('last-wid') ||
      key.includes('model-storage')
    )) {
      console.log('[TaurApp] Intercepted localStorage.setItem for:', key);
      // Don't store these keys
      return;
    }
    return originalSetItem.apply(this, arguments);
  };
  
  localStorage.getItem = function(key) {
    // Return null for conflict detection keys
    if (key && (
      key.includes('WASecretBundle') ||
      key.includes('WAToken') ||
      key.includes('last-wid') ||
      key.includes('model-storage')
    )) {
      console.log('[TaurApp] Intercepted localStorage.getItem for:', key);
      return null;
    }
    return originalGetItem.apply(this, arguments);
  };
  
  console.log('[TaurApp] Multi-instance detection prevention active');
})();

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
