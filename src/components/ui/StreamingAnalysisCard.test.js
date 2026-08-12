import React from 'react';
import { act, render, screen } from '@testing-library/react';
import StreamingAnalysisCard from './StreamingAnalysisCard';

const presetPlayback = {
  intro: '循晨意入味…',
  steps: [
    '晨光正沿着木的生发向上伸展。',
    '困意仍在，身体需要轻快而不锋利的提振。',
    '以咖啡香与明亮果意，把清醒慢慢点亮。',
  ],
  completion: '晨意初醒，精神需要轻快提振',
};

async function advancePlayback(milliseconds) {
  const tick = 48;
  for (let elapsed = 0; elapsed < milliseconds; elapsed += tick) {
    await act(async () => {
      jest.advanceTimersByTime(Math.min(tick, milliseconds - elapsed));
      await Promise.resolve();
    });
  }
}

describe('StreamingAnalysisCard preset playback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete global.fetch;
  });

  test('plays local analysis and completes without calling an API', async () => {
    const onStreamComplete = jest.fn();

    render(
      <StreamingAnalysisCard
        isActive
        userInput=""
        presetPlayback={presetPlayback}
        onStreamComplete={onStreamComplete}
        onError={jest.fn()}
      />
    );

    expect(screen.getByText('循晨意入味…')).not.toBeNull();

    await advancePlayback(700);
    expect(screen.getByText(/晨光/)).not.toBeNull();

    await advancePlayback(5000);
    expect(onStreamComplete).toHaveBeenCalledTimes(1);
    expect(onStreamComplete.mock.calls[0][0]).toMatchObject({
      source: 'preset',
      summary: presetPlayback.completion,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('cancels local timers when playback becomes inactive', async () => {
    const onStreamComplete = jest.fn();
    const { rerender } = render(
      <StreamingAnalysisCard
        isActive
        userInput="#早起唤醒"
        presetPlayback={presetPlayback}
        onStreamComplete={onStreamComplete}
        onError={jest.fn()}
      />
    );

    await advancePlayback(650);
    rerender(
      <StreamingAnalysisCard
        isActive={false}
        userInput="#早起唤醒"
        presetPlayback={presetPlayback}
        onStreamComplete={onStreamComplete}
        onError={jest.fn()}
      />
    );
    await advancePlayback(5000);

    expect(onStreamComplete).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
