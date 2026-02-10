/**
 * Guidance PDF Export
 * Generates downloadable PDF user guides from guidance screens
 */

/**
 * Download Guidance as PDF
 * @param {string} type - Type of guidance: 'ec' | 'voter' | 'super-admin'
 */
export function downloadGuidancePDF(type = 'ec') {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    console.error('jsPDF library not loaded');
    alert('PDF library not ready. Please refresh and try again.');
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);
  let y = 20;

  // Logo/Header
  doc.setFillColor(26, 189, 156);
  doc.rect(0, 0, pageWidth, 30, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont(undefined, 'bold');
  doc.text("NEON VOTING SYSTEM", margin, 15);
  
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  const subtitle = type === 'ec' ? 'Election Commissioner Guide' : 
                   type === 'voter' ? 'Voter Guide' : 
                   'Super Admin Guide';
  doc.text(subtitle, margin, 23);
  
  y = 40;
  doc.setTextColor(0, 0, 0);

  // Get content based on type
  const content = getGuidanceContent(type);
  
  // Render sections
  content.sections.forEach((section, index) => {
    // Check if we need a new page
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    // Section Title
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(26, 189, 156);
    doc.text(section.title, margin, y);
    y += 8;

    // Section Content
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(50, 50, 50);
    
    if (Array.isArray(section.content)) {
      // Handle lists
      section.content.forEach((item, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const bullet = section.ordered ? `${idx + 1}.` : '•';
        const lines = doc.splitTextToSize(`${bullet} ${item}`, contentWidth - 10);
        doc.text(lines, margin + 5, y);
        y += lines.length * 5 + 2;
      });
    } else {
      // Handle paragraphs
      const lines = doc.splitTextToSize(section.content, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 5;
    }

    y += 6; // Space between sections
  });

  // Footer on last page
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  
  y = 270;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('For support, contact: +233 24 765 4381 | gabiondavidselorm@gmail.com', margin, y);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y + 5);

  // Save PDF
  const filename = `Neon-Voting-${type.toUpperCase()}-Guide.pdf`;
  doc.save(filename);
}

/**
 * Get guidance content by type
 */
function getGuidanceContent(type) {
  if (type === 'ec') {
    return {
      sections: [
        {
          title: 'Your Role as Election Commissioner',
          content: 'As an EC, you are responsible for creating, configuring, and managing elections within your organization. Your work is reviewed by Super Admin before voting begins to ensure accuracy and fairness.'
        },
        {
          title: 'How the Election Process Works',
          ordered: true,
          content: [
            'Login - Use your Organization ID and EC password to access your dashboard',
            'Set Up Election - Add positions, candidates, and voters for your election',
            'Submit for Approval - When ready, submit your election to Super Admin for review',
            'Make Corrections (if needed) - If your election is returned, fix issues and resubmit',
            'Monitor Voting - Once approved, voting opens automatically and you can track turnout',
            'View Results - After voting ends, review outcomes and declare results publicly'
          ]
        },
        {
          title: 'Best Practices for Election Commissioners',
          content: [
            'Double-check voter emails/phone numbers before submitting for approval',
            'Verify candidate names, positions, and photos are accurate',
            'Test your election setup before submitting',
            'Respond quickly if Super Admin returns your election for corrections',
            'Monitor voter turnout during the voting period',
            'Archive completed elections before starting a new one'
          ]
        },
        {
          title: 'Features Available to You',
          content: [
            'Voters Tab - Add voters individually or in bulk (CSV/Excel)',
            'Positions Tab - Define election positions and vote limits',
            'Candidates Tab - Add candidates with photos and taglines',
            'Invites Tab - Send voter credentials via email, SMS, or WhatsApp',
            'Outcomes Tab - View real-time results and declare winners',
            'Settings Tab - Configure organization details and election type',
            'Approval Tab - Submit elections and track approval status'
          ]
        }
      ]
    };
  } else if (type === 'voter') {
    return {
      sections: [
        {
          title: 'Your Role as a Voter',
          content: 'As a voter, you have the power to choose leaders and representatives through secure online voting. Your vote is private, secure, and can only be cast once per election.'
        },
        {
          title: 'How to Vote',
          ordered: true,
          content: [
            'Receive your credentials (email, SMS, or WhatsApp) from your Election Commissioner',
            'Login using your Organization ID and personal vote PIN',
            'Review all positions and candidates carefully',
            'Select your preferred candidates for each position',
            'Review your selections before submitting',
            'Submit your vote - you can only vote once',
            'After voting, login again to view election results (up to 10 times)'
          ]
        },
        {
          title: 'Important Voting Guidelines',
          content: [
            'Keep your vote PIN confidential - do not share it with anyone',
            'Vote only once - multiple voting is not allowed',
            'Review all candidates before making your selection',
            'Ensure you vote for all positions (if required)',
            'Submit before the voting deadline ends',
            'Contact your EC immediately if you encounter any issues'
          ]
        },
        {
          title: 'Security & Privacy',
          content: [
            'Your vote is encrypted and anonymous',
            'Results are only visible after the election ends',
            'No one can see how you voted, including Election Commissioners',
            'The system prevents duplicate votes automatically',
            'All votes are stored securely in the cloud'
          ]
        }
      ]
    };
  } else {
    return {
      sections: [
        {
          title: 'Your Role as Super Admin',
          content: 'As Super Admin, you oversee all elections on the Neon Voting System. You approve elections, manage organizations, and ensure platform integrity.'
        },
        {
          title: 'Key Responsibilities',
          content: [
            'Review and approve elections before voting begins',
            'Manage organization accounts and credentials',
            'Monitor platform usage and analytics',
            'Handle escalated support requests',
            'Ensure election integrity and fairness',
            'Configure system-wide settings and alerts'
          ]
        },
        {
          title: 'Dashboard Features',
          content: [
            'Dashboard - View global election metrics and analytics',
            'Organizations - Manage all organization accounts',
            'Approvals - Review and approve pending elections',
            'Settings - Configure system-wide settings',
            'Delete - Archive or remove completed elections'
          ]
        }
      ]
    };
  }
}
