import { useEffect } from 'react';

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function ImageLightbox({
  isOpen,
  onClose,
  images,
  currentIndex,
  onIndexChange,
}: ImageLightboxProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        onIndexChange((currentIndex - 1 + images.length) % images.length);
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        onIndexChange((currentIndex + 1) % images.length);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentIndex, images, onClose, onIndexChange]);

  if (!isOpen || !images || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onIndexChange((currentIndex - 1 + images.length) % images.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onIndexChange((currentIndex + 1) % images.length);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/30 backdrop-blur-2xl transition-opacity duration-300 animate-in fade-in">
      {/* Backdrop area click to close */}
      <div className="absolute inset-0 cursor-zoom-out" onClick={onClose} />

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute right-6 top-6 z-50 rounded-full bg-ink-900/60 p-3 text-white hover:bg-ink-900/80 shadow-md backdrop-blur transition-all duration-200"
        aria-label="Close lightbox"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Navigation: Left Arrow */}
      {images.length > 1 && (
        <button
          onClick={handlePrev}
          className="absolute left-6 z-50 rounded-full bg-ink-900/60 p-3 text-white hover:bg-ink-900/80 shadow-md backdrop-blur transition-all duration-200"
          aria-label="Previous image"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Main Image Container */}
      <div className="relative z-10 max-h-[85vh] max-w-[90vw] overflow-hidden select-none animate-in zoom-in-95 duration-200">
        <img
          src={currentImage}
          alt={`Gallery image ${currentIndex + 1}`}
          className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-glow border border-white/20"
        />

        {/* Counter Overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink-900/75 px-4 py-1.5 text-xs font-semibold text-white/90 backdrop-blur shadow-md">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {/* Navigation: Right Arrow */}
      {images.length > 1 && (
        <button
          onClick={handleNext}
          className="absolute right-6 z-50 rounded-full bg-ink-900/60 p-3 text-white hover:bg-ink-900/80 shadow-md backdrop-blur transition-all duration-200"
          aria-label="Next image"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
