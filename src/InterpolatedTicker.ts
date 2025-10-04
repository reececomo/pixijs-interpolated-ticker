import type { Container } from "pixi.js";
import { Emits } from "./events";
import { fpsCounter } from "./fps";
import { ContainerInterpolator, ContainerInterpolatorOptions } from "./ContainerInterpolator";


interface IRendererLike {
  render: (stage: Container) => void;
}

export interface StartOptions
{
  update: (fixedDeltaMS: number) => void;
  prepareRender?: (renderDeltaMS: number) => void;
  render?: (renderDeltaMS: number, blend: number) => void;
}

export interface InterpolatedTickerOptions
{
  /**
   * Render function provider.
   */
  renderer: IRendererLike;

  /**
   * Stage root view.
   */
  stage: Container;

  /**
   * Fixed timestep interval in milliseconds.
   *
   * @default 16.666666666666668
   */
  fixedDeltaMS?: number;

  /**
   * Whether frame smoothing is enabled.
   *
   * When enabled, container values (position, scale, rotation, alpha) are
   * rendered at interpolated positions.
   *
   * @default true
   */
  interpolation?: boolean;

  /**
   * Container interpolation options.
   */
  interpolationOptions?: ContainerInterpolatorOptions;

  /**
   * The display refresh rate to target (in frames per second). Actual render
   * rate will vary on different displays.
   *
   * A value of `0` means unlimited refresh rate.
   *
   * @default 0
   */
  renderFPS?: number;

  /**
   * When `renderFPS` set, this is the maximum tolerance in milliseconds for
   * limiting the render frame interval.
   *
   * @default 7
   */
  renderIntervalToleranceMS?: number;

  /**
   * Maximum frame time in milliseconds that fixed updates may accrue for
   * before frame time stops accruing. Scaled by `speed`.
   *
   * @default fixedDeltaMs*3
   */
  maxFrameTimeMS?: number;

  /**
   * The minimum interval in milliseconds that fluctuations in FPS are reported.
   *
   * Listen for "fps" and "devicefps" events.
   *
   * @default 1000
   */
  fpsIntervalMS?: number;

  /**
   * The precision for FPS reporting.
   *
   * @default 1.0
   */
  fpsPrecision?: number;
}

const EMPTY = (): void => {};

/**
 * A fixed-timestep ticker that separates updates from rendering.
 *
 * You update the scene graph in a fixed-timestep update loop, and it will
 * interpolate the transform of Containers during rendering.
 *
 * @see https://gafferongames.com/post/fix_your_timestep/
 */
export class InterpolatedTicker extends Emits<{
  devicefps: [devicefps: number];
  fps: [fps: number];
}>
{
  public readonly fixedDeltaMS: number;

  /**
   * Whether frame smoothing is enabled.
   */
  public interpolation: boolean;

  /**
   * The rate that fixed updates are executed at, but does not
   * affect the `fixedDeltaMs` value, which is always constant.
   */
  public speed = 1;

  // ----- Internal properties: -----
  private _interpolationOptions?: ContainerInterpolatorOptions;
  private _stage: Container;
  private _renderer: IRendererLike;

  // fixed timestep:
  private _maxFrameTimeMS: number;
  private _rafRequestId?: number;

  // render:
  private _renderIntervalToleranceMS: number;
  private _fpsIntervalMS: number;
  private _fpsPrecision: number;
  private _renderFPS = 0;
  private _minRenderMS = 0;

  // ----- Constructor: -----
  public constructor(options: InterpolatedTickerOptions)
  {
    super();

    this.fixedDeltaMS = options.fixedDeltaMS ?? 1000/60;
    this.interpolation = options.interpolation ?? true;

    this._renderer = options.renderer;
    this._stage = options.stage;
    this._interpolationOptions = options.interpolationOptions;

    this._maxFrameTimeMS = options.maxFrameTimeMS ?? this.fixedDeltaMS * 3;
    this._renderIntervalToleranceMS = options.renderIntervalToleranceMS ?? 7;
    this._fpsIntervalMS = options.fpsIntervalMS ?? 1000;
    this._fpsPrecision = options.fpsPrecision ?? 1;

    // apply setter
    this.renderFPS = options.renderFPS ?? 0;
  }

  // ----- Accessors: -----

  /**
   * Whether the ticker has started.
   */
  public get started(): boolean
  {
    return this._rafRequestId != null;
  }

  /**
   * The target refresh rate (in frames per second). Actual render refresh
   * rate may vary.
   *
   * A value of `0` means unlimited refresh rate.
   *
   * @default 0
   */
  public get renderFPS(): number { return this._renderFPS; }
  public set renderFPS(value: number)
  {
    value = Math.max(value, 0);
    this._renderFPS = value;

    if (value)
    {
      const avgIntervalMS = 1000/value;
      const minIntervalMS = avgIntervalMS - this._renderIntervalToleranceMS;

      this._minRenderMS = minIntervalMS;
    }
    else
    {
      this._minRenderMS = 0;
    }
  }

  // ----- Methods: -----

  /**
   * Start the requestAnimationFrame loop.
   */
  public start(options: StartOptions): this
  {
    if (this.started) this.stop();

    const trackdevicefps = fpsCounter({
      onChange: (devicefps) => this.emit("devicefps", devicefps),
      intervalMS: this._fpsIntervalMS,
      precision: this._fpsPrecision,
    });

    const trackfps = fpsCounter({
      onChange: (fps) => this.emit("fps", fps),
      intervalMS: this._fpsIntervalMS,
      precision: this._fpsPrecision,
    });

    const updateFn = options.update;
    const prepareRenderFn = options.prepareRender ?? EMPTY;
    const renderFn = options.render ?? EMPTY;

    const interpolator = new ContainerInterpolator(this._interpolationOptions);
    const renderer = this._renderer;
    const stage = this._stage;

    const fixedDeltaMS = this.fixedDeltaMS;
    const now = performance.now();

    let then: DOMHighResTimeStamp = now;
    let renderthen: DOMHighResTimeStamp = now;
    let accumulatedMS = 0;
    let blendFrame = false;
    let progress = 1;

    const frameHandler = (now: DOMHighResTimeStamp): void =>
    {
      // schedule next update immediately
      this._rafRequestId = requestAnimationFrame(frameHandler);

      // track frame time
      const elapsedMS = now - then;
      then = now;
      trackdevicefps(elapsedMS);

      // accumulate scaled time
      accumulatedMS += this.speed * Math.min(elapsedMS, this._maxFrameTimeMS);

      // -------------------------------------
      // Fixed timestep update:
      // -------------------------------------
      //
      while (accumulatedMS >= fixedDeltaMS)
      {
        blendFrame = this.interpolation;
        if (blendFrame) interpolator.capture(stage);
        updateFn(fixedDeltaMS);
        accumulatedMS -= fixedDeltaMS;
      }

      // -------------------------------------
      // Render frame:
      // -------------------------------------
      //
      const rendernow = performance.now();
      const renderMS = rendernow - renderthen;

      if (renderMS >= this._minRenderMS)
      {
        renderthen = rendernow;
        progress = blendFrame ? accumulatedMS/fixedDeltaMS : 1;

        // apply blended state
        prepareRenderFn(renderMS);
        if (blendFrame) interpolator.blend(progress);
        renderFn(renderMS, progress);

        // render
        renderer.render(stage);

        trackfps(renderMS);

        // reset blended state
        if (blendFrame) interpolator.unblend();
      }
    };

    // start
    this._rafRequestId = requestAnimationFrame(frameHandler);

    return this;
  }

  /**
   * Stop requestAnimationFrame loop.
   */
  public stop(): void
  {
    if (this._rafRequestId == null)
    {
      return;
    }

    cancelAnimationFrame(this._rafRequestId);
    this._rafRequestId = undefined;
  }
}
