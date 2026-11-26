# Third-party export tools

- Terser 5.47.1: https://github.com/terser/terser — BSD-2-Clause, see terser.LICENSE. Unmodified distribution copied from the existing inliner.
- Lightning CSS WASM 1.33.0: https://github.com/parcel-bundler/lightningcss — MPL-2.0. Source: npm lightningcss-wasm 1.33.0. The browser bundle is generated from index.mjs with esbuild (ES module, browser platform, fs external); WASM is an unchanged package binary.
- napi-wasm: https://github.com/devongovett/napi-wasm — MIT; included by the Lightning CSS browser bundle.

Libraries support editor import/export and are not included in generated playable ads.

- fflate 0.8.3: https://github.com/101arrowz/fflate — MIT; see fflate.LICENSE. Used to unpack ZIP in the browser.
- html-to-image 1.11.11: https://github.com/bubkoo/html-to-image — MIT; see html-to-image.LICENSE. Unmodified dist/html-to-image.js. Used by «Скріншот» in the editor only.
