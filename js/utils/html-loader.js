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
    let html;
    if (componentCache.has(path)) {
      html = componentCache.get(path);
    } else {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) {
        console.warn(`[html-loader] fetch failed: ${path} ${response.status}`);
        return { ok: false, reason: 'fetch_failed', status: response.status };
      }
      html = await response.text();
      componentCache.set(path, html);
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[html-loader] target not found: ${containerId}`);
      return { ok: false, reason: 'target_missing' };
    }

    if (append) {
      container.insertAdjacentHTML('beforeend', html);
    } else {
      container.innerHTML = html;
    }

    console.log(`✅ Loaded component: ${path}`);
    return { ok: true };
  } catch (error) {
    console.error(`[html-loader] loadComponent crashed: ${path}`, error);
    return { ok: false, reason: 'exception', error: String(error?.message || error) };
  }
}

/**
 * Load multiple HTML components in parallel
 * @param {Array<{path: string, containerId: string, append?: boolean}>} components
 * @returns {Promise<void>}
 */
export async function loadHTMLComponents(components) {
  try {
    const results = await Promise.all(
      components.map(({ path, containerId, append }) =>
        loadHTMLComponent(path, containerId, append)
      )
    );

    const failed = results.filter(r => r && r.ok === false);
    if (failed.length) {
      console.warn('[html-loader] Some components failed to load:', failed);
      return { ok: false, failed };
    }

    console.log(`✅ All HTML components loaded successfully`);
    return { ok: true };
  } catch (error) {
    console.error('[html-loader] Error loading components:', error);
    return { ok: false, reason: 'exception', error: String(error?.message || error) };
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
          const response = await fetch(path, { cache: 'no-store' });
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
