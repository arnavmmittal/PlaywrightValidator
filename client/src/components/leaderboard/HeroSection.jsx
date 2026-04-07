/**
 * HeroSection — Full-width dark hero with gradient mesh bg, URL input, and recent sites ticker.
 * Adapted from 21st.dev MCP template, customized for our design system.
 */

import { useState, useEffect } from 'react';
import { Zap, Globe, ArrowRight, Loader2 } from 'lucide-react';
import { GradeBadge } from './GradeBadge';

export function HeroSection({ onBenchmark, recentSites = [], isLoading = false, rateLimitRemaining = 2 }) {
  const [url, setUrl] = useState('');
  const [currentSiteIndex, setCurrentSiteIndex] = useState(0);

  // Rotate through recent sites
  useEffect(() => {
    if (recentSites.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSiteIndex((prev) => (prev + 1) % recentSites.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [recentSites.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    onBenchmark(url.trim());
  };

  const handleQuickBenchmark = (siteUrl) => {
    if (isLoading) return;
    setUrl(siteUrl);
    onBenchmark(siteUrl);
  };

  return (
    <div className="relative w-full overflow-hidden">
      {/* Animated Gradient Mesh Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-purple-600/15 via-blue-600/10 to-transparent blur-3xl animate-pulse"
          style={{ animationDuration: '8s' }}
        />
        <div
          className="absolute top-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-cyan-600/10 via-teal-600/10 to-transparent blur-3xl animate-pulse"
          style={{ animationDuration: '10s', animationDelay: '2s' }}
        />
        <div
          className="absolute -bottom-1/4 left-1/3 w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-violet-600/10 via-purple-600/10 to-transparent blur-3xl animate-pulse"
          style={{ animationDuration: '12s', animationDelay: '4s' }}
        />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:80px_80px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-4 pt-16 pb-12">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] bg-[#141414]/80 px-4 py-1.5 backdrop-blur-sm">
          <Zap className="w-3.5 h-3.5 text-[#E8FF47]" />
          <span className="text-xs text-[#A0A0A0]">AI-Powered Performance Analysis</span>
        </div>

        {/* Heading */}
        <h1 className="text-center text-4xl md:text-6xl font-bold tracking-tight mb-4">
          <span className="text-white">How fast is your site,</span>
          <br />
          <span className="text-[#E8FF47]">really?</span>
        </h1>

        {/* Subtext */}
        <p className="text-center text-sm md:text-base text-[#666666] mb-10 max-w-xl">
          Deterministic Playwright benchmarks. Constrained AI analysis.
          <br className="hidden sm:block" />
          Public leaderboard. No login required.
        </p>

        {/* URL Input */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-6">
          <div className="relative group">
            {/* Glow effect */}
            <div className="absolute -inset-0.5 bg-[#E8FF47]/0 group-focus-within:bg-[#E8FF47]/20 rounded-xl blur-lg transition-all duration-500" />

            <div className="relative flex items-center gap-2 bg-[#141414] border border-[#2A2A2A] group-focus-within:border-[#E8FF47]/50 rounded-xl p-2 transition-colors">
              <Globe className="w-5 h-5 text-[#3A3A3A] ml-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Enter any URL to benchmark..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-transparent text-white text-sm md:text-base placeholder:text-[#3A3A3A] outline-none h-10 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!url.trim() || isLoading || rateLimitRemaining <= 0}
                className="flex items-center gap-2 bg-[#E8FF47] hover:bg-[#d4eb33] disabled:bg-[#E8FF47]/30 disabled:text-black/30 text-black font-semibold px-5 h-10 rounded-lg text-sm transition-all duration-200 hover:shadow-[0_0_20px_rgba(232,255,71,0.3)] disabled:hover:shadow-none flex-shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Benchmark
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Rate limit info */}
        <div className="text-xs text-[#3A3A3A] mb-8">
          {rateLimitRemaining > 0
            ? `${rateLimitRemaining} benchmark${rateLimitRemaining !== 1 ? 's' : ''} remaining today`
            : 'Daily limit reached — try again tomorrow'}
        </div>

        {/* Recent Sites Ticker */}
        {recentSites.length > 0 && (
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-3 text-xs text-[#3A3A3A] mb-3">
              <span>Recently benchmarked</span>
              <div className="flex-1 h-px bg-[#1A1A1A]" />
            </div>

            <div className="flex flex-wrap gap-2">
              {recentSites.slice(0, 6).map((site) => (
                <button
                  key={site.domain}
                  onClick={() => handleQuickBenchmark(`https://${site.domain}/`)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#1A1A1A] bg-[#0D0D0D] hover:border-[#2A2A2A] hover:bg-[#141414] px-3 py-1.5 transition-colors group"
                >
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${site.domain}&sz=16`}
                    alt=""
                    className="w-3.5 h-3.5 rounded-sm"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <span className="text-xs text-[#666666] group-hover:text-[#A0A0A0] transition-colors">
                    {site.domain}
                  </span>
                  <GradeBadge grade={site.grade} size="sm" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
