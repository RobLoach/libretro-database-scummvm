# libretro-scummvm.dat

A DAT file containing game files to run [ScummVM](http://scummvm.org) games in [RetroArch](http://www.libretro.com/).

## Usage

1. Make `.scummvm` files containing the [Game Short Name](https://www.scummvm.org/compatibility/) for each game you added
  - For Day of the Tentacle, `DayOfTheTentacle.scummvm` should contain `dott`
1. Move each .scummvm file into their own game directories
1. In RetroArch, scan the directory each game directory

### Unsupported Games

If a game does not apear in the DAT, you can add it by editing the [`games.json`](games.json) file.

## Build

1. Install [Node.js](https://nodejs.org/en/) >= 4
1. Install [ScummVM](http://scummvm.org)
1. Run `npm install` to install dependendencies
1. Run `npm test` to build the `games` directory and [`ScummVM.dat`](ScummVM.dat)
