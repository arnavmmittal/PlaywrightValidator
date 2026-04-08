/**
 * FaviconCell — Favicon image + domain text, handles missing favicons gracefully.
 */

import { useState } from 'react';
import { Globe } from 'lucide-react';

export function FaviconCell({ domain, url, size = 'md' }) {
  const [imgError, setImgError] = useState(false);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  const imgSize = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  const textSize = size === 'lg' ? 'text-sm' : 'text-xs';

  // Show path if it's not just the homepage
  let pathLabel = null;
  if (url) {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname + parsed.search;
      if (path && path !== '/') pathLabel = path;
    } catch {}
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {imgError ? (
        <Globe className={`${imgSize} text-[#3A3A3A] flex-shrink-0`} />
      ) : (
        <img
          src={faviconUrl}
          alt=""
          className={`${imgSize} rounded-sm flex-shrink-0`}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      )}
      <div className="min-w-0">
        <span className={`${textSize} text-white truncate font-medium block`}>{domain}</span>
        {pathLabel && (
          <span className="text-[10px] text-[#3A3A3A] truncate block max-w-[180px]">{pathLabel}</span>
        )}
      </div>
    </div>
  );
}
