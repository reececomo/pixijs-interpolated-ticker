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
