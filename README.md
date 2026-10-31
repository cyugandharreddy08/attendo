# 🎓 Attendo — Smart College Attendance & Predictive Planner

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android" />
  <img src="https://img.shields.io/badge/React_Native-0.73-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Database-SQLite%203-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Cloud-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <strong>Attendo</strong> is an intelligent, privacy-first college attendance companion designed to keep you comfortably above your 75% target. Built with weighted hours math, automated AI lab separation, predictive class planning, and what-if semester simulations.
</p>

---

## 📥 Direct APK Download

Download and install the latest production release directly on your Android device:

[![Download APK](https://img.shields.io/badge/⚡_Download_Latest_APK-v7.1.0-8B5CF6?style=for-the-badge&logo=android&logoColor=white)](https://github.com/cyugandharreddy08/attendo/releases/download/v7.1.0/Attendo_v7.1.0.apk)

> **Compatibility**: Android 7.0 (Nougat, API 24) and above.  
> **Package**: `com.tracker75` | **Architecture**: Universal APK (ARM64, ARMv7, x86_64).

---

## ✨ Key Features

### ⏱️ 1. Duration-Weighted Hours Attendance Math
Traditional attendance apps count a 1-hour lecture and a 3-hour lab equally. Attendo evaluates attendance by **actual duration hours**:
$$\text{Attendance } \% = \frac{\sum \text{Hours Attended}}{\sum \text{Total Class Hours Held}} \times 100$$
- **1-hour class** (e.g. 09:00 - 10:00) = **1.0 hr**
- **2-hour session** (e.g. 10:00 - 12:00) = **2.0 hrs**
- **3-hour lab block** (e.g. 13:00 - 16:00) = **3.0 hrs**

---

### 🧪 2. AI Lab vs. Theory Separation
- **Automated AI Categorization**: Timetable imports automatically differentiate theory lectures from hands-on laboratory and workshop sessions.
- **Dedicated Dashboards**: Separate real-time attendance indicators for **📚 Theory Classes** and **🧪 Lab Practicals**.
- **1-Tap Manual Override**: Toggle any subject between Theory and Lab directly from the subject detail screen without resetting your data.

---

### 🤖 3. Attendance Autopilot (Predictive Planner)
- Analyzes remaining timetable classes, upcoming holidays, and your target percentage.
- Recommends **exact safe bunk buffers** ("Safe to skip up to 3 classes") vs. **mandatory attendance alerts** ("Must attend next 4 classes consecutively").

---

### 🔮 4. Campus Day Twin (Semester Simulator)
- Interactive "what-if" simulator for the entire semester.
- Model planned absences, extra classes, or exam leaves with real-time percentage forecasts before making a decision.

---

### 🏃 5. Smart Catch-Up Coach
- Automatically generates recovery cards whenever a class is marked absent.
- Includes syllabus checklist, recommended 45-minute study blocks, and a **1-tap classmate note request generator** ready to share via WhatsApp or SMS.

---

### 📡 6. Attendance Risk Radar
- Detects behavioural patterns (e.g., *"You miss Tuesday morning classes most frequently"*).
- Forecasts subjects at risk of dropping below your target percentage 2–4 weeks in advance.

---

### 📷 7. AI Timetable Intelligence Scanner
- Copy our specialized prompt to ChatGPT or Gemini with a photo of your schedule.
- Paste the generated JSON to parse, validate, preview, and import all classes and rooms with conflict detection in seconds.

---

### 📅 8. Timetable & Schedule Management
- **Dual View**: Seamlessly switch between a Period Grid view and a Day List view.
- **Atomic Class Swap**: Interchanging two classes updates both instances in an atomic SQLite transaction.
- **Selective Deletion**: Delete a single cancelled class without affecting weekly recurring entries.
- **Bulk Day Holiday**: Mark entire days as holidays or college festivals in one tap.

---

### 🛡️ 9. Offline-First Privacy & Backup
- **100% Local SQLite Database**: Instant startup and zero latency, with full offline functionality.
- **JSON Backup & Restore**: Export full timetable and attendance data to clipboard or JSON file for seamless device migration.
- **Permanent Device Identity**: Document-seeded identity persistence across app restarts.

---

### 📱 10. Phone Authentication & Verified Campus Profile
- **Mobile Number Login**: Simple phone OTP verification connected directly to your Supabase Cloud profile.
- **Institute & Academic Year Identity**: Set your username (`@handle`), college name, and academic year (`1st Year`, `2nd Year`, `3rd Year`, `4th Year`).
- **Campus Directory & Peer Discovery**: Search and discover students from your institute or any college across the country. View peer rankings, overall attendance percentages, and streak milestones.

---

### 🔥 11. LeetCode-Style Attendance Streaks & Heatmap
- **Daily Consistency Matrix**: Visual 7×N contribution graph showing daily attendance density with 5 green intensity levels just like GitHub & LeetCode.
- **Streak Tracker**: Automatic calculation of current active daily streak and all-time maximum streak.
- **Campus Badges & Achievements**: Unlock awards including *Hatching Flame*, *Ironclad Regular*, *Lab Prodigy*, and *Distinction 90%*.
- **Public Profile Sharing**: Share your live profile and streak scorecard with classmates and friends in one tap.

---

## 🏗️ Technology Stack

| Component | Technology |
|---|---|
| **Framework** | [React Native 0.73](https://reactnative.dev/) with Hermes JavaScript Engine |
| **Language** | [TypeScript 5.0](https://www.typescriptlang.org/) (Strict Mode) |
| **Local Database** | [SQLite 3](https://github.com/andpor/react-native-sqlite-storage) via native promise driver |
| **Navigation** | [React Navigation 6](https://reactnavigation.org/) (Native Stack & Bottom Tabs) |
| **Animations** | [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) & Gesture Handler |
| **Notifications** | [Notifee](https://notifee.app/) Local Trigger Notifications |
| **Cloud Telemetry** | [Supabase](https://supabase.com/) REST Client & Gemini 2.0 Flash AI |
| **Styling** | Semantic Dark Theme with Glassmorphic visual accents |

---

## 💻 Local Development Setup

### Prerequisites
- Node.js >= 18
- JDK 17
- Android Studio with Android SDK (API 34)

### Clone & Install

```bash
# Clone the repository
git clone https://github.com/cyugandharreddy08/attendo.git
cd attendo

# Install JavaScript dependencies
npm install
```

### Run on Android Device / Emulator

```bash
# Start Metro Bundler
npx react-native start

# In a separate terminal, compile and run on connected device
npx react-native run-android
```

### Build Production Release APK

```bash
cd android
./gradlew assembleRelease
# Output binary: android/app/build/outputs/apk/release/app-release.apk
```

---

## 📂 Project Structure

```text
attendo/
├── android/               # Native Android application & Gradle configuration
├── src/
│   ├── components/        # Reusable UI widgets (CircularProgress, SubjectCard, etc.)
│   ├── config/            # Supabase & app configuration
│   ├── db/
│   │   ├── database.ts    # SQLite database connection & migrations
│   │   ├── schema.ts      # Table schema definitions (Subjects, Timetable, Instances, etc.)
│   │   └── queries/       # Type-safe database queries (lectureInstances, subjects, timetable)
│   ├── features/          # High-value feature modules:
│   │   ├── AttendanceAutopilot.tsx
│   │   ├── CampusDayTwin.tsx
│   │   ├── SmartCatchUpCoach.tsx
│   │   ├── AttendanceRiskRadar.tsx
│   │   ├── RecoveryPlanner.tsx
│   │   └── NextClassWidget.tsx
│   ├── navigation/        # Stack & Tab navigators
│   ├── screens/           # Main application screens (Timetable, Reports, Settings, etc.)
│   ├── services/          # Cloud services (SupabaseClient, OTAService, BugReportService)
│   ├── theme/             # Design system (Colors, Spacing, Typography)
│   └── types/             # Shared TypeScript definitions
├── host-panel/            # Administrative review dashboard
├── App.tsx                # Application root entry point
└── package.json           # Dependencies and scripts
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.

---

<p align="center">
  Crafted with care for university students everywhere. Keep your attendance above 75%!
</p>
