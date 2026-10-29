# Figma review archive

The final implementation screenshots are in
[site-system/final-implementation-149ef3e](site-system/final-implementation-149ef3e).
They show application code at commit `149ef3e`, using fixture accounts, workspaces,
permissions, Todos and queue data. Mobile images are browser viewports, not
physical-device soft-keyboard verification.

[Open the final screenshot review in Figma](https://www.figma.com/design/wbcGZwxsUSTjA3oALLEaBX?node-id=119-4715).

Other images document historical design proposals, component reviews and fixes;
they are not all screenshots of the final application. In particular, the compact
tool-card proposal remains a candidate; the implementation keeps the original card.

`site-system-source` contains capture-time scripts, manifests and source hashes.
`site-system/implementation-context` contains official Figma reference output and
screenshots. These are archived evidence, not application modules or maintained
scripts. Local paths and temporary asset links describe the capture environment
and may no longer resolve. Biome excludes this archive to preserve the original
capture records; application source and tests remain checked.

The implementation at `149ef3e` passed the dedicated integration suite (12 tests)
and browser suite (61 tests). The final changes also passed web unit tests, type
checking, web build and source-file Biome checks. This archive does not imply
physical-device or real-data testing.
