/**
 * Whether the screen is phone-sized.
 *
 * The mobile navigation is rendered only on phones, not just hidden by CSS, so the
 * desktop page never carries a second copy of every nav button. Where
 * `matchMedia` does not exist (jsdom, very old browsers) this is `false`, which
 * is the desktop layout.
 */
import { useEffect, useState } from 'react';

/** Keep in step with the phone breakpoint in styles/mobile.css. */
export const MOBILE_QUERY = '(max-width: 600px)';

const matches = (): boolean =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia(MOBILE_QUERY).matches;

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(matches);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
