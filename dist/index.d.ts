declare module "pixi.js"
{
  export interface Container
  {
    /**
     * Whether interpolation is enabled on this container.
     *
     * @default true
     */
    isInterpolated?: boolean;

    /**
     * Whether interpolation is enabled on this container's children.
     *
     * @default true
     */
    hasInterpolatedChildren?: boolean;
  }
}

export {};
import { Container } from 'pixi.js';

/**
 * Utility that captures a tree of containers,
 * and then allows you to blend/unblend the state.
 *
 * @example
 * // adapted from https://gafferongames.com/post/fix_your_timestep/
 * const tickMs = 1_000 / 60;
 * function tick( tickMs ) {} // do world updates here
 *
 * let accumulatorMs = 0.0;
 * let then = performance.now();
 *
 * // start
 * requestAnimationFrame( frameHandler );
 *
 * function frameHandler( now )
 * {
 *     requestAnimationFrame( frameHandler ); // schedule immediately
 *
 *     accumulatorMs += Math.min( now - then, 40.0 );
 *     then = now;
 *
 *     while ( accumulatorMs >= tickMs )
 *     {
 *         // capture containers "previous" state
 *         containerInterpolator.capture( pixiApp.stage );
 *
 *         tick( tickMs );
 *         accumulatorMs -= tickMs;
 *     }
 *
 *     // apply blended container state
 *     containerInterpolator.blend( accumulatorMs / tickMs );
 *
 *     pixiApp.renderer.render( pixiApp.stage );
 *
 *     // clear container interpolation
 *     containerInterpolator.unblend();
 * }
 */
export declare class ContainerInterpolator {
	constructor(cfg?: ContainerInterpolatorOptions);
	/**
	 * Declares the previous state of containers. Only containers
	 * captured here will be interpolated.
	 *
	 * This should be called before each `update()`.
	 */
	capture(target: Container): void;
	/**
	 * Set containers state to a blend between previous captured
	 * state and the current state.
	 *
	 * This should be called before each `render()`.
	 *
	 * @param t blended value clamped to (0, 1)/
	 */
	blend(t: number): void;
	/**
	 * Restore containers to current true values.
	 *
	 * This should be called after each `render()`.
	 */
	unblend(): void;
}
/**
 * A fixed-timestep ticker that separates updates from rendering.
 *
 * You update the scene graph in a fixed-timestep update loop, and it will
 * interpolate the transform of Containers during rendering.
 *
 * @see https://gafferongames.com/post/fix_your_timestep/
 */
export declare class InterpolatedTicker {
	readonly fixedDeltaMS: number;
	/**
	 * Whether container interpolation is enabled.
	 */
	interpolation: boolean;
	/**
	 * The rate that fixed updates are executed at, but does not
	 * affect the `fixedDeltaMs` value, which is always constant.
	 */
	speed: number;
	private stage;
	private renderer;
	constructor(options: InterpolatedTickerOptions);
	/**
	 * Whether the ticker has started.
	 */
	get started(): boolean;
	/**
	 * The target refresh rate (in frames per second). Actual render refresh
	 * rate may vary.
	 *
	 * A value of `0` means unlimited refresh rate.
	 *
	 * @default 0
	 */
	get renderFPS(): number;
	set renderFPS(value: number);
	/**
	 * Start the requestAnimationFrame loop.
	 */
	start(hooks: LifecycleEventHooks): this;
	/**
	 * Stop requestAnimationFrame loop.
	 */
	stop(): void;
	/**
	 * Add an event listener.
	 */
	on<EventName extends keyof InterpolatedTickerEvent>(event: EventName, fn: Listener<EventName>): this;
	/**
	 * Remove an event listener.
	 */
	off<EventName extends keyof InterpolatedTickerEvent>(event: EventName, fn: Listener<EventName>): this;
}
export interface ContainerInterpolatorOptions {
	/**
	 * Maximum interpolatable change in position x/y.
	 *
	 * @default 100
	 */
	maxDeltaPosition?: number;
	/**
	 * Maximum interpolatable change in scale.
	 *
	 * @default 1
	 */
	maxDeltaScale?: number;
	/**
	 * Maximum interpolatable change in rotation.
	 *
	 * @default Math.PI/2
	 */
	maxDeltaRotation?: number;
	/**
	 * Maximum interpolatable change in alpha.
	 *
	 * @default 0.5
	 */
	maxDeltaAlpha?: number;
	/**
	 * Initial number of containers to preallocate interpolation memory for.
	 *
	 * @default 256
	 */
	capacity?: number;
	/**
	 * Maximum number of containers to allocate interpolation memory for.
	 *
	 * @default 4096
	 */
	maxCapacity?: number;
}
export interface IRendererLike {
	render: (stage: Container) => void;
}
export interface InterpolatedTickerOptions {
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
export interface LifecycleEventHooks {
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
export type InterpolatedTickerEvent = {
	["devicefps"]: [
		devicefps: number
	];
	["fps"]: [
		fps: number
	];
};
export type Listener<E extends keyof InterpolatedTickerEvent> = (...params: [
	...InterpolatedTickerEvent[E]
]) => void;

export {};
