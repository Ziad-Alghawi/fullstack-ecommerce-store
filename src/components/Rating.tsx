import { useI18n } from '../hooks/useI18n';
import type { Rating } from '../types/store';
import './Rating.css';

interface RatingStarsProps {
  stars: number;
}

const STAR_SIZE = 24;
const STAR_PATH = 'M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8z';

function StarRow({ className }: { className: string }) {
  return [0, 1, 2, 3, 4].map((index) => (
    <path key={index} className={className} d={STAR_PATH} transform={`translate(${index * STAR_SIZE} 0)`} />
  ));
}

// Drawn rather than an image, so the empty stars follow the theme. The filled row is cut at the rating,
// which the API rounds to half stars
export function RatingStars({ stars }: RatingStarsProps) {
  const { t, formatNumber } = useI18n();

  return (
    <svg className="rating-stars" viewBox={`0 0 ${5 * STAR_SIZE} ${STAR_SIZE}`} width="96" height="19"
      role="img" aria-label={t.rating.stars(formatNumber(stars))}>
      <StarRow className="rating-star-empty" />
      <svg width={stars * STAR_SIZE} height={STAR_SIZE}>
        <StarRow className="rating-star-filled" />
      </svg>
    </svg>
  );
}

interface ProductRatingProps {
  rating: Rating;
}

export function ProductRating({ rating }: ProductRatingProps) {
  const { formatNumber } = useI18n();

  return (
    <div className="product-rating-container">
      <RatingStars stars={rating.stars} />
      <span className="product-rating-count">
        {formatNumber(rating.count)}
      </span>
    </div>
  );
}
