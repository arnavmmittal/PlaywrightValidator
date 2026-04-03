const PDFDocument = require('pdfkit');

// ─── Color Palette ────────────────────────────────────────────────────────────
const COLORS = {
  // Severity
  critical: '#C0392B',
  high: '#E67E22',
  medium: '#F39C12',
  low: '#27AE60',
  info: '#7F8C8D',
  // Web Vitals ratings
  good: '#27AE60',
  'needs-improvement': '#F39C12',
  poor: '#C0392B',
  unknown: '#95A5A6',
  // Brand / layout
  brand: '#1A1A2E',
  brandAccent: '#16213E',
  accent: '#0F3460',
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  mediumGray: '#BDC3C7',
  darkGray: '#2C3E50',
  bodyText: '#34495E',
  muted: '#95A5A6',
  tableBorder: '#D5D8DC',
  tableHeaderBg: '#2C3E50',
  tableStripeBg: '#F8F9FA',
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const SEVERITY_LABELS = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  info: 'INFO',
};

const GRADE_COLORS = {
  'A+': '#1ABC9C', A: '#27AE60', 'A-': '#2ECC71',
  'B+': '#3498DB', B: '#2980B9', 'B-': '#5DADE2',
  'C+': '#F39C12', C: '#E67E22', 'C-': '#D68910',
  'D+': '#E74C3C', D: '#C0392B', 'D-': '#A93226',
  F: '#7B241C',
};

const GRADE_RECOMMENDATION = {
  A: 'Site is in excellent health. Continue monitoring to maintain quality standards.',
  B: 'Minor issues identified. Address flagged items to achieve optimal performance.',
  C: 'Several issues require attention. Prioritize critical and high-severity findings.',
  D: 'Critical issues require immediate action. Site quality is below acceptable thresholds.',
  F: 'Critical issues require immediate action. Site quality is significantly below standards.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGradeColor(grade) {
  return GRADE_COLORS[grade] || COLORS.muted;
}

function getGradeLetter(grade) {
  if (!grade) return 'N/A';
  return grade.charAt(0);
}

function getRecommendation(grade) {
  const letter = getGradeLetter(grade);
  return GRADE_RECOMMENDATION[letter] || GRADE_RECOMMENDATION.C;
}

function formatTimestamp(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len - 3) + '...' : str;
}

// ─── Table Drawing Utility ────────────────────────────────────────────────────

function drawTable(doc, startY, headers, rows, options = {}) {
  const {
    colWidths,
    margin = 50,
    headerFont = 'Helvetica-Bold',
    headerSize = 8,
    bodyFont = 'Helvetica',
    bodySize = 8.5,
    headerBg = COLORS.tableHeaderBg,
    headerColor = COLORS.white,
    stripeBg = COLORS.tableStripeBg,
    rowPadding = 6,
    cellPadding = 6,
  } = options;

  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  let y = startY;

  // Header row
  const headerHeight = headerSize + rowPadding * 2;
  doc.rect(margin, y, tableWidth, headerHeight).fill(headerBg);
  doc.font(headerFont).fontSize(headerSize).fillColor(headerColor);

  let x = margin;
  headers.forEach((h, i) => {
    doc.text(h, x + cellPadding, y + rowPadding, {
      width: colWidths[i] - cellPadding * 2,
      lineBreak: false,
    });
    x += colWidths[i];
  });
  y += headerHeight;

  // Body rows
  rows.forEach((row, rowIdx) => {
    // Estimate row height
    const rowHeight = bodySize + rowPadding * 2;

    // Page break check
    if (y + rowHeight > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }

    // Stripe
    if (rowIdx % 2 === 0) {
      doc.rect(margin, y, tableWidth, rowHeight).fill(stripeBg);
    }

    doc.font(bodyFont).fontSize(bodySize).fillColor(COLORS.bodyText);
    x = margin;
    row.forEach((cell, i) => {
      const cellStr = cell != null ? String(cell) : '';
      // Check if this cell has a custom color
      if (cell && typeof cell === 'object' && cell.__color) {
        doc.fillColor(cell.__color);
        doc.text(cell.text, x + cellPadding, y + rowPadding, {
          width: colWidths[i] - cellPadding * 2,
          lineBreak: false,
        });
        doc.fillColor(COLORS.bodyText);
      } else {
        doc.text(cellStr, x + cellPadding, y + rowPadding, {
          width: colWidths[i] - cellPadding * 2,
          lineBreak: false,
        });
      }
      x += colWidths[i];
    });
    y += rowHeight;
  });

  // Bottom border
  doc.moveTo(margin, y).lineTo(margin + tableWidth, y).lineWidth(0.5).strokeColor(COLORS.tableBorder).stroke();

  return y;
}

// ─── Colored cell helper ──────────────────────────────────────────────────────
function coloredCell(text, color) {
  return { text: String(text), __color: color };
}

// ─── Horizontal rule ──────────────────────────────────────────────────────────
function drawHR(doc, y, margin = 50) {
  const width = doc.page.width - margin * 2;
  doc.moveTo(margin, y).lineTo(margin + width, y)
    .lineWidth(0.5).strokeColor(COLORS.mediumGray).stroke();
  return y + 10;
}

// ─── Section header ───────────────────────────────────────────────────────────
function sectionHeader(doc, title, y) {
  if (y > doc.page.height - 120) {
    doc.addPage();
    y = 50;
  }
  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.brand);
  doc.text(title, 50, y);
  y = doc.y + 4;
  y = drawHR(doc, y);
  return y;
}

// ─── Page footer (called per-page via events) ─────────────────────────────────
function addPageFooters(doc, generationTimestamp) {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = range.start; i < range.start + totalPages; i++) {
    doc.switchToPage(i);
    const pageNum = i - range.start + 1;

    // Footer line
    const footerY = doc.page.height - 45;
    doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY)
      .lineWidth(0.3).strokeColor(COLORS.mediumGray).stroke();

    doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
    doc.text(
      `Generated by PlaywrightValidator  |  ${generationTimestamp}`,
      50, footerY + 6,
      { width: doc.page.width - 100, align: 'left', lineBreak: false }
    );
    doc.text(
      `Page ${pageNum} of ${totalPages}`,
      50, footerY + 6,
      { width: doc.page.width - 100, align: 'right', lineBreak: false }
    );
  }
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

const AI_MODE_LABELS = {
  comprehensive: 'Comprehensive Analysis',
  security: 'Security Penetration Test',
  performance: 'Performance Engineering Audit',
  accessibility: 'Accessibility Compliance Audit (WCAG 2.1 AA)',
  exploratory: 'Exploratory Testing',
  planner: 'Test Planning Assessment',
};

const AI_MODE_DESCRIPTIONS = {
  comprehensive: 'Full-spectrum autonomous testing covering security vulnerabilities, performance bottlenecks, accessibility compliance, and user experience across all testable surfaces of the application.',
  security: 'Targeted penetration testing focused on injection vulnerabilities (XSS, SQLi), authentication bypass, information disclosure, HTTP security header analysis, and OWASP Top 10 compliance.',
  performance: 'Deep performance analysis including Core Web Vitals measurement, resource optimization audit, caching strategy evaluation, third-party script impact analysis, and rendering performance profiling.',
  accessibility: 'WCAG 2.1 Level AA compliance audit covering ARIA usage, heading hierarchy, form labeling, keyboard navigation, color contrast, landmark regions, and assistive technology compatibility.',
  exploratory: 'Creative edge-case discovery and user experience testing including boundary conditions, error handling, state management, responsive behavior, and cross-feature interaction analysis.',
  planner: 'Strategic test planning assessment identifying testable surfaces, risk areas, and recommended testing priorities.',
};

async function generatePDF(report) {
  return new Promise((resolve, reject) => {
    try {
      const isAiReport = report.mode === 'ai-agent';
      const reportTitle = isAiReport
        ? `AI-Powered ${AI_MODE_LABELS[report.agentMode] || 'Quality Assessment'}`
        : 'Web Application Quality Assessment';

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 60, left: 50, right: 50 },
        bufferPages: true,
        info: {
          Title: `PlaywrightValidator - ${reportTitle} - ${report.url}`,
          Author: 'PlaywrightValidator',
          Subject: reportTitle,
          Creator: 'PlaywrightValidator PDF Reporter',
        },
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        url, timestamp, summary, vitals,
        sourceAudit, bugs, sessionId,
        healthScore = null, grade = null,
      } = report;

      // Normalize duration and test count across report types
      const duration_ms = report.duration_ms || report.duration || 0;
      const testsRun = report.testsRun || report.stats?.totalBugs || 0;
      // Merge severityCounts into summary for AI reports
      const effectiveSummary = summary || report.severityCounts || {};

      const generationTimestamp = formatTimestamp(new Date());
      const reportDate = formatTimestamp(timestamp);
      const pageWidth = doc.page.width - 100; // usable width with 50px margins

      // ╔════════════════════════════════════════════════════════════════════╗
      // ║                         COVER PAGE                                ║
      // ╚════════════════════════════════════════════════════════════════════╝

      // Confidential watermark (diagonal, faint)
      doc.save();
      doc.rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] });
      doc.font('Helvetica-Bold').fontSize(60).fillColor(COLORS.lightGray).opacity(0.15);
      doc.text('CONFIDENTIAL', 60, doc.page.height / 2 - 30, { align: 'center' });
      doc.restore();
      doc.opacity(1);

      // Top brand bar
      doc.rect(0, 0, doc.page.width, 6).fill(COLORS.accent);

      // Brand name
      doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.accent);
      doc.text('PlaywrightValidator', 50, 50);

      // Divider under brand
      doc.moveTo(50, 72).lineTo(doc.page.width - 50, 72)
        .lineWidth(1).strokeColor(COLORS.accent).stroke();

      // Main title block - centered vertically
      const titleY = isAiReport ? 180 : 200;

      if (isAiReport) {
        // AI badge
        doc.roundedRect(doc.page.width / 2 - 80, titleY - 30, 160, 24, 12)
          .fill('#A78BFA');
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white);
        doc.text('AI-POWERED ANALYSIS', doc.page.width / 2 - 70, titleY - 25, {
          width: 140, align: 'center'
        });
      }

      doc.font('Helvetica-Bold').fontSize(isAiReport ? 28 : 32).fillColor(COLORS.brand);
      if (isAiReport) {
        doc.text(AI_MODE_LABELS[report.agentMode] || 'Quality Assessment', 50, titleY + 10, { align: 'center', width: pageWidth });
      } else {
        doc.text('Web Application', 50, titleY, { align: 'center', width: pageWidth });
        doc.text('Quality Assessment', 50, doc.y, { align: 'center', width: pageWidth });
      }

      doc.moveDown(1.5);

      // Target URL
      doc.font('Courier').fontSize(12).fillColor(COLORS.accent);
      doc.text(truncate(url, 80), 50, doc.y, { align: 'center', width: pageWidth });

      doc.moveDown(2);

      // Health Score circle area
      if (healthScore != null && grade) {
        const scoreY = doc.y + 10;
        const centerX = doc.page.width / 2;
        const radius = 50;
        const gradeColor = getGradeColor(grade);

        // Outer circle
        doc.circle(centerX, scoreY + radius, radius)
          .lineWidth(4).strokeColor(gradeColor).stroke();

        // Score number
        doc.font('Helvetica-Bold').fontSize(36).fillColor(gradeColor);
        doc.text(String(healthScore), centerX - 40, scoreY + radius - 24, {
          width: 80, align: 'center',
        });

        // Grade letter below circle
        doc.font('Helvetica-Bold').fontSize(22).fillColor(gradeColor);
        doc.text(`Grade: ${grade}`, 50, scoreY + radius + 60, {
          align: 'center', width: pageWidth,
        });

        doc.y = scoreY + radius + 95;
      }

      doc.moveDown(2);

      // Meta info block
      const metaY = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.bodyText);

      const metaLines = [
        ['Date', reportDate],
        ['Session ID', sessionId || 'N/A'],
        ['Duration', `${(duration_ms / 1000).toFixed(1)} seconds`],
      ];
      if (isAiReport) {
        metaLines.push(['Testing Mode', `AI Agent — ${AI_MODE_LABELS[report.agentMode] || report.agentMode}`]);
        metaLines.push(['AI Reasoning Turns', String(report.stats?.aiTurns || 0)]);
        metaLines.push(['Tool Executions', String(report.stats?.toolCalls || 0)]);
        metaLines.push(['Issues Identified', String(report.stats?.totalBugs || 0)]);
      } else {
        metaLines.push(['Tests Executed', String(testsRun)]);
      }

      metaLines.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(`${label}: `, 160, doc.y, { continued: true });
        doc.font('Helvetica').text(value);
      });

      // Bottom brand bar
      doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(COLORS.accent);

      // Classification footer on cover
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
      doc.text('CONFIDENTIAL', 50, doc.page.height - 30, {
        align: 'center', width: pageWidth,
      });

      // ╔════════════════════════════════════════════════════════════════════╗
      // ║                      EXECUTIVE SUMMARY                            ║
      // ╚════════════════════════════════════════════════════════════════════╝

      doc.addPage();
      let y = 50;

      y = sectionHeader(doc, 'Executive Summary', y);

      // Health Score summary
      if (healthScore != null && grade) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.darkGray);
        doc.text('Health Score', 50, y);
        y = doc.y + 4;

        const barWidth = 200;
        const barHeight = 14;
        const fillWidth = Math.round((healthScore / 100) * barWidth);
        const gradeColor = getGradeColor(grade);

        // Background bar
        doc.rect(50, y, barWidth, barHeight).fill(COLORS.lightGray);
        // Fill bar
        doc.rect(50, y, fillWidth, barHeight).fill(gradeColor);
        // Score text
        doc.font('Helvetica-Bold').fontSize(11).fillColor(gradeColor);
        doc.text(`${healthScore}/100 (${grade})`, 50 + barWidth + 12, y + 1);
        y += barHeight + 16;

        // Recommendation
        doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(COLORS.bodyText);
        doc.text(getRecommendation(grade), 50, y, { width: pageWidth });
        y = doc.y + 16;
      }

      // AI Methodology section (before severity table)
      if (isAiReport) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.darkGray);
        doc.text('Testing Methodology', 50, y);
        y = doc.y + 6;

        doc.font('Helvetica').fontSize(9).fillColor(COLORS.bodyText);
        doc.text(
          AI_MODE_DESCRIPTIONS[report.agentMode] || 'Autonomous AI-driven testing using browser automation tools.',
          50, y, { width: pageWidth }
        );
        y = doc.y + 6;

        doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
        doc.text(
          `This assessment was conducted by an autonomous AI agent (Claude) equipped with ${report.stats?.toolCalls || 0} browser tool executions across ${report.stats?.aiTurns || 0} reasoning cycles. The agent independently identified testable surfaces, generated test inputs, analyzed responses, and classified findings by severity. All findings represent observations from the AI agent and should be validated by a human security professional before remediation.`,
          50, y, { width: pageWidth }
        );
        y = doc.y + 16;
      }

      // Issues by severity table
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.darkGray);
      doc.text('Issues by Severity', 50, y);
      y = doc.y + 8;

      const totalIssues = Object.values(effectiveSummary).reduce((a, b) => a + b, 0);

      const severityRows = SEVERITY_ORDER.map(sev => [
        coloredCell(SEVERITY_LABELS[sev], COLORS[sev]),
        String(effectiveSummary[sev] || 0),
        totalIssues > 0
          ? `${Math.round(((effectiveSummary[sev] || 0) / totalIssues) * 100)}%`
          : '0%',
      ]);
      severityRows.push([
        coloredCell('TOTAL', COLORS.darkGray),
        String(totalIssues),
        '100%',
      ]);

      y = drawTable(doc, y,
        ['Severity', 'Count', 'Distribution'],
        severityRows,
        { colWidths: [200, 100, 195] }
      );
      y += 20;

      // Key Findings
      const criticalAndHigh = [...(bugs || [])]
        .filter(b => b.severity === 'critical' || b.severity === 'high')
        .slice(0, 3);

      if (criticalAndHigh.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.darkGray);
        doc.text('Key Findings', 50, y);
        y = doc.y + 8;

        criticalAndHigh.forEach((bug, i) => {
          const sevColor = COLORS[bug.severity];
          doc.font('Helvetica-Bold').fontSize(9).fillColor(sevColor);
          doc.text(`${i + 1}. [${bug.severity.toUpperCase()}]`, 56, y, { continued: true });
          doc.font('Helvetica').fillColor(COLORS.bodyText);
          doc.text(` ${truncate(bug.title, 90)}`, { continued: false });
          y = doc.y + 2;
        });
        y += 10;
      }

      // ╔════════════════════════════════════════════════════════════════════╗
      // ║                      CORE WEB VITALS                              ║
      // ╚════════════════════════════════════════════════════════════════════╝

      doc.addPage();
      y = 50;
      y = sectionHeader(doc, 'Core Web Vitals', y);

      doc.font('Helvetica').fontSize(9).fillColor(COLORS.bodyText);
      doc.text(
        'Core Web Vitals are a set of metrics defined by Google that measure real-world user experience for loading, interactivity, and visual stability.',
        50, y, { width: pageWidth }
      );
      y = doc.y + 14;

      const vitalThresholds = {
        lcp: { good: '< 2500ms', poor: '> 4000ms', label: 'Largest Contentful Paint' },
        fid: { good: '< 100ms', poor: '> 300ms', label: 'First Input Delay' },
        cls: { good: '< 0.1', poor: '> 0.25', label: 'Cumulative Layout Shift' },
        ttfb: { good: '< 800ms', poor: '> 1800ms', label: 'Time to First Byte' },
        fcp: { good: '< 1800ms', poor: '> 3000ms', label: 'First Contentful Paint' },
      };

      const vitalRows = Object.entries(vitals || {}).map(([key, data]) => {
        const threshold = vitalThresholds[key] || {};
        const ratingColor = COLORS[data.rating] || COLORS.muted;
        const passIcon = data.rating === 'good' ? 'PASS' : data.rating === 'poor' ? 'FAIL' : 'WARN';
        return [
          threshold.label || key.toUpperCase(),
          `${data.value}${data.unit}`,
          coloredCell(data.rating ? data.rating.toUpperCase() : 'N/A', ratingColor),
          threshold.good || '-',
          threshold.poor || '-',
          coloredCell(passIcon, ratingColor),
        ];
      });

      y = drawTable(doc, y,
        ['Metric', 'Value', 'Rating', 'Good Threshold', 'Poor Threshold', 'Status'],
        vitalRows,
        { colWidths: [130, 70, 80, 80, 80, 55] }
      );
      y += 24;

      // Legend
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted);
      doc.text('Legend:', 50, y);
      y = doc.y + 3;
      doc.font('Helvetica').fontSize(7.5);
      doc.fillColor(COLORS.good).text('PASS', 50, y, { continued: true });
      doc.fillColor(COLORS.muted).text(' = Within good threshold    ', { continued: true });
      doc.fillColor(COLORS.medium).text('WARN', { continued: true });
      doc.fillColor(COLORS.muted).text(' = Needs improvement    ', { continued: true });
      doc.fillColor(COLORS.poor).text('FAIL', { continued: true });
      doc.fillColor(COLORS.muted).text(' = Exceeds poor threshold');

      // ╔════════════════════════════════════════════════════════════════════╗
      // ║                        SOURCE AUDIT                               ║
      // ╚════════════════════════════════════════════════════════════════════╝

      doc.addPage();
      y = 50;
      y = sectionHeader(doc, 'Source Audit', y);

      doc.font('Helvetica').fontSize(9).fillColor(COLORS.bodyText);
      doc.text(
        'Automated analysis of page source, DOM structure, third-party dependencies, and metadata completeness.',
        50, y, { width: pageWidth }
      );
      y = doc.y + 14;

      const auditMetrics = [
        ['Third-Party Scripts', sourceAudit?.thirdPartyScripts ?? 'N/A'],
        ['Console Errors', sourceAudit?.consoleErrors ?? 'N/A'],
        ['Inline Event Handlers', sourceAudit?.inlineEventHandlers ?? 'N/A'],
        ['Total DOM Nodes', sourceAudit?.totalDomNodes ?? 'N/A'],
        ['Inline Styles', sourceAudit?.inlineStyles ?? 'N/A'],
        ['Deprecated HTML Tags', sourceAudit?.deprecatedTags ?? 'N/A'],
      ].map(([label, value]) => [label, String(value)]);

      y = drawTable(doc, y,
        ['Metric', 'Value'],
        auditMetrics,
        { colWidths: [300, 195] }
      );
      y += 20;

      // Analytics Providers
      if (sourceAudit?.analyticsProviders?.length > 0) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.darkGray);
        doc.text('Analytics Providers Detected', 50, y);
        y = doc.y + 6;

        sourceAudit.analyticsProviders.forEach(provider => {
          doc.font('Helvetica').fontSize(9).fillColor(COLORS.bodyText);
          doc.text(`  \u2022  ${provider}`, 56, y);
          y = doc.y + 2;
        });
        y += 12;
      }

      // Missing Meta Tags
      if (sourceAudit?.missingMetaTags?.length > 0) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.critical);
        doc.text('Missing Meta Tags', 50, y);
        y = doc.y + 6;

        sourceAudit.missingMetaTags.forEach(tag => {
          doc.font('Courier').fontSize(8.5).fillColor(COLORS.bodyText);
          doc.text(`  \u26A0  ${tag}`, 56, y);
          y = doc.y + 2;
        });
      }

      // ╔════════════════════════════════════════════════════════════════════╗
      // ║                          ISSUES                                   ║
      // ╚════════════════════════════════════════════════════════════════════╝

      doc.addPage();
      y = 50;
      y = sectionHeader(doc, 'Detailed Issues', y);

      const sortedBugs = [...(bugs || [])].sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
      });

      if (sortedBugs.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(11).fillColor(COLORS.good);
        doc.text('No issues were identified during this assessment.', 50, y);
      } else {
        let currentSeverity = null;

        sortedBugs.forEach((bug, index) => {
          // Severity group header
          if (bug.severity !== currentSeverity) {
            currentSeverity = bug.severity;
            const sevCount = sortedBugs.filter(b => b.severity === currentSeverity).length;

            // Page break before new severity group (except first)
            if (index > 0) {
              doc.addPage();
              y = 50;
            }

            // Severity banner
            const bannerHeight = 28;
            const sevColor = COLORS[currentSeverity] || COLORS.muted;

            doc.rect(50, y, pageWidth, bannerHeight).fill(sevColor);
            doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.white);
            doc.text(
              `${SEVERITY_LABELS[currentSeverity]} ISSUES (${sevCount})`,
              60, y + 7,
              { width: pageWidth - 20 }
            );
            y += bannerHeight + 14;
          }

          // Check page space - need at least ~120px for an issue
          if (y > doc.page.height - 140) {
            doc.addPage();
            y = 50;
          }

          // Issue number and title
          doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.darkGray);
          doc.text(`${index + 1}. ${bug.title}`, 56, y, { width: pageWidth - 12 });
          y = doc.y + 3;

          // Category tag
          if (bug.category) {
            doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted);
            doc.text(`Category: ${bug.category}`, 62, y);
            y = doc.y + 3;
          }

          // Description
          doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.bodyText);
          doc.text(bug.description, 62, y, { width: pageWidth - 24 });
          y = doc.y + 5;

          // Steps to Reproduce
          if (bug.stepsToReproduce?.length > 0) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.darkGray);
            doc.text('Steps to Reproduce:', 62, y);
            y = doc.y + 2;
            doc.font('Helvetica').fontSize(8).fillColor(COLORS.bodyText);
            bug.stepsToReproduce.forEach((step, i) => {
              doc.text(`${i + 1}. ${step}`, 72, y, { width: pageWidth - 34 });
              y = doc.y + 1;
            });
            y += 3;
          }

          // Expected / Actual
          if (bug.expected) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.good);
            doc.text('Expected: ', 62, y, { continued: true });
            doc.font('Helvetica').fillColor(COLORS.bodyText).text(bug.expected);
            y = doc.y + 1;
          }
          if (bug.actual) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.critical);
            doc.text('Actual: ', 62, y, { continued: true });
            doc.font('Helvetica').fillColor(COLORS.bodyText).text(bug.actual);
            y = doc.y + 1;
          }

          // Evidence (AI agent reports)
          if (bug.evidence) {
            if (y > doc.page.height - 100) { doc.addPage(); y = 50; }
            doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.accent);
            doc.text('Evidence:', 62, y);
            y = doc.y + 2;
            // Code-style evidence block
            const evidenceHeight = Math.min(60, bug.evidence.length * 0.4 + 20);
            doc.rect(62, y, pageWidth - 24, evidenceHeight).fill('#F4F4F7');
            doc.font('Courier').fontSize(7.5).fillColor(COLORS.bodyText);
            doc.text(truncate(bug.evidence, 400), 68, y + 4, { width: pageWidth - 36 });
            y = doc.y + 8;
          }

          // Recommendation (AI agent reports)
          if (bug.recommendation) {
            if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
            doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.good);
            doc.text('Recommendation:', 62, y);
            y = doc.y + 2;
            doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.bodyText);
            doc.text(bug.recommendation, 62, y, { width: pageWidth - 24 });
            y = doc.y + 4;
          }

          // URL if present
          if (bug.url) {
            doc.font('Courier').fontSize(7).fillColor(COLORS.accent);
            doc.text(bug.url, 62, y + 2, { width: pageWidth - 24 });
            y = doc.y + 2;
          }

          // Issue separator
          y += 6;
          doc.moveTo(62, y).lineTo(doc.page.width - 50, y)
            .lineWidth(0.3).strokeColor(COLORS.lightGray).stroke();
          y += 10;
        });
      }

      // ╔════════════════════════════════════════════════════════════════════╗
      // ║                      AI ASSESSMENT APPENDIX                       ║
      // ╚════════════════════════════════════════════════════════════════════╝

      if (isAiReport) {
        doc.addPage();
        y = 50;
        y = sectionHeader(doc, 'Assessment Methodology & Disclaimer', y);

        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.darkGray);
        doc.text('Autonomous Agent Architecture', 50, y);
        y = doc.y + 6;

        doc.font('Helvetica').fontSize(9).fillColor(COLORS.bodyText);
        doc.text(
          'This report was generated by an autonomous AI testing agent powered by Claude (Anthropic). The agent operates through an iterative observe-reason-act loop: it observes page structure using browser automation tools, reasons about potential vulnerabilities and test strategies, executes actions against the target application, and adapts its approach based on observed results.',
          50, y, { width: pageWidth }
        );
        y = doc.y + 12;

        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.darkGray);
        doc.text('Testing Scope', 50, y);
        y = doc.y + 6;

        const modeDesc = AI_MODE_DESCRIPTIONS[report.agentMode] || 'Comprehensive testing.';
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.bodyText);
        doc.text(`Mode: ${AI_MODE_LABELS[report.agentMode] || report.agentMode}`, 50, y, { width: pageWidth });
        y = doc.y + 4;
        doc.text(modeDesc, 50, y, { width: pageWidth });
        y = doc.y + 12;

        // Session statistics table
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.darkGray);
        doc.text('Session Statistics', 50, y);
        y = doc.y + 8;

        const statsRows = [
          ['Total Reasoning Turns', String(report.stats?.aiTurns || 0)],
          ['Browser Tool Executions', String(report.stats?.toolCalls || 0)],
          ['Issues Identified', String(report.stats?.totalBugs || 0)],
          ['Assessment Duration', `${(duration_ms / 1000).toFixed(1)} seconds`],
          ['Health Score', `${healthScore}/100 (Grade: ${grade})`],
        ];

        y = drawTable(doc, y,
          ['Metric', 'Value'],
          statsRows,
          { colWidths: [300, 195] }
        );
        y += 20;

        // Category breakdown
        if (bugs && bugs.length > 0) {
          const categories = {};
          bugs.forEach(b => {
            const cat = b.category || 'Uncategorized';
            categories[cat] = (categories[cat] || 0) + 1;
          });

          doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.darkGray);
          doc.text('Findings by Category', 50, y);
          y = doc.y + 8;

          const catRows = Object.entries(categories)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => [cat, String(count)]);

          y = drawTable(doc, y,
            ['Category', 'Count'],
            catRows,
            { colWidths: [300, 195] }
          );
          y += 20;
        }

        // Disclaimer
        if (y > doc.page.height - 160) { doc.addPage(); y = 50; }

        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.critical);
        doc.text('Important Disclaimer', 50, y);
        y = doc.y + 6;

        doc.rect(50, y, pageWidth, 2).fill(COLORS.critical);
        y += 8;

        doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.bodyText);
        doc.text(
          'This report was generated by an artificial intelligence system and is provided for informational purposes only. While the AI agent employs systematic testing methodologies, it may produce false positives or miss vulnerabilities that a human security professional would identify. The findings in this report should be independently verified before any remediation actions are taken. This report does not constitute a professional penetration test or security audit and should not be used as the sole basis for security decisions. The testing was conducted on the application as observed at the time of the assessment; changes to the application after the assessment date may affect the validity of these findings.',
          50, y, { width: pageWidth }
        );
        y = doc.y + 10;

        doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLORS.muted);
        doc.text(
          'All testing was performed with authorized access. No destructive actions were taken against the target application.',
          50, y, { width: pageWidth }
        );
      }

      // ─── Finalize: add footers to all pages ────────────────────────────
      addPageFooters(doc, generationTimestamp);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePDF };
