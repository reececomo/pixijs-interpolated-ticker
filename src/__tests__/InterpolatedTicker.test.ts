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
