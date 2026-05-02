import { Container } from "pixi.js";
import { ContainerInterpolator } from "../ContainerInterpolator";


describe("ContainerInterpolator", () =>
{
  let interpolator: ContainerInterpolator;
  let root: Container;
  let child: Container;

  beforeEach(() =>
  {
    interpolator = new ContainerInterpolator({ capacity: 2 });
    root = new Container();
    child = new Container();
    root.addChild(child);
  });

  test("capture does not modify container properties", () =>
  {
    root.position.set(10, 20);
    root.scale.set(2, 3);
    root.rotation = Math.PI / 4;

    interpolator.capture(root);

    expect(root.position.x).toBe(10);
    expect(root.scale.x).toBe(2);
    expect(root.rotation).toBeCloseTo(Math.PI / 4);
  });

  describe("lerp()", () =>
  {
    it("interpolates position halfway when t=0.5", () =>
    {
      root.position.set(0, 0);
      interpolator.capture(root);

      root.position.set(100, 50);
      interpolator.lerp(0.5);

      expect(root.position.x).toBeCloseTo(50);
      expect(root.position.y).toBeCloseTo(25);
    });

    it("clamps t < 0 to 0", () =>
    {
      root.position.set(0, 0);
      interpolator.capture(root);

      root.position.set(100, 0);
      interpolator.lerp(-1);

      // expect start state
      expect(root.position.x).toBe(0);
    });

    it("clamps t > 1 to 1", () =>
    {
      root.position.set(0, 0);
      interpolator.capture(root);

      root.position.set(100, 0);
      interpolator.lerp(2);

      // expect end state
      expect(root.position.x).toBe(100);
    });

    it("interpolates scale, skew, rotation", () =>
    {
      root.scale.set(1, 1);
      root.skew.set(0, 0);
      root.rotation = 0;

      interpolator.capture(root);

      root.scale.set(1.5, 1.5);
      root.skew.set(Math.PI / 4, Math.PI / 4);
      root.rotation = Math.PI / 2;

      interpolator.lerp(0.5);

      expect(root.scale.x).toBeCloseTo(1.25);
      expect(root.scale.y).toBeCloseTo(1.25);
      expect(root.skew.x).toBeCloseTo(Math.PI / 8);
      expect(root.skew.y).toBeCloseTo(Math.PI / 8);
      expect(root.rotation).toBeCloseTo(Math.PI / 4);
    });

    it("interpolates skew halfway when t=0.5", () =>
    {
      root.skew.set(0, 0);
      interpolator.capture(root);

      root.skew.set(1, 0.5);
      interpolator.lerp(0.5);

      expect(root.skew.x).toBeCloseTo(0.5);
      expect(root.skew.y).toBeCloseTo(0.25);
    });

    it("does not interpolate skew when delta exceeds maxSkewDelta", () =>
    {
      interpolator = new ContainerInterpolator({ maxSkewDelta: Math.PI / 4 });

      root.skew.set(0, 0);
      interpolator.capture(root);

      root.skew.set(Math.PI, Math.PI); // exceeds threshold
      interpolator.lerp(0.5);

      // skew should remain at end state, not interpolated
      expect(root.skew.x).toBeCloseTo(Math.PI);
      expect(root.skew.y).toBeCloseTo(Math.PI);
    });
  });

  describe("unlerp()", () =>
  {
    it("resets container back to its last state", () =>
    {
      root.position.set(0, 0);
      root.skew.set(0, 0);
      interpolator.capture(root);

      root.position.set(20, 40);
      root.skew.set(0.5, 0.25);
      interpolator.lerp(0.5); // halfway
      interpolator.unlerp();

      // should snap back to true "end" state
      expect(root.position.x).toBe(20);
      expect(root.position.y).toBe(40);
      expect(root.skew.x).toBeCloseTo(0.5);
      expect(root.skew.y).toBeCloseTo(0.25);
    });
  });

  test("skips destroyed containers", () =>
  {
    root.position.set(10, 10);

    const child = new Container();
    child.position.set(25, 25);

    root.addChild(child);

    interpolator.capture(root);

    root.position.set(15, 15);
    child.position.set(30, 30);
    child.destroy();

    interpolator.lerp(0.5);

    // destroyed container should not be modified
    expect(root.position.x).toBe(12.5);
    expect(root.position.y).toBe(12.5);
  });

  test("skips invisible containers", () =>
  {
    root.visible = false;
    interpolator.capture(root);
    interpolator.lerp(0.5);

    // invisible container is ignored
    expect(root.position.x).toBe(0);
  });

  test("handles many children beyond initial capacity", () =>
  {
    interpolator = new ContainerInterpolator({ capacity: 1 });

    const many = Array.from({ length: 5 }, () => new Container());
    many.forEach((c) =>
    {
      root.addChild(c);
    });

    interpolator.capture(root);

    // move them all
    root.children.forEach((c, i) => c.position.set(i * 20, 0));
    interpolator.lerp(0.5);

    root.children.forEach((c, i) =>
    {
      expect(c.position.x).toBeCloseTo(i * 10);
    });
  });
});
