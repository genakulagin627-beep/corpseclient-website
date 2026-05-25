# Obfuscator for 1.16.5

## Quick start

1. Download `proguard.jar` and place it into `obfuscator/tools/proguard.jar`  
   (or choose custom JAR in launcher UI).
2. Run:
   - `npm run obfuscate:jar -- --in "C:\path\client-1.16.5.jar" --out "C:\path\client-1.16.5-obf.jar"`
   - if ProGuard reports missing classes, add dependencies:
     - `npm run obfuscate:jar -- --in "C:\path\client.jar" --out "C:\path\client-obf.jar" --lib "C:\libs\minecraft.jar;C:\libs\guava.jar"`
   - or pass full libs directory (all jars will be added recursively):
     - `npm run obfuscate:jar -- --in "C:\path\client.jar" --out "C:\path\client-obf.jar" --lib-dir "C:\.minecraft\libraries"`
3. Put obfuscated output into launcher version `1.16.5`.
4. In launcher settings compute SHA-256 and save it as integrity hash.

## Notes

- Main template: `obfuscator/proguard-1.16.5.template.pro`
- Runtime Java modules are auto-added from `JAVA_HOME` (`jmods` or `rt.jar`) when available.
- `--lib` and `--lib-dir` must contain real existing paths (not `C:\path\...` placeholders).
- If your client uses reflection/mixins, add required `-keep` rules there.
- Do not publish mapping files publicly.
