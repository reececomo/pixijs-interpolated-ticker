import type { Container } from "pixi.js";
import { fpsCounter } from "./fps";
import { ContainerInterpolator, ContainerInterpolatorOptions } from "./ContainerInterpolator";


interface IRendererLike {
  render: (stage: Container) => void;
}

export interface LifecycleEventHooks
{
  /**
   * The fixed-timestep update/tick function.
   *
   * Any changes to containers made here will be
   * interpolated in the `render()` callback.
   */
  update: (fixedDeltaMS: number) => void;

  /**
   * A render frame is about to occur.
   *
   * Before container interpolation is applied.
   *
   * @example
   * event.prepareRender(…) // ⛳️ <-- You are here
   * // << containers interpolated
   * event.render(…)
   * // << PIXI renderer renders scene graph
   * event.postRender(…)
   */
  prepareRender?: (renderDeltaMS: number) => void;

  /**
   * A render frame is about to occur.
   *
   * After container interpolation is applied.
   *
   * @example
   * event.prepareRender(…)
   * // << containers interpolated
   * event.render(…) // ⛳️ <-- You are here
   * // << PIXI renderer renders scene graph
   * event.postRender(…)
   */
  render?: (renderDeltaMS: number, blend: number) => void;

  /**
   * A render has completed and been sent.
   *
   * After container interpolation is applied.
   *
   * @example
   * event.prepareRender(…)
   * // << containers interpolated
   * event.render(…)
   * // << PIXI renderer renders scene graph
   * event.postRender(…) // ⛳️ <-- You are here
   */
  postRender?: (renderDeltaMS: number) => void;
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

type InterpolatedTickerEvent = {
  ["devicefps"] : [devicefps: number];
  ["fps"]       : [fps: number];
};

type Listener<E extends keyof InterpolatedTickerEvent> = (...params: [...InterpolatedTickerEvent[E]]) => void;

/**
 * A fixed-timestep ticker that separates updates from rendering.
 *
 * You update the scene graph in a fixed-timestep update loop, and it will
 * interpolate the transform of Containers during rendering.
 *
 * @see https://gafferongames.com/post/fix_your_timestep/
 */
export class InterpolatedTicker
{
  public readonly fixedDeltaMS: number;

  /**
   * Whether container interpolation is enabled.
   */
  public interpolation: boolean;

  /**
   * The rate that fixed updates are executed at, but does not
   * affect the `fixedDeltaMs` value, which is always constant.
   */
  public speed = 1;

  // ----- Private properties: -----

  private stage: Container;
  private renderer: IRendererLike;

  // ----- Internal properties: -----

  /** @internal */ private _$listeners: { [E in keyof InterpolatedTickerEvent]?: Listener<E>[] } = {};
  /** @internal */ private _$interpolationOptions?: ContainerInterpolatorOptions;

  // ----- Fixed timestep loop properties: -----

  /** @internal */ private _$maxFrameTimeMS: number;
  /** @internal */ private _$rafRequestId?: number;

  // ----- Render loop properties: -----

  // render:
  /** @internal */ private _$renderIntervalToleranceMS: number;
  /** @internal */ private _$fpsIntervalMS: number;
  /** @internal */ private _$fpsPrecision: number;
  /** @internal */ private _$renderFPS = 0;
  /** @internal */ private _$minRenderMS = 0;

  // ----- Constructor: -----

  public constructor(options: InterpolatedTickerOptions)
  {
    this.fixedDeltaMS = options.fixedDeltaMS ?? 1000/60;
    this.interpolation = options.interpolation ?? true;

    this.renderer = options.renderer;
    this.stage = options.stage;
    this._$interpolationOptions = options.interpolationOptions;

    this._$maxFrameTimeMS = options.maxFrameTimeMS ?? this.fixedDeltaMS * 3;
    this._$renderIntervalToleranceMS = options.renderIntervalToleranceMS ?? 7;
    this._$fpsIntervalMS = options.fpsIntervalMS ?? 1000;
    this._$fpsPrecision = options.fpsPrecision ?? 1;

    // apply setter
    this.renderFPS = options.renderFPS ?? 0;
  }

  // ----- Accessors: -----

  /**
   * Whether the ticker has started.
   */
  public get started(): boolean
  {
    return this._$rafRequestId != null;
  }

  /**
   * The target refresh rate (in frames per second). Actual render refresh
   * rate may vary.
   *
   * A value of `0` means unlimited refresh rate.
   *
   * @default 0
   */
  public get renderFPS(): number { return this._$renderFPS; }
  public set renderFPS(value: number)
  {
    value = Math.max(value, 0);
    this._$renderFPS = value;

    if (value)
    {
      const avgIntervalMS = 1000/value;
      const minIntervalMS = avgIntervalMS - this._$renderIntervalToleranceMS;

      this._$minRenderMS = minIntervalMS;
    }
    else
    {
      this._$minRenderMS = 0;
    }
  }

  // ----- Methods: -----

  /**
   * Start the requestAnimationFrame loop.
   */
  public start(hooks: LifecycleEventHooks): this
  {
    if (this.started) this.stop();

    const updateFn        = hooks.update; // REQUIRED
    const prepareRenderFn = hooks.prepareRender ?? EMPTY;
    const renderFn        = hooks.render ?? EMPTY;
    const postRenderFn    = hooks.postRender ?? EMPTY;

    const trackDeviceFPS = fpsCounter({
      onChange: (devicefps) => this._$emit("devicefps", devicefps),
      intervalMS: this._$fpsIntervalMS,
      precision: this._$fpsPrecision,
    });

    const trackFPS = fpsCounter({
      onChange: (fps) => this._$emit("fps", fps),
      intervalMS: this._$fpsIntervalMS,
      precision: this._$fpsPrecision,
    });

    const interpolator = new ContainerInterpolator(this._$interpolationOptions);
    const renderer = this.renderer;
    const stage = this.stage;

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
      this._$rafRequestId = requestAnimationFrame(frameHandler);

      // track frame time
      const elapsedMS = now - then;
      then = now;
      trackDeviceFPS(elapsedMS);

      // accumulate scaled time
      accumulatedMS += this.speed * Math.min(elapsedMS, this._$maxFrameTimeMS);

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

      if (renderMS >= this._$minRenderMS)
      {
        renderthen = rendernow;
        progress = blendFrame ? accumulatedMS/fixedDeltaMS : 1;

        // pre-render hooks
        prepareRenderFn(renderMS);
        if (blendFrame) interpolator.blend(progress);
        renderFn(renderMS, progress);

        // PIXI render
        renderer.render(stage);

        // post-render hooks
        if (blendFrame) interpolator.unblend();
        trackFPS(renderMS);
        postRenderFn(renderMS);
      }
    };

    // start
    this._$rafRequestId = requestAnimationFrame(frameHandler);

    return this;
  }

  /**
   * Stop requestAnimationFrame loop.
   */
  public stop(): void
  {
    if (this._$rafRequestId == null)
    {
      return;
    }

    cancelAnimationFrame(this._$rafRequestId);
    this._$rafRequestId = undefined;
  }

  // ----- Events: -----

  /**
   * Add an event listener.
   */
  public on<EventName extends keyof InterpolatedTickerEvent>(
    event: EventName,
    fn: Listener<EventName>
  ): this
  {
    (this._$listeners[event] ??= []).push(fn);
    return this;
  }

  /**
   * Remove an event listener.
   */
  public off<EventName extends keyof InterpolatedTickerEvent>(
    event: EventName,
    fn: Listener<EventName>
  ): this
  {
    this._$listeners[event] = (this._$listeners[event] ??= []).filter(l => l !== fn);
    return this;
  }

  // ----- Private mehtods: -----

  /**
   * @internal
   */
  private _$emit<EventName extends keyof InterpolatedTickerEvent>(
    event: EventName,
    ...args: InterpolatedTickerEvent[EventName]
  ): void
  {
    for (const fn of (this._$listeners[event] ??= [])) fn(...args);
  }
}
