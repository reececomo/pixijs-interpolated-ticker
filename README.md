# 🎥 pixijs-interpolated-ticker &nbsp;[![NPM version](https://img.shields.io/npm/v/pixijs-interpolated-ticker.svg)](https://www.npmjs.com/package/pixijs-interpolated-ticker) [![Minzipped](https://badgen.net/bundlephobia/minzip/pixijs-interpolated-ticker@latest)](https://bundlephobia.com/package/pixijs-interpolated-ticker) [![Downloads per month](https://img.shields.io/npm/dm/pixijs-interpolated-ticker.svg)](https://www.npmjs.com/package/pixijs-interpolated-ticker) [![Tests](https://github.com/reececomo/pixijs-interpolated-ticker/actions/workflows/tests.yml/badge.svg)](https://github.com/reececomo/pixijs-interpolated-ticker/actions/workflows/tests.yml) [![License](https://badgen.net/npm/license/pixijs-interpolated-ticker)](https://github.com/reececomo/pixijs-interpolated-ticker/blob/main/LICENSE)

⚡ Simple, highly-configurable, high-performance frame interpolation for PixiJS

| | |
| ------ | ------ |
| 🔮 Simple, drop-in API | 💪 Powerful configuration, sensible defaults |
| ✅ Compatible with animation plugins | 🚀 Decouple your update and render loops|
| 🍃 No dependencies & tree-shakeable | 🎥 Interpolates `position`, `scale`, `rotation`, and `alpha` |
| 🤏 ~1.6kB | ✨ Supports PixiJS |

## Sample Usage

*Create and configure a ticker.*

```ts
// define a ticker (default: 60Hz)
const ticker = new InterpolatedTicker({ app })

ticker.update = () => {
  // changes made here will be rendered at the
  // current refresh rate is (e.g. 30Hz, 144Hz)
}

ticker.start()
```

## Getting Started with PixiJS Interpolated Ticker

## Installation

*Quick start guide.*

```sh
# npm
npm install pixijs-interpolated-ticker -D

# yarn
yarn add pixijs-interpolated-ticker --dev
```

## Ticker Options

*Configuring your interpolation ticker.*

```ts
const ticker = new InterpolationTicker({
  app: myApplication,

  // how often to trigger update loop (default: 1000/60)
  updateIntervalMs: 1000 / 30,

  // initial # of containers to pre-allocate memory for (default: 500)
  initialCapacity: 10000, 
})

// set the target frequency of the update loop
ticker.updateIntervalMs = 8.3334

// modify the frequency of the update loop (relative to updateIntervalMs)
ticker.speed = 1.5

// listen to render frames
ticker.onRender = ( deltaTimeMs ) => {
  // called during rendering
}

// limit the render frequency (default: -1)
ticker.maxRenderFPS = 60

// limit the maximum number of times the update loop can be triggered
// if rendering is interrupted or slow for any reason
ticker.maxUpdatesPerRender = 4;

// set the default logic for opt-in/opt-out containers
ticker.getDefaultInterpolation = ( container ): boolean => {
  return !(container instanceof ParticleContainer);
}
```

## Container Options

Containers are extended with a few optional properties to make it easy to configure interpolation.

| Property | Description |
| :----- | :------ |
| `interpolation` | Whether interpolation is explicitly enabled or disabled for this container. The default behavior for all containers is `true`. |
| `interpolatedChildren` | An array of child containers to include in interpolation. When not set, `children` is used. |
| `interpolationWraparound` | If set, position will smoothly wraparound the given ranges. |

```ts
// disable interpolation for a container
// (and all of its descendants):
const sprite = new Sprite()
sprite.interpolation = false;

// allow a container's position to wraparound smoothly:
const background = new Sprite()
background.interpolationWraparound = {
  xRange: 1000,
  yRange: 2000
}

// explicitly set which children may be interpolated
const parent = new Container()
const childA = new Container()
const childB = new Container()
parent.addChild( childA, childB )
parent.interpolatedChildren = [ childB ];
```
