/**
 * FaviconCell — Favicon image + domain text, handles missing favicons gracefully.
 */

import { useState } from 'react';
import { Globe } from 'lucide-react';

export function FaviconCell({ domain, size = 'md' }) {
  const [imgError, setImgError] = useState(false);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  const imgSize = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  const textSize = size === 'lg' ? 'text-sm' : 'text-xs';

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
      <span className={`${textSize} text-white truncate font-medium`}>{domain}</span>
    </div>
  );
}
