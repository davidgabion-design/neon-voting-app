/**
 * Interactive Tooltip Walkthrough
 * Shows contextual hints for first-time users
 */

/**
 * Show a tooltip hint next to a target element
 * @param {string} targetId - Element ID to attach tooltip to
 * @param {string} text - Tooltip text content
 * @param {number} duration - How long to show tooltip (ms), 0 = until dismissed
 */
export function showTip(targetId, text, duration = 5000) {
  const el = document.getElementById(targetId);
  if (!el) {
    console.warn(`Tooltip target not found: ${targetId}`);
    return;
  }

  // Remove any existing tooltips
  document.querySelectorAll('.walktip').forEach(tip => tip.remove());

  const rect = el.getBoundingClientRect();
  const tip = document.createElement('div');
  tip.className = 'walktip';
  tip.innerHTML = `
    <div style="display:flex;align-items:start;gap:10px">
      <i class="fas fa-lightbulb" style="color:#FFD700;font-size:18px;margin-top:2px"></i>
      <div style="flex:1">${text}</div>
      <button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:#00eaff;cursor:pointer;font-size:18px;padding:0;line-height:1">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;

  document.body.appendChild(tip);

  // Position tooltip
  const tipRect = tip.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Default position: below element
  let top = rect.bottom + window.scrollY + 8;
  let left = rect.left + window.scrollX;

  // Check if tooltip goes off-screen
  if (top + tipRect.height > viewportHeight + window.scrollY) {
    // Position above instead
    top = rect.top + window.scrollY - tipRect.height - 8;
  }

  if (left + tipRect.width > viewportWidth) {
    // Align to right edge
    left = viewportWidth - tipRect.width - 20;
  }

  if (left < 10) {
    left = 10;
  }

  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (tip.parentElement) {
        tip.remove();
      }
    }, duration);
  }
}

/**
 * Show a walkthrough sequence of tips
 * @param {Array<{targetId: string, text: string, delay: number}>} steps
 */
export async function showWalkthrough(steps) {
  for (const step of steps) {
    await new Promise(resolve => {
      showTip(step.targetId, step.text, 0);
      
      // Wait for user to dismiss or auto-advance
      const checkInterval = setInterval(() => {
        if (!document.querySelector('.walktip')) {
          clearInterval(checkInterval);
          setTimeout(resolve, step.delay || 1000);
        }
      }, 100);
      
      // Auto-advance after 10 seconds if not dismissed
      setTimeout(() => {
        document.querySelectorAll('.walktip').forEach(t => t.remove());
        clearInterval(checkInterval);
        resolve();
      }, 10000);
    });
  }
}

/**
 * Show EC first-time walkthrough
 */
export function showECWalkthrough() {
  // Check if user has seen walkthrough
  const ecWalkthroughSeen = localStorage.getItem('neon_ec_walkthrough_seen');
  if (ecWalkthroughSeen) return;

  // Wait for panel to load
  setTimeout(() => {
    const steps = [
      {
        targetId: 'ecTab-voters',
        text: 'Start here: Add voters who will participate in your election.',
        delay: 1000
      },
      {
        targetId: 'ecTab-positions',
        text: 'Next, define the positions you\'re voting for (e.g., President, Secretary).',
        delay: 1000
      },
      {
        targetId: 'ecTab-candidates',
        text: 'Add candidates for each position with photos and details.',
        delay: 1000
      },
      {
        targetId: 'ecTab-approval',
        text: 'Finally, submit your election to SuperAdmin for approval.',
        delay: 1000
      }
    ];

    showWalkthrough(steps);
    localStorage.setItem('neon_ec_walkthrough_seen', 'true');
  }, 2000);
}

/**
 * Show Voter first-time walkthrough
 */
export function showVoterWalkthrough() {
  const voterWalkthroughSeen = localStorage.getItem('neon_voter_walkthrough_seen');
  if (voterWalkthroughSeen) return;

  setTimeout(() => {
    showTip('votingBallot', 'Select your preferred candidate for each position, then submit your vote at the bottom.', 8000);
    localStorage.setItem('neon_voter_walkthrough_seen', 'true');
  }, 1500);
}

/**
 * Reset walkthrough flags (for testing)
 */
export function resetWalkthroughs() {
  localStorage.removeItem('neon_ec_walkthrough_seen');
  localStorage.removeItem('neon_voter_walkthrough_seen');
  console.log('✅ Walkthrough flags reset');
}
