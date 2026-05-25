# ProGuard config template for visual client 1.16.5.
# engine.js replaces {{IN_JAR}} and {{OUT_JAR}} before run.

-injars "{{IN_JAR}}"
-outjars "{{OUT_JAR}}"
{{LIBRARY_JARS_BLOCK}}

# Keep stack traces minimally useful in crash logs.
-renamesourcefileattribute SourceFile
-keepattributes Exceptions,InnerClasses,Signature,Deprecated,SourceFile,LineNumberTable,*Annotation*,EnclosingMethod

# Obfuscation on, shrinking/optimization off by default for better compatibility.
-dontshrink
-dontoptimize
-overloadaggressively
-useuniqueclassmembernames
-adaptclassstrings
-allowaccessmodification

# General warnings. Add -dontwarn rules only when needed.
-ignorewarnings
-dontnote
-dontwarn **
-dontpreverify

# You can set explicit main class if required:
# -keep class com.yourclient.Main {
#     public static void main(java.lang.String[]);
# }

# Keep entry point classes so launcher can still start jar.
-keepclasseswithmembers public class * {
    public static void main(java.lang.String[]);
}
-keepclasseswithmembers class * {
    public static void main(java.lang.String[]);
}

# Current 1.16.5 client manifest uses Main-Class: Start
-keep class Start {
    *;
}

# Keep bundled third-party/runtime packages untouched to avoid breaking reflection and service loaders.
-keep class it.** { *; }
-keep class com.** { *; }
-keep class net.** { *; }
-keep class org.** { *; }
-keep class io.** { *; }
-keep class lombok.** { *; }
-keep class imgui.** { *; }
-keep class joptsimple.** { *; }
-keep class javax.** { *; }
-keep class oshi.** { *; }
-keep class us.** { *; }

# Keep public API that launcher/injector reflects on.
# Add your real package here:
# -keep class your.package.api.** { *; }

# Keep mixin/forge/fabric annotations if used by your visual client.
-keep @interface org.spongepowered.asm.mixin.Mixin
-keep class org.spongepowered.** { *; }
-keep class net.fabricmc.** { *; }
-keep class cpw.mods.** { *; }
-keep class net.minecraftforge.** { *; }

# Keep native methods and JNI signatures.
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# Aggressive name obfuscation dictionary (optional).
# -classobfuscationdictionary obfuscator/dictionaries/classes.txt
# -packageobfuscationdictionary obfuscator/dictionaries/packages.txt
# -obfuscationdictionary obfuscator/dictionaries/members.txt

# Repackage classes to hide package tree (can break reflection in some clients).
# -repackageclasses ''
# -flattenpackagehierarchy
