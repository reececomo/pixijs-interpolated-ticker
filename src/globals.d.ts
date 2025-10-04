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
