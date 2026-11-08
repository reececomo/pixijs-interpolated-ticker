/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { InterpolatedTicker } from "../InterpolatedTicker";
import { Container } from "pixi.js";

// ---- Test doubles ----
let now = 0;
(globalThis as any).performance = { now: () => now };

let rafId = 1;
let rafCb: FrameRequestCallback | null = null;
(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
{
  rafId++;
  rafCb = cb;
  return rafId;
};
(globalThis as any).cancelAnimationFrame = (id: number) =>
{
  if (id === rafId) rafCb = null;
};

// Mock fpsCounter to just call onChange immediately
jest.mock("../fps", () => ({
  fpsCounter: (opts: { onChange: (fps: number) => void }) =>
  {
    return (elapsedMs: number) =>
    {
      const fps = 1000 / (elapsedMs || 1);
      opts.onChange(fps);
    };
  }
}));

// Mock ContainerInterpolator
const capture = jest.fn();
const lerp = jest.fn();
const unlerp = jest.fn();
jest.mock("../ContainerInterpolator", () =>
{
  return {
    ContainerInterpolator: jest.fn().mockImplementation(() => ({
      capture,
      lerp,
      unlerp,
    }))
  };
});

// ---- Tests ----
describe("InterpolatedTicker", () =>
{
  let renderer: { render: jest.Mock };
  let stage: Container;
  let ticker: InterpolatedTicker;

  beforeEach(() =>
  {
    renderer = { render: jest.fn() };
    stage = new Container();
    ticker = new InterpolatedTicker({ renderer, stage });
    capture.mockClear();
    lerp.mockClear();
    unlerp.mockClear();
    renderer.render.mockClear();
    now = 0;
  });

  function step(ms: number)
  {
    now += ms;
    if (rafCb) rafCb(now);
  }

  test("starts and stops", () =>
  {
    expect(ticker.started).toBe(false);
    ticker.start({ update: jest.fn() });
    expect(ticker.started).toBe(true);
    ticker.stop();
    expect(ticker.started).toBe(false);
  });

  test("calls update on fixed timestep", () =>
  {
    const update = jest.fn();
    ticker.start({ update });
    step(20); // simulate 20 ms elapsed
    expect(update).toHaveBeenCalled();
  });

  test("speed calls update twice as often when speed = 2", () =>
  {
    const update = jest.fn();
    const ticker = new InterpolatedTicker({ renderer, stage });

    ticker.start({ update });

    // tick at normal speed
    step(16.7);
    step(16.7);

    expect(update).toHaveBeenCalledTimes(2);

    // tick at double speed
    ticker.speed = 2;
    step(16.7);
    step(16.7);

    expect(update).toHaveBeenCalledTimes(2 + 4);

    ticker.speed = 0.5;
    step(16.7);
    step(16.7);

    expect(update).toHaveBeenCalledTimes(2 + 4 + 1);
  });

  test("renders frame and calls renderer", () =>
  {
    const update = jest.fn();
    ticker.start({ update });
    step(20);
    expect(renderer.render).toHaveBeenCalledWith(stage);
  });

  test("calls frame callbacks with lerp", () =>
  {
    const began = jest.fn();
    const lerped = jest.fn();
    ticker.interpolation = true;
    ticker.start({
      update: jest.fn(),
      prepareRender: began,
      render: lerped,
    });
    step(20);
    expect(began).toHaveBeenCalled();
    expect(lerped).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    expect(capture).toHaveBeenCalled();
    expect(lerp).toHaveBeenCalled();
    expect(unlerp).toHaveBeenCalled();
  });

  test("skips lerp if interpolation = false", () =>
  {
    ticker.interpolation = false;
    ticker.start({ update: jest.fn() });
    step(20);
    expect(capture).not.toHaveBeenCalled();
    expect(lerp).not.toHaveBeenCalled();
    expect(unlerp).not.toHaveBeenCalled();
  });

  test("renderFPS limits render frequency", () =>
  {
    ticker.renderFPS = 30; // ~33ms
    ticker.start({ update: jest.fn() });

    step(10); // too soon, should skip render
    expect(renderer.render).not.toHaveBeenCalled();

    step(30); // enough elapsed
    expect(renderer.render).toHaveBeenCalled();
  });

  test("passes progress to render hook and interpolator", () =>
  {
    const ticker = new InterpolatedTicker({ renderer, stage, fixedDeltaMS: 10 });
    const update = jest.fn();
    const render = jest.fn();
    ticker.start({ update, render });

    step(15);
    expect(update).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenLastCalledWith(15, 0.5);
    expect(lerp).toHaveBeenLastCalledWith(0.5);

    step(3);
    expect(update).toHaveBeenCalledTimes(1);
    expect(render.mock.lastCall[0]).toBe(3);
    expect(render.mock.lastCall[1]).toBeCloseTo(0.8);
    expect(lerp.mock.lastCall[0]).toBeCloseTo(0.8);
  });

  test("progress is 1 when interpolation = false", () =>
  {
    const ticker = new InterpolatedTicker({ renderer, stage, fixedDeltaMS: 10, interpolation: false });
    const render = jest.fn();
    ticker.start({ update: jest.fn(), render });

    step(15);
    expect(render).toHaveBeenLastCalledWith(15, 1);
    expect(lerp).not.toHaveBeenCalled();
  });

  test("clamps accumulated frame time to maxFrameTimeMS", () =>
  {
    const ticker = new InterpolatedTicker({ renderer, stage, fixedDeltaMS: 10 });
    const update = jest.fn();
    ticker.start({ update });

    step(1000);
    expect(update).toHaveBeenCalledTimes(3);
  });

  test("emits devicefps and fps", () =>
  {
    ticker.renderFPS = 30; // ~33ms

    const deviceSpy = jest.fn();
    const renderSpy = jest.fn();
    ticker.on("devicefps", deviceSpy);
    ticker.on("fps", renderSpy);

    ticker.start({ update: jest.fn() });
    step(16);
    expect(deviceSpy).toHaveBeenCalledWith(expect.any(Number));
    expect(renderSpy).not.toHaveBeenCalledWith(expect.any(Number));
    step(16);
    expect(deviceSpy).toHaveBeenCalledWith(expect.any(Number));
    expect(renderSpy).toHaveBeenCalledWith(expect.any(Number));
  });
});

describe("InterpolatedTicker with a v8 renderer", () =>
{
  const SCREEN = { name: "screen" };
  const BACK_BUFFER = { name: "back-buffer" };

  function createV8Renderer()
  {
    const background = { colorRgba: [0, 0, 0, 1], clearBeforeRender: true };
    const calls: Array<{ options: any; received: any; resolved: any }> = [];

    const renderer = {
      renderPipes: {},
      background,
      useBackBuffer: true,
      calls,
      render: jest.fn((options: any) =>
      {
        const received = { ...options };

        if (!options.target) options.target = SCREEN;
        if (options.target === SCREEN)
        {
          options.clearColor ??= background.colorRgba;
          options.clear ??= background.clearBeforeRender;
        }
        if (!options.transform) options.transform = { of: options.container };
        if (renderer.useBackBuffer && options.target === SCREEN) options.target = BACK_BUFFER;

        calls.push({ options, received, resolved: { ...options } });
      }),
    };

    return renderer;
  }

  let stage: Container;
  let renderer: ReturnType<typeof createV8Renderer>;

  beforeEach(() =>
  {
    now = 0;
    stage = new Container();
    renderer = createV8Renderer();
  });

  function step(ms: number)
  {
    now += ms;
    if (rafCb) rafCb(now);
  }

  test("reuses one render options object across frames", () =>
  {
    new InterpolatedTicker({ renderer, stage }).start({ update: jest.fn() });

    for (let i = 0; i < 1000; i++) step(17);

    expect(renderer.render).toHaveBeenCalledTimes(1000);
    const distinct = new Set(renderer.calls.map(c => c.options));
    expect(distinct.size).toBe(1);

    const [options] = distinct;
    expect(options).not.toBe(stage);
    expect(options.container).toBe(stage);
  });

  test("resets fields written by the renderer before each frame", () =>
  {
    new InterpolatedTicker({ renderer, stage }).start({ update: jest.fn() });

    step(17);
    step(17);
    step(17);

    for (const { received, resolved } of renderer.calls)
    {
      expect(received).toEqual({
        container: stage,
        target: undefined,
        clearColor: undefined,
        clear: undefined,
        transform: undefined,
      });
      expect(resolved).toEqual({
        container: stage,
        target: BACK_BUFFER,
        clearColor: renderer.background.colorRgba,
        clear: true,
        transform: { of: stage },
      });
    }
  });

  test("follows renderer background changes between frames", () =>
  {
    new InterpolatedTicker({ renderer, stage }).start({ update: jest.fn() });

    step(17);
    const red = [1, 0, 0, 1];
    renderer.background.colorRgba = red;
    renderer.background.clearBeforeRender = false;
    step(17);

    expect(renderer.calls[0].resolved.clearColor).toEqual([0, 0, 0, 1]);
    expect(renderer.calls[0].resolved.clear).toBe(true);
    expect(renderer.calls[1].resolved.clearColor).toBe(red);
    expect(renderer.calls[1].resolved.clear).toBe(false);
  });

  test("renders the stage after a restart", () =>
  {
    const ticker = new InterpolatedTicker({ renderer, stage });

    ticker.start({ update: jest.fn() });
    step(17);
    ticker.stop();
    ticker.start({ update: jest.fn() });
    step(17);

    expect(renderer.calls).toHaveLength(2);
    expect(renderer.calls[1].options.container).toBe(stage);
    expect(renderer.calls[1].received.target).toBeUndefined();
  });

  test("keeps options separate per ticker", () =>
  {
    const otherStage = new Container();
    const otherRenderer = createV8Renderer();

    new InterpolatedTicker({ renderer, stage }).start({ update: jest.fn() });
    step(17);
    new InterpolatedTicker({ renderer: otherRenderer, stage: otherStage }).start({ update: jest.fn() });
    step(17);

    expect(renderer.calls[0].options.container).toBe(stage);
    expect(otherRenderer.calls[0].options.container).toBe(otherStage);
    expect(otherRenderer.calls[0].options).not.toBe(renderer.calls[0].options);
  });

  test("passes the stage to renderers without render options support", () =>
  {
    const legacy = { render: jest.fn() };
    new InterpolatedTicker({ renderer: legacy, stage }).start({ update: jest.fn() });

    step(17);
    step(17);

    expect(legacy.render).toHaveBeenCalledTimes(2);
    expect(legacy.render).toHaveBeenNthCalledWith(1, stage);
    expect(legacy.render).toHaveBeenNthCalledWith(2, stage);
  });
});
