<div align="center">
  <img src="frontend/public/logo.png" width="110" alt="Unlim Clout Logo" />
  <h1>Unlim Clout</h1>
  <p><strong>Turn Telegram into your personal, unlimited, and private cloud storage with a Google Drive & Colab high-speed bridge.</strong></p>

  <p>
    <a href="https://github.com/"><img src="https://img.shields.io/badge/Release-v0.1.0-blue?style=for-the-badge&logo=github" alt="Release" /></a>
    <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri_v2-24C8D8?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/Python_FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker_Colab-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" /></a>
    <a href="#license"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" /></a>
  </p>

  <p>
    <a href="#-quick-start-guide-for-everyone">Quick Start Guide</a> •
    <a href="#-key-features">Key Features</a> •
    <a href="#-google-drive--colab-bridge">Google Drive Bridge</a> •
    <a href="#-early-stage--contributions">Project Status</a> •
    <a href="#-roadmap">Roadmap</a> •
    <a href="#-contributing">Contributing</a>
  </p>
</div>

---

> [!WARNING]
> ### 🚧 Project Status: Early Alpha & Work-in-Progress
> **Unlim Clout is in its early stages of active development.** 
> While core storage functions (file/folder uploading, 2GB+ chunking, downloads, Google Drive Colab transfer, and data backup) are fully operational, **several features and buttons in the user interface are currently placeholders or work-in-progress.**
> 
> We are actively developing new capabilities every week! If you are a developer, designer, or enthusiast, **your contributions and feedback are warmly welcomed!** ([See Contributing](#-contributing)).

---

## 📖 What is Unlim Clout?

**Unlim Clout** is a modern, lightweight desktop cloud manager that uses **Telegram's free and unlimited file storage infrastructure** as your personal cloud backend, combined with an automated **Google Colab & Google Drive transfer engine**.

---

## ✨ Key Features

- ♾️ **Unlimited Free Cloud Storage**: Uses your private Telegram channel with zero monthly subscription fees.
- 🧩 **Automatic 2GB+ File Splitting**: Telegram limits bot uploads to 2,000 MB. Unlim Clout automatically chunks large files on upload and seamlessly reassembles them upon download.
- 📁 **Folder Uploads & Hierarchical Tree**: Upload entire folders from your computer or Google Drive while preserving full folder and subfolder organization.
- ⚡ **Google Drive & Colab Cloud Bridge**: Transfer folders and files directly between Google Drive and Telegram at up to 100 MB/s without using your personal home internet bandwidth or local hard drive space.
- 🔒 **100% Private & Direct**: No middleman servers! Your bot token, Telegram messages, and Google session exist only on your local machine and your private channel.
- 💾 **One-Click Backup & Restore**: Export your entire file index and channel connection to a JSON file. Restore it anywhere with zero risk of database corruption.
- 🎨 **Modern Google Drive-Style Interface**: Complete with Dark Mode, Grid/Table view, breadcrumb navigation, progress widgets, and custom scrollbars.
- 🚀 **Blazing Fast & Ultra-Lightweight**: Built with Tauri v2 and Rust, consuming less than 90 MB of RAM (unlike heavy Electron apps).

---

## 🚀 Quick Start Guide (For Everyone)

You don't need any programming knowledge to set up Unlim Clout. Follow this simple 3-minute guide:

### Step 1: Download & Install
1. Head over to the **[Releases](https://github.com/m-awais-khan/unlim-clout/releases)** page.
2. Choose which file to download:
   - **`Unlim Clout_0.1.0_x64-setup.exe` (⭐ Recommended for most users)**:
     Standard Windows installer. Double-click to install. It automatically bundles and manages `backend.exe` in the background—you do **not** need to download anything else!
   - **`Unlim Clout_0.1.0_x64_en-US.msi`**:
     Standard Windows Installer package for enterprise or automated rollouts (also bundles `backend.exe` automatically).
   - **`UnlimClout-portable.exe` (Portable Version)**:
     Runs directly without installation.
     > 💡 **Important for Portable Users:** If using `UnlimClout-portable.exe`, you must also download **`backend.exe`** from the assets and place it in the **same folder** as `UnlimClout-portable.exe`. The portable app needs `backend.exe` alongside it to communicate with Telegram and handle file transfers.
3. Launch the app!

---

### Step 2: Get Your Telegram Bot Token (30 Seconds)
1. Open Telegram and search for **[@BotFather](https://t.me/BotFather)**.
2. Send the message: `/newbot`
3. Enter a friendly name (e.g. `My Cloud Bot`) and a username ending in `bot` (e.g. `my_personal_cloud_bot`).
4. **Copy the API Token** provided by BotFather (it looks like `8512507717:AA...`).

---

### Step 3: Create Your Private Storage Channel
1. In Telegram, click the **New Message / Menu** icon ➔ **New Channel**.
2. Name it (e.g. *My Cloud Storage*) and set it to **Private**.
3. Open channel settings ➔ **Administrators** ➔ **Add Administrator**.
4. Search for your bot's username and add it as an **Admin** with full permissions.
5. Post a quick message in your channel (e.g., *"hello"*).

---

### Step 4: Connect & Start Uploading
1. Open **Unlim Clout** and click the **Settings (⚙️)** icon in the top right.
2. Paste your **Bot Token**.
3. Click **Auto-Detect Chat ID** (the app will instantly find your channel).
4. Click **Save & Connect**.
5. 🎉 **You're ready!** Drag and drop any files or folders to start uploading.

---

## 🌉 Google Drive & Colab Bridge (Optional)

Need to backup large files from your Google Drive to Telegram without downloading them to your PC?

Unlim Clout includes a high-speed cloud transfer worker powered by Docker and Google Colab:
1. Ensure **Docker Desktop** is running on your PC.
2. Click the **Google Drive toggle** in the header.
3. Follow the guided 3-step wizard to authenticate your Google Account and mount Google Drive (`/content/drive/MyDrive`).
4. Click **"Upload Folder from Cloud"** to transfer entire Drive folders directly to Telegram at high datacenter speeds!

---

## 🗺️ Roadmap & Planned Features

We have ambitious plans for upcoming releases:
- [x] Basic file and folder uploads to Telegram
- [x] Automatic chunking for files > 2GB
- [x] Google Drive FUSE mount and Colab automated transfers
- [x] JSON database backup and restore system
- [ ] Concurrent multi-threaded file uploads & downloads
- [ ] In-app media player (stream video/audio without full download)
- [ ] End-to-end AES-256 client-side encryption option
- [ ] macOS and Linux desktop builds
- [ ] Mobile companion client (Android / iOS)

---

## 🤝 Contributing

**We welcome and appreciate all contributions!** 

Whether you want to fix a bug, improve the user interface, implement one of the upcoming roadmap features, or write documentation:

1. **Fork the Repository** on GitHub.
2. **Clone your fork locally**:
   ```bash
   git clone https://github.com/<your-username>/unlim-clout.git
   cd unlim-clout
   ```
3. **Install Dependencies**:
   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd ../backend
   pip install -r requirements-build.txt
   ```
4. **Run in Development Mode**:
   ```bash
   # In root folder
   npm run tauri dev
   ```
5. **Create a branch**, commit your improvements, and submit a **Pull Request**!

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Desktop Shell** | [Tauri v2](https://v2.tauri.app/) (Rust) |
| **Frontend UI** | [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TailwindCSS](https://tailwindcss.com/), [Lucide Icons](https://lucide.dev/) |
| **Local Backend** | [Python 3.12](https://www.python.org/), [FastAPI](https://fastapi.tiangolo.com/), [Pyrogram](https://docs.pyrogram.org/), SQLite |
| **Cloud Bridge** | [Docker](https://www.docker.com/), Google Colab CLI, Google Drive FUSE |
| **CI/CD** | GitHub Actions (automated `.exe` & `.msi` builds) |

---

## 📄 License & Disclaimer

- **License**: Released under the [MIT License](LICENSE).
- **Disclaimer**: This application utilizes Telegram's public Bot API and MTProto client for personal file storage. Please adhere to [Telegram's Terms of Service](https://telegram.org/tos) and do not use this software for unauthorized distribution of copyrighted material.
