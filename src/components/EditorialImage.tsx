import { Newspaper } from 'lucide-react';
import { useState } from 'react';
import { EDITORIAL_IMAGES } from '../data/clientAssets';
import type { ImageKey } from '../data/newsData';

interface EditorialImageProps {
  imageKey: ImageKey;
  alt: string;
  className?: string;
}

export function EditorialImage({ imageKey, alt, className = '' }: EditorialImageProps) {
  const [hasError, setHasError] = useState(false);
  const src = EDITORIAL_IMAGES[imageKey];

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EFECE6] dark:bg-[#1F1E1B] text-[#57534E] dark:text-[#A8A29E] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Newspaper className="w-8 h-8 mb-2 opacity-60" strokeWidth={1.5} />
        <p className="text-xs font-medium max-w-xs leading-relaxed">{alt}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`block w-full object-cover ${className}`}
    />
  );
}
