/**
 * HowItWorks — Transparent methodology section.
 * Shows the 3-step pipeline: Collect → Score → Analyze.
 * Critical for HN credibility — explains what makes this different from Lighthouse.
 */

import { Gauge, Calculator, Brain, FlaskConical, Repeat, Lock } from 'lucide-react';

const STEPS = [
  {
    icon: Gauge,
    number: '01',
    title: 'Deterministic Collection',
    description: 'Playwright runs 10 identical passes per site under simulated 4G conditions (1.5 Mbps, 150ms latency). We capture LCP, FCP, CLS, TTFB, TBT, resource counts, DOM complexity, security headers, compression, and a screenshot.',
    detail: 'Reports p50 (median) and p95 (outlier) percentiles. Same browser, same viewport, same throttled network — reproducible, statistically meaningful results.',
    color: '#E8FF47',
  },
  {
    icon: Calculator,
    number: '02',
    title: 'Weighted Scoring',
    description: 'Each metric is scored 0-100 against synthetic 4G thresholds. Weights: LCP 30%, TTFB 20%, TBT 15%, FCP 15%, Security 15%, CLS 5%. INP is excluded (requires real interaction).',
    detail: 'Pure math, fully reproducible — no LLM involved in scoring. Scores reflect synthetic conditions, not real-user (RUM) data. Security headers (HTTPS, HSTS, CSP, etc.) are 15% of the score.',
    color: '#4ECDC4',
  },
  {
    icon: Brain,
    number: '03',
    title: 'Structured Analysis',
    description: 'Pre-collected data is analyzed via constrained tool use — a structured report_findings schema is required. No free-form output possible.',
    detail: 'Explains why scores are what they are and identifies architectural patterns — never generates or overrides deterministic scores.',
    color: '#A78BFA',
  },
];

const PRINCIPLES = [
  { icon: Repeat, text: 'Reproducible — same site, same score every time' },
  { icon: FlaskConical, text: 'Transparent — synthetic testing with known limitations' },
  { icon: Lock, text: 'Constrained — analysis explains, never fabricates metrics' },
];

const LIMITATIONS = [
  'Scores are synthetic 4G benchmarks, not real-user (RUM) data. A site\'s actual performance depends on user device, network, and location.',
  'CLS is near-zero in headless browsers — real users experience more layout shifts from fonts, ads, and lazy images. Weighted at only 5%.',
  'INP (Interaction to Next Paint) requires real user interaction — excluded from scoring entirely. Consult CrUX for real INP data.',
  'Tests run from a single geographic location (Railway US) — CDN edge performance may differ for global users.',
  'No CPU throttling applied — mobile devices with slower processors will see worse TBT.',
  'Sites that block headless browsers (Cloudflare, CAPTCHAs) are flagged but cannot be benchmarked.',
  'Analysis commentary is advisory and may contain errors — deterministic metrics are the source of truth.',
];

export function HowItWorks() {
  return (
    <section className="py-16 px-6 lg:px-12 border-t border-[#1A1A1A]">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-lg font-semibold text-white">How It Works</h2>
          <div className="flex-1 h-px bg-[#1A1A1A]" />
        </div>
        <p className="text-sm text-[#666666] mb-10 max-w-2xl">
          Unlike Lighthouse, PerfRank separates data collection from analysis.
          Deterministic metrics first, then constrained reasoning — never the other way around.
        </p>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="bg-[#141414] border border-[#1A1A1A] rounded-lg p-5 relative group hover:border-[#2A2A2A] transition-colors">
                {/* Step number */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: step.color, backgroundColor: `${step.color}15` }}>
                    {step.number}
                  </span>
                  <Icon className="w-4 h-4" style={{ color: step.color }} />
                </div>

                <h3 className="text-sm font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-xs text-[#A0A0A0] leading-relaxed mb-3">{step.description}</p>
                <p className="text-[10px] text-[#3A3A3A] leading-relaxed italic">{step.detail}</p>
              </div>
            );
          })}
        </div>

        {/* Principles */}
        <div className="flex flex-wrap gap-4 justify-center mb-12">
          {PRINCIPLES.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} className="inline-flex items-center gap-2 bg-[#0D0D0D] border border-[#1A1A1A] rounded-full px-4 py-2">
                <Icon className="w-3.5 h-3.5 text-[#3A3A3A]" />
                <span className="text-xs text-[#666666]">{p.text}</span>
              </div>
            );
          })}
        </div>

        {/* Known Limitations — honesty builds credibility */}
        <div className="bg-[#141414] border border-[#1A1A1A] rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="w-4 h-4 text-[#3A3A3A]" />
            <h3 className="text-sm font-semibold text-[#666666]">Known Limitations</h3>
          </div>
          <ul className="space-y-1.5">
            {LIMITATIONS.map((lim, i) => (
              <li key={i} className="text-[11px] text-[#3A3A3A] leading-relaxed flex items-start gap-2">
                <span className="text-[#2A2A2A] mt-0.5">•</span>
                {lim}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
