# 🌱 SafiPackApp – Smarter Packaging, Cleaner Future

**SafiPackApp** is a mobile application built to raise awareness around packaging waste and help individuals make smarter, more sustainable choices. Designed with simplicity and purpose, it enables users to scan product packaging, instantly identify the material type (like plastic, cardboard, or glass), and receive an eco-score that reflects environmental friendliness.

By making eco-awareness accessible to anyone with a smartphone, **SafiPackApp** empowers a cleaner, more informed future—starting right from your home or local store.

<br>

## 📱 Core Features

* **Instant Packaging Scan** – Use your phone’s camera or image gallery to scan product packaging.
* **Smart Material Detection** – The app automatically classifies packaging material using AI-powered models.
* **Eco-Score Rating** – Each scan returns a clear A–E eco-score based on the impact of the material.
* **Scan History** – Quickly access a history of past scans and results.
* **User Login & Accounts** – Secure sign-up and login using your email to track your sustainability journey.
* **Cloud-Based Storage** – All scans and images are safely stored for future reference and usage.

<br>

## 📊 Admin Dashboard
🔗 [**Open the Dashboard**](https://aimemagni-safipack-web-app-mghwfx.streamlit.app)

<br>

## 🎥 Demo Video

See SafiPackApp in action:
👉 [**Watch Demo Video**](https://www.youtube.com/watch?v=hylvC5dESDc)

<br>

## 🖼️ App Screenshots

Explore how the app looks and feels:

![App Screenshot](https://github.com/AIMEMAGNI/SafiPackApp/raw/main/App%20ScreenSHot.jpg)


## 📲 Download APK

Try SafiPackApp on your Android phone today:
⬇️ [**Download APK**](https://drive.google.com/file/d/1Lyz-VwJy4Jlq7T3R8kkC8bIYCM6q3Kpl/view?usp=drive_link)

<br>

## 🧩 Built With

| Component        | Technology                                                       |
| ---------------- | ---------------------------------------------------------------- |
| UI Framework     | React Native (Expo)                                              |
| Image Tools      | Expo ImagePicker & ImageManipulator                              |
| Backend Platform | Firebase (Authentication, Database, Storage)                     |
| ML Integration   | Mobile-optimized model (MobileNetV3)                             |

<br>

## 🚀 Get Started

### Prerequisites

* Node.js (v18+)
* Expo CLI (`npm install -g expo-cli`)
* Firebase account and project

### Installation Steps

```bash
git clone https://github.com/yourusername/SafiPackApp.git
cd SafiPackApp
npm install
```

### Run the App

```bash
expo start
```

Scan the QR code using the **Expo Go** app on your mobile device.

<br>

## 🔧 Firebase Configuration

1. Create a Firebase project.
2. Enable:

   * **Email/Password Authentication**
   * **Database**
   * **Cloud Storage**
3. Add `firebaseConfig.js` in the project root:

```js
// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app-id",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID",
  databaseURL: "https://your-app.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app);

export { auth, database, storage };
```

<br>

## 🗂️ Project Structure

```
SafiPackApp/
├── assets/                  # Logos and static assets
├── components/              # UI elements and custom views
├── screens/                 # App pages (Home, Scan, History, Auth)
├── firebaseConfig.js        # Firebase connection
├── App.js                   # App entry point
├── package.json
└── README.md
```

<br>

## 🤝 Contributors

* **Aime Magnifique NDAYISHIMIYE** – Project Lead & Developer
