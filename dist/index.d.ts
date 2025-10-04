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

declare class Emits<M extends Record<string, any[]>> {
	protected _listeners: {
		[K in keyof M]?: Listener<M, K>[];
	};
	on<K extends keyof M>(key: K, fn: Listener<M, K>): this;
	off<K extends keyof M>(key: K, fn: Listener<M, K>): this;
	emit<K extends keyof M>(key: K, ...args: M[K]): void;
}
export declare class ContainerInterpolator {
	private readonly _maxCapacity;
	private readonly _maxDeltaPosition;
	private readonly _maxDeltaScale;
	private readonly _maxDeltaRotation;
	private readonly _maxDeltaAlpha;
	private _containers;
	private _capacity;
	private _count;
	private _prevCount;
	private _buffer;
	private _startX;
	private _startY;
	private _startRotation;
	private _startScaleX;
	private _startScaleY;
	private _startAlpha;
	private _endX;
	private _endY;
	private _endRotation;
	private _endScaleX;
	private _endScaleY;
	private _endAlpha;
	constructor({ capacity, maxCapacity, maxDeltaPosition, maxDeltaScale, maxDeltaRotation, maxDeltaAlpha, }?: ContainerInterpolatorOptions);
	/**
	 * Capture the previous state for some tree of containers.
	 *
	 * Only containers captured here will be included.
	 */
	capture(target: Container): void;
	/**
	 * Apply blended frame state between previous and current.
	 *
	 * @param t blended value clamped to (0, 1)
	 */
	blend(t: number): void;
	/**
	 * Restore state to current values.
	 */
	unblend(): void;
	private _resizeCapacity;
}
/**
 * A fixed-timestep ticker that separates updates from rendering.
 *
 * You update the scene graph in a fixed-timestep update loop, and it will
 * interpolate the transform of Containers during rendering.
 *
 * @see https://gafferongames.com/post/fix_your_timestep/
 */
export declare class InterpolatedTicker extends Emits<{
	devicefps: [
		devicefps: number
	];
	fps: [
		fps: number
	];
}> {
	readonly fixedDeltaMS: number;
	/**
	 * Whether frame smoothing is enabled.
	 */
	interpolation: boolean;
	/**
	 * The rate that fixed updates are executed at, but does not
	 * affect the `fixedDeltaMs` value, which is always constant.
	 */
	speed: number;
	private _interpolationOptions?;
	private _stage;
	private _renderer;
	private _maxFrameTimeMS;
	private _rafRequestId?;
	private _renderIntervalToleranceMS;
	private _fpsIntervalMS;
	private _fpsPrecision;
	private _renderFPS;
	private _minRenderMS;
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
	start(options: StartOptions): this;
	/**
	 * Stop requestAnimationFrame loop.
	 */
	stop(): void;
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
export interface StartOptions {
	update: (fixedDeltaMS: number) => void;
	prepareRender?: (renderDeltaMS: number) => void;
	render?: (renderDeltaMS: number, blend: number) => void;
}
export type Listener<M extends Record<string, unknown[]>, K extends keyof M> = (...args: [
	...M[K]
]) => void;

export {};
