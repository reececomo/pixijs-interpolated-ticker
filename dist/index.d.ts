/*
 * PixiJs Mixin:
 */
declare module 'pixi.js' {

  export interface Container {

    /**
     * (Optional) Whether interpolation is enabled for a container (and
     * its descendants).
     *
     * Set `getDefaultInterpolation( container )` on `InterpolatedTicker` to
     * modify the default behavior.
     *
     * The default is true for all containers.
     */
    interpolation?: boolean;

    /**
     * (Optional) An array of child containers to include in interpolation.
     * When not set, all `children` are used.
     *
     * Default: `undefined`
     */
    interpolatedChildren?: Container[];

    /**
     * (Optional) Set positional wraparound for a container.
     *
     * Default: `undefined`
     */
    interpolationWraparound?: {
      /** Range to wraparound. @example 200 would be -100 to 100. */
      xRange: number;
      /** Range to wraparound. @example 200 would be -100 to 100. */
      yRange: number;
    };

  }

}

export {};
import { Application, Container } from 'pixi.js';

/**
 * A fixed timestep ticker class that runs an update loop and interpolates the
 * position, scale, rotation and alpha of containers.
 */
export declare class InterpolatedTicker {
	/**
	 * The update loop to trigger on each fixed timestep.
	 * Container values set here are interpolated on render frames.
	 */
	update?: (ft: number) => void;
	/**
	 * Triggered at the start of each cycle, prior to
	 * any update or render frames being processed.
	 */
	evalStart?: (start: number) => void;
	/**
	 * Triggered at the end of each cycle, after any
	 * update or render frames have been processed.
	 */
	evalEnd?: (start: number) => void;
	/**
	 * Triggered before a render frame.
	 *
	 * Container values are their true values.
	 */
	beforeRender?: (dt: number) => void;
	/**
	 * Triggered during a render frame (prior to writing
	 * the framebuffer).
	 *
	 * Container values are their interpolated values.
	 */
	onRender?: (dt: number) => void;
	/**
	 * Triggered after a render frame (after writing the
	 * framebuffer).
	 *
	 * Container values are their true values.
	 */
	afterRender?: (dt: number) => void;
	/** Limit maximum number of update() per render (i.e. rendering is slow). */
	maxUpdatesPerRender: number;
	/** Whether interpolation is currently enabled. */
	interpolation: boolean;
	/** The maximum change in position values to interpolate (default: 100). */
	autoLimitPosition: number;
	/** The maximum change in scale values to interpolate (default: 1). */
	autoLimitScale: number;
	/** The maximum change in rotation values to interpolate (default: 45°). */
	autoLimitRotation: number;
	/** The maximum change in alpha values to interpolate (default: 0.5). */
	autoLimitAlpha: number;
	protected _app: Application;
	protected _targetUpdateIntervalMs: number;
	protected _updateIntervalMs: number;
	protected _previousTime: number;
	protected _accumulator: number;
	protected _started: boolean;
	protected _speed: number;
	protected _maxRenderFPS: number;
	protected _maxRenderIntervalMs: number;
	protected _capacity: number;
	protected _idxContainers: Array<InterpolatedContainer | undefined>;
	protected _idxContainersCount: number;
	protected _prevIdxContainersCount: number;
	protected _maxIdx: number;
	protected _releasedIdx: number[];
	protected _prevX: Float32Array;
	protected _prevY: Float32Array;
	protected _prevRotation: Float32Array;
	protected _prevScaleX: Float32Array;
	protected _prevScaleY: Float32Array;
	protected _prevAlpha: Float32Array;
	protected _shadowX: Float32Array;
	protected _shadowY: Float32Array;
	protected _shadowRotation: Float32Array;
	protected _shadowScaleX: Float32Array;
	protected _shadowScaleY: Float32Array;
	protected _shadowAlpha: Float32Array;
	protected _buffer: ArrayBuffer;
	constructor({ app, update, evalStart, evalEnd, beforeRender, onRender, afterRender, autoLimitAlpha, autoLimitPosition, autoLimitRotation, autoLimitScale, interpolation, updateIntervalMs, initialCapacity, }: {
		app: Application;
		interpolation?: boolean;
		updateIntervalMs?: number;
		initialCapacity?: number;
		update?: (ft: number) => void;
		evalStart?: (start: number) => void;
		evalEnd?: (start: number) => void;
		beforeRender?: (dt: number) => void;
		onRender?: (dt: number) => void;
		afterRender?: (dt: number) => void;
		autoLimitAlpha?: number;
		autoLimitPosition?: number;
		autoLimitRotation?: number;
		autoLimitScale?: number;
	});
	set speed(value: number);
	get speed(): number;
	get updateIntervalMs(): number;
	set updateIntervalMs(value: number);
	get maxRenderFPS(): number;
	set maxRenderFPS(value: number);
	get started(): boolean;
	start(): void;
	stop(): void;
	/**
	 * Override this to opt-in containers from interpolation.
	 */
	getDefaultInterpolation(container: InterpolatedContainer): boolean;
	protected _resizeBuffer(newCapacity: number): void;
	protected _captureContainers(): void;
	protected _captureContainersTraverseSubtree(container: InterpolatedContainer): void;
	protected _interpolateContainers(accumulated: number): void;
	protected _restoreContainers(): void;
	protected _markReleased(container: InterpolatedContainer | undefined): void;
}
export type InterpolatedContainer = Container & {
	/**
	 * The internal index number for interpolated containers.
	 * @protected
	 */
	_interpIdx?: number;
	/**
	 * (Optional) Whether interpolation is enabled for a node and its descendants.
	 *
	 * Set `getDefaultInterpolation( container )` on `InterpolatedTicker` to set the
	 * default behavior.
	 *
	 * The default for most nodes is true.
	 */
	interpolation?: boolean;
	/**
	 * (Optional) An array of child containers to include in interpolation.
	 * When not set, all `children` are used.
	 *
	 * Default: `undefined`
	 */
	interpolatedChildren?: Container[];
	/**
	 * (Optional) Set positional wraparound for a container.
	 *
	 * Default: `undefined`
	 */
	interpolationWraparound?: {
		/** Range to wraparound. @example 200 would be -100 to 100. */
		xRange: number;
		/** Range to wraparound. @example 200 would be -100 to 100. */
		yRange: number;
	};
};

export {};
