import axios from 'axios';
import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ErrorMessage } from '../../components/PageStatus';
import { AuthContext } from '../../hooks/useAuth';
import { useI18n } from '../../hooks/useI18n';
import { ReviewForm } from './ReviewForm';
import { ReviewItem } from './ReviewItem';
import type { ProductReviews } from '../../types/store';

async function fetchReviews(productId: string) {
  const response = await axios.get<ProductReviews>(`/api/products/${productId}/reviews`);
  if (!Array.isArray(response.data?.reviews)) {
    throw new Error('Unexpected reviews response');
  }
  return response.data;
}

interface ReviewsProps {
  productId: string;
  // Reviews change the product's rating, so the page loads it again
  onReviewsChange: () => Promise<void>;
}

export function Reviews({ productId, onReviewsChange }: ReviewsProps) {
  const auth = useContext(AuthContext);
  const [data, setData] = useState<ProductReviews | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { t } = useI18n();

  useEffect(() => {
    setHasError(false);
    fetchReviews(productId).then(setData, () => setHasError(true));
  }, [productId, retryCount]);

  const reloadAfterChange = async () => {
    const [reviews] = await Promise.all([fetchReviews(productId), onReviewsChange()]);
    setData(reviews);
    setIsEditing(false);
  };

  let content;

  if (hasError) {
    content = <ErrorMessage title={t.reviews.loadFailed} onButtonClick={() => setRetryCount((count) => count + 1)} />;
  } else if (!data) {
    content = <p className="reviews-note" role="status">{t.reviews.loading}</p>;
  } else {
    const myReview = data.reviews.find((review) => review.isMine);
    let reviewPrompt = null;

    if (!auth?.user) {
      reviewPrompt = (
        <p className="reviews-note" data-testid="reviews-login-message">
          {auth ? <><Link className="link-primary" to="/login">{t.reviews.logInLink}</Link>{t.reviews.logInRest}</> : null}
          {t.reviews.orderedOnly}
        </p>
      );
    } else if (isEditing && myReview) {
      reviewPrompt = (
        <ReviewForm key={myReview.id} productId={productId} review={myReview}
          onSaved={reloadAfterChange} onCancel={() => setIsEditing(false)} />
      );
    } else if (!myReview && data.canReview) {
      reviewPrompt = <ReviewForm productId={productId} review={null} onSaved={reloadAfterChange} />;
    } else if (!myReview) {
      reviewPrompt = <p className="reviews-note" data-testid="reviews-not-ordered-message">{t.reviews.orderedOnly}</p>;
    }

    content = (
      <>
        {reviewPrompt}

        {data.reviews.length === 0 ? (
          <p className="reviews-note" data-testid="no-reviews-message">{t.reviews.none}</p>
        ) : (
          <ul className="reviews-list">
            {data.reviews.map((review) => (
              <ReviewItem key={review.id} review={review} canDelete={Boolean(auth?.isAdmin)}
                onEdit={() => setIsEditing(true)} onDeleted={reloadAfterChange} />
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <section className="reviews card" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="reviews-title">{t.reviews.title}</h2>
      {content}
    </section>
  );
}
