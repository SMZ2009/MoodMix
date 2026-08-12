import {
  QUICK_MOOD_PRESETS,
  materializeQuickMoodPreset,
} from './quickMoodPresets';

function buildCatalog() {
  return QUICK_MOOD_PRESETS.flatMap((preset) => preset.cards).map((card) => ({
    id: `api_${card.apiId}`,
    apiId: card.apiId,
    name: card.nameEn,
    nameEn: card.nameEn,
    image: `https://example.com/${card.apiId}.jpg`,
    dimensions: {
      taste: { sour: 2, sweet: 3, bitter: 1, spicy: 0, umami: 0 },
      temperature: { value: 0 },
      texture: { value: 0 },
    },
  }));
}

describe('quick mood presets', () => {
  test('all six presets resolve to three unique cards with local copy and quality data', () => {
    const catalog = buildCatalog();

    expect(QUICK_MOOD_PRESETS).toHaveLength(6);

    QUICK_MOOD_PRESETS.forEach((preset) => {
      const result = materializeQuickMoodPreset(preset.value, catalog);

      expect(preset.analysis.intro).toMatch(/…$/);
      expect(preset.analysis.steps).toHaveLength(3);
      preset.analysis.steps.forEach((step) => expect(step.trim()).not.toBe(''));
      expect(preset.analysis.completion).toBe(preset.moodProfile.summary);

      expect(result).not.toBeNull();
      expect(result.source).toBe('preset');
      expect(result.analysis).toEqual(preset.analysis);
      expect(result.drinks).toHaveLength(3);
      expect(new Set(result.drinks.map((drink) => drink.id)).size).toBe(3);
      expect(Object.keys(result.customQuotes)).toHaveLength(3);
      expect(Object.keys(result.qualityResults)).toHaveLength(3);

      result.drinks.forEach((drink) => {
        expect(result.customQuotes[drink.id]).toMatch(/^「.+」$/);
        expect(result.qualityResults[drink.id].score).toBeGreaterThanOrEqual(80);
        expect(result.qualityResults[drink.id].detail.source).toBe('preset');
        expect(drink.name).toMatch(/[\u4e00-\u9fff]/);
      });

      const moodData = result.moodResult.moodData;
      const primaryDimension = preset.moodProfile.primaryDimension;
      expect(moodData[primaryDimension].physical.intensity).toBe(0.9);
      expect(moodData.summary).toBe(preset.moodProfile.summary);
      expect(result.moodResult.patternAnalysis.wuxing.user).toBe(preset.moodProfile.wuxing);
    });
  });

  test('returns null instead of falling back when any fixed drink is unavailable', () => {
    const preset = QUICK_MOOD_PRESETS[0];
    const incompleteCatalog = buildCatalog().filter(
      (drink) => drink.apiId !== preset.cards[0].apiId
    );

    expect(materializeQuickMoodPreset(preset.value, incompleteCatalog)).toBeNull();
    expect(materializeQuickMoodPreset('#不存在的标签', buildCatalog())).toBeNull();
  });
});
