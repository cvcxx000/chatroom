# Default ProGuard rules
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable

# Gson / model classes
-keep class com.chatroom.client.data.model.** { *; }
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}
