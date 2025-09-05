# Lovely Mobile Maker

Tool to make an apk with lovely from a love game *cough cough* balatro.

# Development
Below are the instructions to make a working build.

## MBF zip

This uses a modified version of [ModsBeforeFriday](https://github.com/Lauriethefish/ModsBeforeFriday)'s [mbf-zip](https://github.com/Lauriethefish/ModsBeforeFriday/tree/main/mbf-zip) with support for WASM. 

To build it you musr first install [wasm-pack](https://drager.github.io/wasm-pack/installer/). After that, you can run:

```sh
cd mbf-zip
RUSTFLAGS='--cfg getrandom_backend="wasm_js"' wasm-pack build --target web
```

This generates a folder pkg with the required files. There is a symlimk so this folder should be used automatically

## base.apk

TODO:

