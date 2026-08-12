import React from 'react';
import { render, screen } from '@testing-library/react';
import RecommendationGallery from './RecommendationGallery';

jest.mock('./NearbyButton', () => () => null);
jest.mock('./NearbyPanel', () => () => null);

const drinks = [
  {
    id: 'api_11000',
    apiId: '11000',
    name: '莫吉托',
    nameEn: 'Mojito',
    image: 'https://example.com/mojito.jpg',
    ingredients: [],
    dimensions: {
      taste: { sour: 3, sweet: 3, bitter: 0, spicy: 0, umami: 0 },
      temperature: { value: -2 },
      texture: { value: 0 },
    },
  },
];

const moodResult = {
  moodData: {
    summary: '周末松弛愉悦',
    emotion: { physical: { intensity: 0.9, state: '松弛愉悦' } },
  },
  patternAnalysis: {
    polarity: { type: 'positive' },
    wuxing: { user: 'fire' },
    strategy: { type: 'resonate' },
  },
};

describe('RecommendationGallery shuffle control', () => {
  test('keeps the header balanced while hiding shuffle for fixed presets', () => {
    const { rerender } = render(
      <RecommendationGallery drinks={drinks} onBack={jest.fn()} moodResult={moodResult} />
    );

    expect(screen.queryByRole('button', { name: '换一批推荐' })).toBeNull();

    rerender(
      <RecommendationGallery
        drinks={drinks}
        onBack={jest.fn()}
        onShuffle={jest.fn()}
        moodResult={moodResult}
      />
    );

    expect(screen.getByRole('button', { name: '换一批推荐' })).not.toBeNull();
  });
});
