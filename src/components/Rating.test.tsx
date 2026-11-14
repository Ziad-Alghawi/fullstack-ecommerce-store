import { it, expect, describe } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RatingStars } from './Rating';

describe('RatingStars', () => {
  it('fills the stars up to the rating, half stars included', () => {
    render(<RatingStars stars={4.5} />);

    const stars = screen.getByRole('img', { name: '4.5 out of 5 stars' });
    expect(stars.querySelector('svg')).toHaveAttribute('width', '108');
    expect(stars.querySelectorAll('.rating-star-filled')).toHaveLength(5);
    expect(stars.querySelectorAll('.rating-star-empty')).toHaveLength(5);
  });
});
