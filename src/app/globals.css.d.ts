declare const _brand: unique symbol;
type CssModule = { readonly [_key: string]: string } & { readonly [_brand]: "CssModule" };

declare module "./globals.css" {
  const css: CssModule;
  export default css;
}

