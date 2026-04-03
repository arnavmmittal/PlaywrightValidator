/**
 * JSON & Markdown Reporter
 * Generates structured JSON and professional Markdown reports
 * for PlaywrightValidator quality assessments.
 */

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const SEVERITY_ICONS = { critical: '[!!]', high: '[!]', medium: '[~]', low: '[.]', info: '[i]' };

const GRADE_RECOMMENDATION = {
  A: 'Site is in excellent health. Continue monitoring to maintain quality standards.',
  B: 'Minor issues identified. Address flagged items to achieve optimal performance.',
  C: 'Several issues require attention. Prioritize critical and high-severity findings.',
  D: 'Critical issues require immediate action. Site quality is below acceptable thresholds.',
  F: 'Critical issues require immediate action. Site quality is significantly below standards.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGradeLetter(grade) {
  if (!grade) return 'N/A';
  return grade.charAt(0);
}

function getRecommendation(grade) {
  return GRADE_RECOMMENDATION[getGradeLetter(grade)] || GRADE_RECOMMENDATION.C;
}

function healthBar(score) {
  if (score == null) return '';
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

function padRight(str, len) {
  str = String(str);
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function padLeft(str, len) {
  str = String(str);
  return str.length >= len ? str : ' '.repeat(len - str.length) + str;
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len - 3) + '...' : str;
}

function tableRow(cells, widths) {
  return '| ' + cells.map((c, i) => padRight(String(c || ''), widths[i])).join(' | ') + ' |';
}

function tableSeparator(widths) {
  return '|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|';
}

// ─── JSON Report ──────────────────────────────────────────────────────────────

function generateJSONReport(report) {
  return JSON.stringify(report, null, 2);
}

// ─── Markdown Report ──────────────────────────────────────────────────────────

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

function generateMarkdownReport(report) {
  const {
    url, timestamp, summary, vitals,
    sourceAudit, bugs, sessionId,
    healthScore = null, grade = null,
  } = report;

  const isAiReport = report.mode === 'ai-agent';
  const duration_ms = report.duration_ms || report.duration || 0;
  const testsRun = report.testsRun || report.stats?.totalBugs || 0;
  const effectiveSummary = summary || report.severityCounts || {};

  const lines = [];
  const push = (...args) => lines.push(...args);
  const blank = () => lines.push('');

  const totalIssues = Object.values(effectiveSummary).reduce((a, b) => a + b, 0);
  const reportDate = new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // ─── Header ─────────────────────────────────────────────────────────

  if (isAiReport) {
    push(`# PlaywrightValidator - AI-Powered ${AI_MODE_LABELS[report.agentMode] || 'Quality Assessment'}`);
  } else {
    push('# PlaywrightValidator - Web Application Quality Assessment');
  }
  blank();
  push('---');
  blank();

  // ─── Health Score ───────────────────────────────────────────────────

  if (healthScore != null && grade) {
    push('## Health Score');
    blank();
    push('```');
    push(`  ${healthBar(healthScore)}  ${healthScore}/100  Grade: ${grade}`);
    push('```');
    blank();
    push(`> **${getRecommendation(grade)}**`);
    blank();
    push('---');
    blank();
  }

  // ─── Table of Contents ──────────────────────────────────────────────

  push('## Table of Contents');
  blank();
  push('1. [Report Overview](#report-overview)');
  push('2. [Executive Summary](#executive-summary)');
  if (healthScore != null) push('3. [Key Findings](#key-findings)');
  push(`${healthScore != null ? '4' : '3'}. [Core Web Vitals](#core-web-vitals)`);
  push(`${healthScore != null ? '5' : '4'}. [Source Audit](#source-audit)`);
  push(`${healthScore != null ? '6' : '5'}. [Detailed Issues](#detailed-issues)`);
  blank();
  push('---');
  blank();

  // ─── Report Overview ────────────────────────────────────────────────

  push('## Report Overview');
  blank();
  push(`| Field | Value |`);
  push(`|-------|-------|`);
  push(`| **Target URL** | \`${url}\` |`);
  push(`| **Date** | ${reportDate} |`);
  push(`| **Session ID** | \`${sessionId || 'N/A'}\` |`);
  push(`| **Duration** | ${(duration_ms / 1000).toFixed(1)}s |`);
  if (isAiReport) {
    push(`| **Testing Mode** | AI Agent — ${AI_MODE_LABELS[report.agentMode] || report.agentMode} |`);
    push(`| **AI Reasoning Turns** | ${report.stats?.aiTurns || 0} |`);
    push(`| **Tool Executions** | ${report.stats?.toolCalls || 0} |`);
  } else {
    push(`| **Tests Executed** | ${testsRun} |`);
  }
  push(`| **Total Issues** | ${totalIssues} |`);
  if (healthScore != null) {
    push(`| **Health Score** | ${healthScore}/100 (${grade}) |`);
  }
  blank();

  // ─── AI Methodology ─────────────────────────────────────────────────

  if (isAiReport) {
    push('## Testing Methodology');
    blank();
    push(`**${AI_MODE_LABELS[report.agentMode] || 'Autonomous Testing'}**`);
    blank();
    push(AI_MODE_DESCRIPTIONS[report.agentMode] || 'Autonomous AI-driven testing.');
    blank();
    push(`> This assessment was conducted by an autonomous AI agent (Claude) equipped with browser automation tools. The agent completed **${report.stats?.toolCalls || 0} tool executions** across **${report.stats?.aiTurns || 0} reasoning cycles**, independently identifying testable surfaces, generating test inputs, and classifying findings by severity.`);
    blank();

    // Category breakdown
    if (bugs && bugs.length > 0) {
      const categories = {};
      bugs.forEach(b => {
        const cat = b.category || 'Uncategorized';
        categories[cat] = (categories[cat] || 0) + 1;
      });

      push('### Findings by Category');
      blank();
      push('| Category | Count |');
      push('|----------|------:|');
      Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
          push(`| ${cat} | ${count} |`);
        });
      blank();
    }

    push('---');
    blank();
  }

  // ─── Executive Summary ──────────────────────────────────────────────

  push('## Executive Summary');
  blank();
  push('| Severity | Count | Distribution |');
  push('|----------|------:|:-------------|');

  SEVERITY_ORDER.forEach(sev => {
    const count = effectiveSummary[sev] || 0;
    const pct = totalIssues > 0 ? Math.round((count / totalIssues) * 100) : 0;
    const icon = SEVERITY_ICONS[sev];
    const bar = '\u2588'.repeat(Math.max(1, Math.round(pct / 5)));
    push(`| ${icon} **${sev.charAt(0).toUpperCase() + sev.slice(1)}** | ${count} | ${bar} ${pct}% |`);
  });

  push(`| | **${totalIssues}** | |`);
  blank();

  // ─── Key Findings ───────────────────────────────────────────────────

  const criticalAndHigh = [...(bugs || [])]
    .filter(b => b.severity === 'critical' || b.severity === 'high')
    .slice(0, 3);

  if (criticalAndHigh.length > 0) {
    push('## Key Findings');
    blank();
    push('The following are the most critical issues identified during the assessment:');
    blank();

    criticalAndHigh.forEach((bug, i) => {
      const icon = SEVERITY_ICONS[bug.severity];
      push(`${i + 1}. **${icon} ${bug.title}** - ${truncate(bug.description, 120)}`);
    });
    blank();

    if (grade) {
      push(`> **Recommendation:** ${getRecommendation(grade)}`);
      blank();
    }

    push('---');
    blank();
  }

  // ─── Core Web Vitals ────────────────────────────────────────────────

  push('## Core Web Vitals');
  blank();

  const vitalLabels = {
    lcp: 'Largest Contentful Paint',
    fid: 'First Input Delay',
    cls: 'Cumulative Layout Shift',
    ttfb: 'Time to First Byte',
    fcp: 'First Contentful Paint',
  };

  const ratingIcons = {
    good: 'PASS',
    'needs-improvement': 'WARN',
    poor: 'FAIL',
    unknown: '  -  ',
  };

  push('| Metric | Value | Rating | Status |');
  push('|--------|------:|--------|:------:|');

  Object.entries(vitals || {}).forEach(([key, data]) => {
    const label = vitalLabels[key] || key.toUpperCase();
    const status = ratingIcons[data.rating] || '?';
    const ratingStr = data.rating ? data.rating.replace('-', ' ') : 'N/A';
    push(`| ${label} | ${data.value}${data.unit} | ${ratingStr} | **${status}** |`);
  });
  blank();

  // ─── Source Audit ───────────────────────────────────────────────────

  push('## Source Audit');
  blank();
  push('| Metric | Value |');
  push('|--------|------:|');
  push(`| Third-Party Scripts | ${sourceAudit?.thirdPartyScripts ?? 'N/A'} |`);
  push(`| Console Errors | ${sourceAudit?.consoleErrors ?? 'N/A'} |`);
  push(`| Inline Event Handlers | ${sourceAudit?.inlineEventHandlers ?? 'N/A'} |`);
  push(`| Total DOM Nodes | ${sourceAudit?.totalDomNodes ?? 'N/A'} |`);
  push(`| Inline Styles | ${sourceAudit?.inlineStyles ?? 'N/A'} |`);
  blank();

  if (sourceAudit?.analyticsProviders?.length > 0) {
    push('**Analytics Providers Detected:**');
    sourceAudit.analyticsProviders.forEach(p => push(`- ${p}`));
    blank();
  }

  if (sourceAudit?.missingMetaTags?.length > 0) {
    push('**Missing Meta Tags:**');
    sourceAudit.missingMetaTags.forEach(tag => push(`- \`${tag}\``));
    blank();
  }

  push('---');
  blank();

  // ─── Detailed Issues ────────────────────────────────────────────────

  push('## Detailed Issues');
  blank();

  const sortedBugs = [...(bugs || [])].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
  });

  if (sortedBugs.length === 0) {
    push('*No issues were identified during this assessment.*');
    blank();
  } else {
    let currentSeverity = null;

    sortedBugs.forEach((bug, index) => {
      // Severity group header
      if (bug.severity !== currentSeverity) {
        currentSeverity = bug.severity;
        const sevCount = sortedBugs.filter(b => b.severity === currentSeverity).length;
        blank();
        push(`### ${SEVERITY_ICONS[currentSeverity]} ${currentSeverity.toUpperCase()} (${sevCount} issue${sevCount !== 1 ? 's' : ''})`);
        blank();
      }

      push(`#### ${index + 1}. ${bug.title}`);
      blank();

      if (bug.category) {
        push(`**Category:** ${bug.category}`);
        blank();
      }

      push(bug.description);
      blank();

      if (bug.stepsToReproduce?.length > 0) {
        push('**Steps to Reproduce:**');
        bug.stepsToReproduce.forEach((step, i) => push(`${i + 1}. ${step}`));
        blank();
      }

      if (bug.expected) push(`**Expected:** ${bug.expected}`);
      if (bug.actual) push(`**Actual:** ${bug.actual}`);
      if (bug.expected || bug.actual) blank();

      if (bug.evidence) {
        push('**Evidence:**');
        push('```');
        push(bug.evidence);
        push('```');
        blank();
      }

      if (bug.recommendation) {
        push(`**Recommendation:** ${bug.recommendation}`);
        blank();
      }

      if (bug.url) {
        push(`**URL:** \`${bug.url}\``);
        blank();
      }

      push('---');
      blank();
    });
  }

  // ─── AI Disclaimer ───────────────────────────────────────────────────

  if (isAiReport) {
    push('---');
    blank();
    push('## Disclaimer');
    blank();
    push('> **This report was generated by an artificial intelligence system and is provided for informational purposes only.** While the AI agent employs systematic testing methodologies, it may produce false positives or miss vulnerabilities that a human security professional would identify. The findings in this report should be independently verified before any remediation actions are taken. This report does not constitute a professional penetration test or security audit and should not be used as the sole basis for security decisions.');
    blank();
    push('> All testing was performed with authorized access. No destructive actions were taken against the target application.');
    blank();
  }

  // ─── Footer ─────────────────────────────────────────────────────────

  push('---');
  blank();
  if (isAiReport) {
    push(`*Report generated by PlaywrightValidator AI Agent on ${reportDate}*`);
    push(`*Agent Mode: ${AI_MODE_LABELS[report.agentMode] || report.agentMode} | Turns: ${report.stats?.aiTurns || 0} | Tools: ${report.stats?.toolCalls || 0}*`);
  } else {
    push(`*Report generated by PlaywrightValidator on ${reportDate}*`);
  }
  push(`*Session: ${sessionId || 'N/A'}*`);
  blank();
  push('> This report is confidential and intended for authorized recipients only.');

  return lines.join('\n');
}

module.exports = { generateJSONReport, generateMarkdownReport };
