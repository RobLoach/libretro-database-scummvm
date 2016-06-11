# libretro-scummvm.dat

A DAT file containing game files to run [ScummVM](http://scummvm.org) games in [RetroArch](http://www.libretro.com/).

## Usage

1. Run ScummVM in RetroArch, add each game in the ScummVM interface
2. For each game that you added, copy the individual `.scummvm` file from the [`games`](games) directory to your libretro games folder.
  - The contents of each `.scummvm` file should simply be the ScummVM game short name
3. In RetroArch, scan the directory that you added all the `.scummvm` files

## Build

1. Install dependencies
  - [Node.js](https://nodejs.org/en/) >= 4
  - [Dir2Dat](http://mamedev.emulab.it/clrmamepro/docs/htm/about.htm)
    - Part of [clrmamepro](http://mamedev.emulab.it/clrmamepro/), runs well through [Wine](https://www.winehq.org/)

2. Run `node libretro-scummvm.js` to build the `games` directory

3. Use Dir2Dat to build [`ScummVM.dat`](ScummVM.dat) using `libretro-scummvm.d2d` settings on the `out` directory:
  - Single File Sets
  - Remove Extension
  - Add MD5
  - Add SHA1
