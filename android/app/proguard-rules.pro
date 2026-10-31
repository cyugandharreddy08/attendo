# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt

# React Native
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# SQLite
-keep class org.pgsqlite.** { *; }

# CodePush
-keep class com.microsoft.codepush.** { *; }

# Notifee
-keep class app.notifee.** { *; }

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }

# react-native-gesture-handler
-keep class com.swmansion.gesturehandler.** { *; }
