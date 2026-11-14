import { useI18n } from '../hooks/useI18n';
import type { Rating } from '../types/store';
import './Rating.css';

interface RatingStarsProps {
  stars: number;
}

// There's an image for every half star, which is how the API rounds ratings
export function RatingStars({ stars }: RatingStarsProps) {
  const { t, formatNumber } = useI18n();

  return (
    <img className="rating-stars" src={`images/ratings/rating-${stars * 10}.png`}
      alt={t.rating.stars(formatNumber(stars))} width="96" height="19" />
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
