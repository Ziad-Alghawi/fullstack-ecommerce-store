import { STORE_NAME } from './PageTitle';
import { useI18n } from '../hooks/useI18n';
import './Logo.css';

interface LogoProps {
  white?: boolean;
}

// The cart icon of the favicon next to the name. Phones only show the icon
export function Logo({ white = false }: LogoProps) {
  const { t } = useI18n();

  return (
    <span className={white ? 'logo logo-white' : 'logo'} role="img" aria-label={t.header.logo(STORE_NAME)}
      data-testid="logo">
      <svg className="logo-icon" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"
        data-testid="mobile-logo">
        <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12.5" cy="24.5" r="1.6" />
          <circle cx="22.5" cy="24.5" r="1.6" />
          <path d="M5 6h3.5l3 13.2a1 1 0 0 0 1 .8h10.2a1 1 0 0 0 1-.8L26 10H9.2" />
        </g>
      </svg>
      <span className="logo-text" aria-hidden="true">
        <span className="logo-name">Full-Stack</span>
        <span className="logo-tagline">E-Commerce Store</span>
      </span>
    </span>
  );
}
