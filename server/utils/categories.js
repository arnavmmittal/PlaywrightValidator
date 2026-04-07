/**
 * Website Category Detection
 *
 * Maps known domains to categories. Used by both the leaderboard API
 * and the seed script.
 */

const CATEGORY_MAP = {
  'search': ['google.com', 'bing.com', 'duckduckgo.com', 'baidu.com'],
  'news': ['cnn.com', 'bbc.com', 'nytimes.com', 'reuters.com', 'theguardian.com'],
  'social': ['reddit.com', 'x.com', 'twitter.com', 'facebook.com', 'instagram.com'],
  'video': ['youtube.com', 'vimeo.com', 'twitch.tv'],
  'dev-tools': ['github.com', 'stackoverflow.com', 'gitlab.com', 'linear.app'],
  'ai': ['chat.openai.com', 'claude.ai', 'perplexity.ai', 'copilot.microsoft.com'],
  'infra': ['vercel.com', 'fly.io', 'supabase.com', 'cloudflare.com', 'stripe.com'],
  'e-commerce': ['amazon.com', 'shopify.com', 'ebay.com', 'etsy.com'],
  'reference': ['wikipedia.org', 'wikimedia.org'],
  'community': ['news.ycombinator.com', 'lobste.rs'],
};

/**
 * Detect category from a domain string.
 * @param {string} domain - e.g. "github.com"
 * @returns {string} Category slug or "other"
 */
function detectCategory(domain) {
  for (const [category, domains] of Object.entries(CATEGORY_MAP)) {
    if (domains.some(d => domain === d || domain.endsWith('.' + d))) {
      return category;
    }
  }
  return 'other';
}

module.exports = { detectCategory, CATEGORY_MAP };
