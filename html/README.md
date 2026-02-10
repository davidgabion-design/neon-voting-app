# HTML Components

This directory contains modular HTML component files that are dynamically loaded into the main application.

## Structure

```
html/
├── README.md                       # This file
├── gateway.html                    # Role selection screen
├── super-admin/
│   ├── login.html                 # Super Admin login form
│   └── panel.html                 # Super Admin dashboard (tabs)
├── ec/
│   ├── login.html                 # Electoral Commission login form
│   └── panel.html                 # EC dashboard (tabs)
├── voter/
│   ├── login.html                 # Voter login form
│   ├── voting.html                # Ballot/voting screen
│   └── already-voted.html         # Already voted message
├── public/
│   └── results.html               # Public results screen
├── guest/
│   └── screen.html                # Guest view screen
├── modals/
│   └── invite-history.html        # Invite history modal
└── shared/
    └── toasts.html                # Toast notification container
```

## Loading Mechanism

Components are loaded using `js/utils/html-loader.js`:

```javascript
import { loadHTMLComponents } from "./js/utils/html-loader.js";

// Load all components on app init
await loadHTMLComponents([
  { path: "html/gateway.html", containerId: "app" },
  { path: "html/super-admin/login.html", containerId: "app" },
  // ... etc
]);
```

## Component Guidelines

1. **Self-Contained**: Each component should be a complete HTML fragment with all necessary elements and data attributes
2. **No Dependencies**: Components should not reference other components directly
3. **ID Uniqueness**: All element IDs must be globally unique across all components
4. **Styles**: Use existing CSS classes from the main stylesheet (no inline styles)
5. **Scripts**: No `<script>` tags in components - all logic in separate JS modules

## Benefits

- **Better Git Diffs**: Changes isolated to specific component files
- **Parallel Development**: Multiple developers can work on different screens simultaneously
- **Lazy Loading**: Future optimization - load screens only when needed
- **Easier Debugging**: Screen-specific issues → screen-specific files
- **Maintainability**: 200-line index.html vs 4,598-line monolith

## Testing

After modifying a component:

1. Clear browser cache
2. Reload the app
3. Navigate to the affected screen
4. Check browser console for load errors
5. Verify all functionality works as expected
