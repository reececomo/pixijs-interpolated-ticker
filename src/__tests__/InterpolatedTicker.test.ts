import { Application, Container } from "pixi.js";
import { InterpolatedTicker, InterpolatedContainer } from "../InterpolatedTicker";

/** Create mock application for testing */
function mockApp(): Application
{
  return {
    stage: new Container(),
    renderer: {
      render: ( _stage: Container ) => {},
    }
  } as Application;
}

describe("InterpolatedTicker", () =>
{
  let app: Application;
  let ticker: InterpolatedTicker;

  beforeEach(() =>
  {
    app = mockApp();
    ticker = new InterpolatedTicker({ app });
  });

  it("should initialize with default properties", () =>
  {
    expect(ticker.updateIntervalMs).toBeCloseTo(16.6667);
    expect(ticker.speed).toBe(1.0);
  });

  it("should allow setting and getting speed", () =>
  {
    ticker.speed = 2.0;

    expect(ticker.speed).toBe(2.0);
    expect(ticker.updateIntervalMs).toBeCloseTo(16.6667); // unaffected
    expect(ticker["_updateIntervalMs"]).toBeCloseTo(8.3334); // internal clock
  });

  it("should resize buffer when capacity is exceeded", () =>
  {
    // note: not a great way to do this test

    const initialCapacity = ticker["_capacity"];
    ticker["_resizeBuffer"](initialCapacity * 2);

    expect(ticker["_capacity"]).toBe(initialCapacity * 2);
    expect(ticker["_prevX"].length).toBe(initialCapacity * 2);
  });

  it("should capture containers in a subtree", () =>
  {
    // note: not a great way to do this test

    const root = new Container() as InterpolatedContainer;
    const child1 = new Container() as InterpolatedContainer;
    const child2 = new Container() as InterpolatedContainer;

    root.addChild(child1, child2);
    ticker["_captureContainersTraverseSubtree"](root);

    expect(ticker["_idxContainersCount"]).toBe(3);
  });

  it("should interpolate container properties", () =>
  {
    // note: not a great way to do this test

    const container = new Container() as InterpolatedContainer;
    container.position.set(100, 100);
    container.scale.set(1, 1);
    container.rotation = 0;
    container.alpha = 1;

    ticker.updateIntervalMs = 1.0;
    app.stage = container;

    // write initial values
    ticker["_captureContainers"]();

    // sanity check:
    expect(container.x).toBeCloseTo(100);
    expect(container.y).toBeCloseTo(100);
    expect(container.scale.x).toBeCloseTo(1);
    expect(container.scale.y).toBeCloseTo(1);
    expect(container.rotation).toBeCloseTo(0);
    expect(container.alpha).toBeCloseTo(1);

    // simulate update frame:
    container.position.set(200, 200);
    container.scale.set(2, 2);
    container.rotation = Math.PI;
    container.alpha = 0.5;

    // simulate render:
    ticker["_interpolateContainers"](0.5);

    // mid-frame - i.e. the "render()" hook
    expect(container.x).toBeCloseTo(150);
    expect(container.y).toBeCloseTo(150);
    expect(container.scale.x).toBeCloseTo(1.5);
    expect(container.scale.y).toBeCloseTo(1.5);
    expect(container.rotation).toBeCloseTo(Math.PI * 0.5);
    expect(container.alpha).toBeCloseTo(0.75);

    // restore
    ticker["_restoreContainers"]();
    expect(container.x).toBeCloseTo(200);
    expect(container.y).toBeCloseTo(200);
    expect(container.scale.x).toBeCloseTo(2);
    expect(container.scale.y).toBeCloseTo(2);
    expect(container.rotation).toBeCloseTo(Math.PI);
    expect(container.alpha).toBeCloseTo(0.5);
  });
});
