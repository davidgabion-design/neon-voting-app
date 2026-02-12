/**
 * Internationalization (i18n) Module
 * Handles multi-language support throughout the application
 */

let currentLanguage = 'ENG';
let translations = {};

/**
 * Load language dictionary and apply translations
 * @param {string} lang - Language code ('ENG' | 'SPA' | 'FRE' | 'POR' | 'TWI')
 * @param {boolean} autoRefresh - Whether to auto-refresh the page after language change
 */
export async function loadLanguage(lang = 'ENG', autoRefresh = true) {
  try {
    console.log(`🌐 Loading language: ${lang}`);
    
    // Handle both relative paths (from subfolders) and root paths
    let response;
    try {
      response = await fetch(`./lang/${lang.toLowerCase()}.json`);
      if (!response.ok) throw new Error('Try alternative path');
    } catch {
      try {
        response = await fetch(`../lang/${lang.toLowerCase()}.json`);
        if (!response.ok) throw new Error('Try double parent');
      } catch {
        response = await fetch(`../../lang/${lang.toLowerCase()}.json`);
      }
    }
    
    if (!response.ok) {
      throw new Error(`Failed to load language: ${lang} (${response.status})`);
    }
    
    translations = await response.json();
    currentLanguage = lang.toUpperCase();
    
    console.log(`📖 Loaded ${Object.keys(translations).length} translation keys`);
    
    // Save preference FIRST before any refresh
    localStorage.setItem('neon_voting_lang', lang.toUpperCase());
    
    // Update all language selectors across the app
    const selectors = '#langSelect, #gatewayLangSelect, #ecLangSelect, #superAdminLangSelect, #adminLoginLangSelect, #adminPanelLangSelect, #voterLangSelect, #ecLoginLangSelect, #voterLoginLangSelect';
    document.querySelectorAll(selectors).forEach(selector => {
      if (selector) selector.value = lang.toUpperCase();
    });
    
    // Apply translations to all elements with data-i18n attribute
    applyTranslations();
    
    // Auto-refresh page to apply translations everywhere (panels, dynamic content, etc.)
    if (autoRefresh) {
      console.log('🔄 Refreshing page to apply language changes...');
      setTimeout(() => {
        window.location.reload();
      }, 300);
      return; // Don't continue execution after reload is triggered
    }
    
    // Trigger custom event for dynamic content refresh (if not auto-refreshing)
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    
    console.log(`✅ Language loaded: ${lang}`);
  } catch(e) {
    console.error('Failed to load language:', e);
    // Fallback to English if something fails
    if (lang.toUpperCase() !== 'ENG') {
      await loadLanguage('ENG', autoRefresh);
    }
  }
}

/**
 * Apply translations to all elements with data-i18n attributes
 */
function applyTranslations() {
  let translatedCount = 0;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (translations[key]) {
      // Handle elements that might contain HTML formatting
      const translation = translations[key];
      
      // Check if element has child elements or if translation contains HTML markers
      if (el.children.length === 0 && !translation.includes('<strong>') && !translation.includes('<br>')) {
        // Simple text replacement
        el.textContent = translation;
        translatedCount++;
      } else {
        // For elements with children or HTML, try to preserve structure
        // Replace text nodes only
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
          el.textContent = translation;
          translatedCount++;
        } else {
          // Complex case: has mixed content, use innerHTML carefully
          // Only update if no special formatting elements exist
          const specialElements = el.querySelectorAll('i, svg, img, button');
          if (specialElements.length === 0) {
            el.textContent = translation;
            translatedCount++;
          } else {
            // Keep special elements, update text nodes
            const textContent = el.textContent.trim();
            if (textContent) {
              // Simple heuristic: replace first text node
              const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
              const textNode = walker.nextNode();
              if (textNode && textNode.parentNode === el) {
                textNode.textContent = translation;
                translatedCount++;
              }
            }
          }
        }
      }
    }
  });
  
  console.log(`✅ Applied ${translatedCount} translations`);
}

/**
 * Get translation for a key
 * @param {string} key - Translation key
 * @returns {string} Translated text or key if not found
 */
export function t(key) {
  return translations[key] || key;
}

/**
 * Get current language code
 */
export function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * Initialize language from saved preference or default
 */
export async function initLanguage() {
  const savedLang = localStorage.getItem('neon_voting_lang') || 'ENG';
  await loadLanguage(savedLang, false); // Don't refresh on initial load
  
  // Update all language selectors if they exist
  const selectors = '#langSelect, #gatewayLangSelect, #ecLangSelect, #superAdminLangSelect, #adminLoginLangSelect, #adminPanelLangSelect, #voterLangSelect, #ecLoginLangSelect, #voterLoginLangSelect';
  document.querySelectorAll(selectors).forEach(selector => {
    if (selector) selector.value = savedLang;
  });
}

/**
 * Setup language selector on guidance screens
 */
export function setupLanguageSelector() {
  const selector = document.getElementById('langSelect');
  if (selector) {
    selector.addEventListener('change', (e) => {
      loadLanguage(e.target.value, true); // Auto-refresh on change
    });
    
    // Set initial value
    selector.value = currentLanguage;
  }
}
