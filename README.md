# libretro-scummvm.dat

A DAT file containing game files to run [ScummVM](http://scummvm.org) games in [RetroArch](http://www.libretro.com/).

## Usage

1. Find the Game ID of the game you're looking to add. The game IDs can be found in [ScummVM's compatibility list](http://scummvm.org/compatibility).
    > `monkey` for Monkey Island

2. Create a `.scummvm` file *inside the game directory* named by the Game ID
    > `monkey.scummvm` for Monkey Island

3. Open up the file in a text editor, and add the Game ID.
    > `echo monkey >> monkey.scummvm`

4. (Optional) You could download prepared `.scummvm` files from [the libretro-database-scummvm/games directory](games).

5. Scan each game directory

## Build

1. Install [Node.js](https://nodejs.org/en/) >= 4
1. Install [ScummVM](http://scummvm.org)
1. Run `npm install` to install dependendencies
1. Run `npm test` to build the `games` directory and [`ScummVM.dat`](ScummVM.dat)
1. If the game is not listed, you can add it by editing the [`games.json`](games.json) file
