import { STORE_NAME } from './PageTitle';
import { useI18n } from '../hooks/useI18n';
import GreenLogo from '../assets/images/logo.webp';
import GreenMobileLogo from '../assets/images/mobile-logo.png';
import WhiteLogo from '../assets/images/logo-white.webp';
import WhiteMobileLogo from '../assets/images/mobile-logo-white.png';

interface LogoProps {
  white?: boolean;
}

// Phones only download the small logo
export function Logo({ white = false }: LogoProps) {
  const { t } = useI18n();

  return (
    <picture>
      <source media="(max-width: 640px)" srcSet={white ? WhiteMobileLogo : GreenMobileLogo}
        width="26" height="30" data-testid="mobile-logo" />
      <img className="logo" src={white ? WhiteLogo : GreenLogo} alt={t.header.logo(STORE_NAME)}
        width="150" height="44" data-testid="logo" />
    </picture>
  );
}
