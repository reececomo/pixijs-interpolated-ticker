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
     * The default is true for all containers, excluding `PIXI.AnimatedSprite`,
     * `PIXI.Graphics`, `PIXI.Mesh`, and `PIXI.ParticleContainer`.
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
	 * Triggered on each render frame during frame interpolation.
	 * Container values will be their temporary interpolated values.
	 */
	onRender?: (dt: number) => void;
	/** Limit maximum number of update() per render (i.e. rendering is slow). */
	maxUpdatesPerRender: number;
	protected _app: Application;
	protected _targetUpdateIntervalMs: number;
	protected _updateIntervalMs: number;
	protected _previousTime: number;
	protected _accumulator: number;
	protected _isRunning: boolean;
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
	constructor({ app, updateIntervalMs, initialCapacity, }: {
		app: Application;
		updateIntervalMs?: number;
		initialCapacity?: number;
	});
	set speed(value: number);
	get speed(): number;
	get updateIntervalMs(): number;
	set updateIntervalMs(value: number);
	get maxRenderFPS(): number;
	set maxRenderFPS(value: number);
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
