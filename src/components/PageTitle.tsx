export const STORE_NAME = 'Full-Stack E-Commerce Store';

interface PageTitleProps {
  title?: string;
}

export function PageTitle({ title }: PageTitleProps) {
  return <title>{title ? `${title} | ${STORE_NAME}` : STORE_NAME}</title>;
}
