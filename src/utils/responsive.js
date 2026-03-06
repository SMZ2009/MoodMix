import { useState, useEffect } from 'react';

export const useResponsive = () => {
  const [device, setDevice] = useState('mobile');
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    isLandscape: typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : true,
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 2
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pixelRatio = window.devicePixelRatio;
      const isLandscape = width > height;

      let newDevice = 'mobile';
      if (width >= 1024) {
        newDevice = 'desktop';
      } else if (width >= 768) {
        newDevice = 'tablet';
      }

      setDevice(newDevice);
      setDimensions({ width, height, isLandscape, pixelRatio });
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return { device, ...dimensions };
};

export const useTouchDevice = () => {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };

    checkTouch();

    window.addEventListener('touchstart', checkTouch);
    window.addEventListener('touchend', checkTouch);

    return () => {
      window.removeEventListener('touchstart', checkTouch);
      window.removeEventListener('touchend', checkTouch);
    };
  }, []);

  return isTouch;
};

export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    const updateMatch = () => setMatches(media.matches);
    updateMatch();

    media.addEventListener('change', updateMatch);

    return () => media.removeEventListener('change', updateMatch);
  }, [query]);

  return matches;
};

export const breakpoints = {
  mobile: 480,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
  wide: 1536
};

export const getResponsiveValue = (values) => {
  const { device } = useResponsive();

  if (device === 'desktop') return values.desktop || values.tablet || values.mobile;
  if (device === 'tablet') return values.tablet || values.mobile;
  return values.mobile;
};

export const getBreakpoint = (width) => {
  if (width >= breakpoints.wide) return 'wide';
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.laptop) return 'laptop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'mobile';
};

export const isMobile = () => window.innerWidth < breakpoints.tablet;
export const isTablet = () => window.innerWidth >= breakpoints.tablet && window.innerWidth < breakpoints.laptop;
export const isDesktop = () => window.innerWidth >= breakpoints.laptop;

export const getSafeAreaInsets = () => {
  if (typeof document === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const computedStyle = getComputedStyle(document.documentElement);
  return {
    top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
    right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
    bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
    left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0')
  };
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

export const generateId = (prefix = 'id') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

export const lerp = (start, end, factor) => {
  return start + (end - start) * factor;
};

export const mapRange = (value, inMin, inMax, outMin, outMax) => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

export const formatNumber = (num, decimals = 0) => {
  return Number(num).toFixed(decimals);
};

export const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const truncate = (str, length = 50, suffix = '...') => {
  if (str.length <= length) return str;
  return str.slice(0, length) + suffix;
};

export const getContrastColor = (hexcolor) => {
  const r = parseInt(hexcolor.slice(1, 3), 16);
  const g = parseInt(hexcolor.slice(3, 5), 16);
  const b = parseInt(hexcolor.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
};

export const hexToRgba = (hex, alpha = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
