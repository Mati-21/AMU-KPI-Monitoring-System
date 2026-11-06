import { useEffect, useRef, useState } from 'react';

/**
 * Whether an element is on screen (or about to be), and whether it ever has been. Lets a heavy section start loading
 * when it is scrolled to, and stop refreshing when it is scrolled away from.
 */
export const useInView = ({ rootMargin = '200px' } = {}) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView, seen };
};

export default useInView;
