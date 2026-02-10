/**
 * HTML Component Loader
 * 
 * Dynamically loads HTML components from separate files into the main document.
 * Enables modular HTML structure, better git diffs, and parallel development.
 * 
 * Usage:
 *   await loadHTMLComponent('html/gateway.html', 'app');
 *   await loadHTMLComponents([
 *     { path: 'html/gateway.html', containerId: 'app' },
 *     { path: 'html/modals/invite-history.html', containerId: 'app' }
 *   ]);
 */

// Cache to avoid re-fetching the same components
const componentCache = new Map();

/**
 * Load a single HTML component and inject it into a container
 * @param {string} path - Path to the HTML file (relative to root)
 * @param {string} containerId - ID of the container element
 * @param {boolean} append - If true, append to container; if false, replace content
 * @returns {Promise<void>}
 */
export async function loadHTMLComponent(path, containerId, append = true) {
  try {
    // Check cache first
    let html;
    if (componentCache.has(path)) {
      html = componentCache.get(path);
    } else {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
      }
      html = await response.text();
      componentCache.set(path, html);
    }

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element #${containerId} not found`);
    }

    if (append) {
      container.insertAdjacentHTML('beforeend', html);
    } else {
      container.innerHTML = html;
    }

    console.log(`✅ Loaded component: ${path}`);
  } catch (error) {
    console.error(`❌ Error loading component ${path}:`, error);
    throw error;
  }
}

/**
 * Load multiple HTML components in parallel
 * @param {Array<{path: string, containerId: string, append?: boolean}>} components
 * @returns {Promise<void>}
 */
export async function loadHTMLComponents(components) {
  try {
    await Promise.all(
      components.map(({ path, containerId, append }) =>
        loadHTMLComponent(path, containerId, append)
      )
    );
    console.log(`✅ All HTML components loaded successfully`);
  } catch (error) {
    console.error('❌ Error loading HTML components:', error);
    throw error;
  }
}

/**
 * Preload components into cache without injecting them
 * Useful for performance optimization - load components before they're needed
 * @param {Array<string>} paths - Array of component paths to preload
 * @returns {Promise<void>}
 */
export async function preloadComponents(paths) {
  try {
    await Promise.all(
      paths.map(async (path) => {
        if (!componentCache.has(path)) {
          const response = await fetch(path);
          if (!response.ok) {
            throw new Error(`Failed to preload ${path}: ${response.status}`);
          }
          const html = await response.text();
          componentCache.set(path, html);
        }
      })
    );
    console.log(`✅ Preloaded ${paths.length} components into cache`);
  } catch (error) {
    console.error('❌ Error preloading components:', error);
    throw error;
  }
}

/**
 * Check if a component is already loaded in cache
 * @param {string} path - Path to the HTML file
 * @returns {boolean}
 */
export function isComponentLoaded(path) {
  return componentCache.has(path);
}

/**
 * Clear the component cache (useful for development/testing)
 */
export function clearComponentCache() {
  componentCache.clear();
  console.log('✅ Component cache cleared');
}

/**
 * Get cache statistics
 * @returns {{size: number, paths: string[]}}
 */
export function getCacheStats() {
  return {
    size: componentCache.size,
    paths: Array.from(componentCache.keys())
  };
}
