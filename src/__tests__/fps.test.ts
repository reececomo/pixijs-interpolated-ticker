import { fpsCounter } from "../fps";

describe("fpsCounter", () =>
{
  test("reports fps once per interval when it changes", () =>
  {
    const onChange = jest.fn();
    const track = fpsCounter({ onChange, intervalMS: 1000, precision: 1 });

    for (let i = 0; i < 49; i++) track(20);
    expect(onChange).not.toHaveBeenCalled();

    track(20);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(50);

    for (let i = 0; i < 50; i++) track(20);
    expect(onChange).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 100; i++) track(10);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(100);
  });

  test("rounds to precision", () =>
  {
    const onChange = jest.fn();
    const track = fpsCounter({ onChange, intervalMS: 100, precision: 0.5 });

    track(30);
    track(30);
    track(41);

    expect(onChange).toHaveBeenCalledWith(29.5);
  });
});
