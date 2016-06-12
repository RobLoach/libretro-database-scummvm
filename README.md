# libretro-scummvm.dat

A DAT file containing game files to run [ScummVM](http://scummvm.org) games in [RetroArch](http://www.libretro.com/).

## Usage

1. Run ScummVM in RetroArch, add each game in the ScummVM interface
2. For each game that you added, copy the individual `.scummvm` file from the [`games`](games) directory to your libretro games folder.
  - The contents of each `.scummvm` file should simply be the ScummVM game short name
3. In RetroArch, scan the directory that you added all the `.scummvm` files

## Build

1. Install [Node.js](https://nodejs.org/en/) >= 4

1. Install [ScummVM](http://scummvm.org)

1. Run `npm install` to install dependendencies

1. Run `npm test` to build the `games` directory and [`ScummVM.dat`](ScummVM.dat)
