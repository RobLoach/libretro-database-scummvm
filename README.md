# libretro-database-scummvm

Builds libretro-database's [ScummVM.dat](https://github.com/libretro/libretro-database/blob/master/dat/ScummVM.dat) to allow scanning for ScummVM games in RetroArch.

## Build

1. Ensure you have ScummVM installed at either `scummvm` or `flatpak run org.scummvm.ScummVM`

   ```
   scummvm --help
   ```

1. Put `ScummVM.xml` and `ScummVM SVN.xml` in the root
1. Have network access to fetch release year, developer, and franchise metadata from [scummvm-icons](https://github.com/scummvm/scummvm-icons). If it can't be reached, the build continues without it.
1. Run Node.js to build
   ```
   npm it
   ```
