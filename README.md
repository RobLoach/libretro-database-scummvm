# libretro-scummvm.dat

Builds libretro-database's [ScummVM.dat](https://github.com/libretro/libretro-database/blob/master/dat/ScummVM.dat) to allow scanning for ScummVM games in RetroArch.

## Build

1. Ensure you have ScummVM installed at either `scummvm` or `flatpak run org.scummvm.ScummVM`

   ```
   scummvm --help
   ```

1. Put `ScummVM.xml` and `ScummVM SVN.xml` in the root
1. Run Node.js to build
   ```
   npm it
   ```
