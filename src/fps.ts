type TrackFrameFunction = (frameTimeMS: number) => void;
type OnChangeCallback = (fps: number) => void;

interface FpsCounterOptions
{
  onChange: OnChangeCallback;
  intervalMS: number;
  precision: number;
}

export function fpsCounter(options: FpsCounterOptions): TrackFrameFunction
{
  const onChange = options.onChange;
  const intervalMS = options.intervalMS;
  const precision = options.precision;

  let elapsed = 0;
  let frames = 0;
  let _fps = 0;

  return (deltaMS: number): void =>
  {
    elapsed += deltaMS;
    frames += 1;

    if (elapsed < intervalMS) return;

    const fps = Math.round(frames * 1000 / elapsed / precision) * precision;

    frames = 0;
    elapsed = 0;

    if (_fps !== fps)
    {
      onChange(fps);
      _fps = fps;
    }
  };
}
