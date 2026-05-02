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
 * Utility that manages transform state for a tree of
 * PIXI Containers and can apply interpolation.
 *
 * @example
 * // adapted from https://gafferongames.com/post/fix_your_timestep/
 * // triggers a fixed interval "update()" function
 * const dt = 16.67;
 * let currentTime = performance.now();
 * let accumulator = 0.0;
 *
 * function frame( newTime: number )
 * {
 *     requestAnimationFrame( frame ); // queue request immediately
 *
 *     const frameTime = Math.min( newTime - currentTime, 250 );
 *     currentTime = newTime;
 *
 *     accumulator += frameTime;
 *
 *     while ( accumulator >= dt )
 *     {
 *         interpolator.capture( app.stage );
 *         update( dt );
 *         accumulator -= dt;
 *     }
 *
 *     interpolator.lerp( accumulator / dt );
 *
 *     app.renderer.render( app.stage );
 *
 *     interpolator.unlerp();
 * }
 *
 * // start loop
 * requestAnimationFrame( frame );
 */
export declare class ContainerInterpolator {
	/**
	 * Captures the known state of containers. Only containers
	 * captured in this call will be interpolated.
	 *
	 * This should be called before each `update()`.
	 */
	readonly capture: (target: Container) => void;
	/**
	 * Set containers state to a linearly interpolated value between
	 * previous captured state (`0`) and the current state (`1`).
	 *
	 * This should be called before render.
	 *
	 * @param t - Blend value (0, 1)
	 */
	readonly lerp: (t: number) => void;
	/**
	 * Restore containers to real values.
	 *
	 * This should be called after `render()`.
	 */
	readonly unlerp: () => void;
	private _$exhaustedCapacity;
	constructor(cfg?: ContainerInterpolatorOptions);
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
	 * Maximum interpolatable change in `position.x` or `position.y`.
	 *
	 * @default 100
	 */
	maxPositionDelta?: number;
	/**
	 * Maximum interpolatable change in `pivot.x` or `pivot.y`.
	 *
	 * @default 100
	 */
	maxPivotDelta?: number;
	/**
	 * Maximum interpolatable change in `scale.x` or `scale.y`.
	 *
	 * @default 1
	 */
	maxScaleDelta?: number;
	/**
	 * Maximum interpolatable change in `skew.x` or `skew.y`.
	 *
	 * @default Math.PI/2
	 */
	maxSkewDelta?: number;
	/**
	 * Maximum interpolatable change in `rotation`.
	 *
	 * @default Math.PI/2
	 */
	maxRotationDelta?: number;
	/**
	 * Initial container capacity to allocate memory for.
	 *
	 * Capacity will double in size on-demand until `maxCapacity`
	 * is reached.
	 *
	 * @default 256
	 */
	capacity?: number;
	/**
	 * Maximum containers that can be interpolated.
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
