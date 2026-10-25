# Documentation fonts

The documentation uses JetBrains Mono for Latin text and Sarasa Term SC for CJK
fallback, including mixed text and code. Both fonts are self-hosted, use
`font-display: swap`, and ship regular (400) and bold (700) weights. Browsers match
intermediate weights to these faces and synthesize italics when needed.

- [JetBrains Mono v2.304](https://github.com/JetBrains/JetBrainsMono/tree/v2.304/fonts/webfonts):
  the upstream `JetBrainsMono-Regular.woff2` and `JetBrainsMono-Bold.woff2` files.
- [Sarasa Gothic v1.0.43](https://github.com/be5invis/Sarasa-Gothic/releases/tag/v1.0.43):
  `SarasaTermSC-Regular.ttf` and `SarasaTermSC-Bold.ttf` from
  `SarasaTermSC-TTF-Unhinted-1.0.43.7z`, converted to WOFF2 with FontTools 4.67.0
  and Brotli 1.2.1 (quality 5). All upstream glyphs are retained, including CJK punctuation and
  rare ideographs. To reproduce, load each TTF with `fontTools.ttLib.TTFont`, set
  `font.flavor = "woff2"`, set `font.flavorData` to
  `fontTools.ttLib.woff2.WOFF2FlavorData(transformedTables=set())`, and set the
  WOFF2 writer's `brotli.compress` quality to 5. Then call `font.save()` with the
  output filename. Skipping optional glyph transforms keeps conversion fast.
  CSS limits this fallback face to U+2000 and above.

Both upstream licenses are preserved alongside the fonts. Relative CSS URLs let
Rspress publish the fonts under the configured deployment base without a CDN.

中文说明：文档中的英文和数字使用 JetBrains Mono，中文回退到 Sarasa Term SC；
混排和代码区共用同一字体栈。字体随站点发布，无需本地安装或访问第三方字体 CDN。
包含常规和粗体两个字重；Sarasa 保留上游全部字形，CSS 将其限制为 U+2000 及以上
字符的回退字体。后续增加汉字无需重新生成字体。更新时保留对应的 OFL 许可证。
