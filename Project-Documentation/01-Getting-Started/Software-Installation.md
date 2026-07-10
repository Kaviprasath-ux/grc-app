# Software Installation Guide

## Overview

This guide walks you through installing every tool you need to work on the **testgrc 2025** GRC application. Follow each section carefully, even if you have some of these tools already — version mismatches are a common cause of errors.

**Estimated time:** 45–90 minutes, depending on your internet speed.

**What we will install:**

| Tool | Why You Need It | Version Required |
|------|----------------|-----------------|
| Node.js | Runs the JavaScript/TypeScript application | 18.x or 20.x (LTS) |
| npm | Installs JavaScript packages | Comes with Node.js |
| Git | Version control — downloads and tracks code changes | 2.40+ |
| Visual Studio Code | Code editor with TypeScript support | Latest |
| Prisma CLI | Database toolkit (included in npm packages) | via npm |

---

## 1. Node.js

### What is Node.js?

Node.js is a runtime environment that lets your computer execute JavaScript (and TypeScript) code outside of a browser. The GRC application is built with **Next.js**, a React framework that runs on top of Node.js. Without Node.js, you cannot start the development server, install packages, or build the application.

Think of Node.js as the engine of a car — the application code is the car body, but nothing moves without the engine underneath.

### Which Version Do You Need?

This project requires **Node.js 18.x** or **Node.js 20.x** (both are Long-Term Support releases, meaning they receive security patches for several years). Do **not** install the "Current" release (odd-numbered versions like 21.x, 23.x) — those are experimental and may break the project.

---

### Installing Node.js on Windows

**Step 1 — Download the installer**

1. Open your web browser and go to: `https://nodejs.org`
2. You will see two large download buttons. Click the one labeled **"20.x.x LTS"** (the left button).
   - The file will be named something like `node-v20.x.x-x64.msi`.
   - It is approximately 30–35 MB.

**Step 2 — Run the installer**

1. Open your Downloads folder and double-click the `.msi` file.
2. If Windows asks "Do you want to allow this app to make changes to your device?", click **Yes**.
3. The Node.js Setup Wizard opens. Click **Next**.
4. Read the License Agreement and click **I accept the terms in the License Agreement**, then **Next**.
5. Keep the default installation directory (`C:\Program Files\nodejs\`). Click **Next**.
6. On the "Custom Setup" screen, leave all features selected. Click **Next**.
7. On the "Tools for Native Modules" screen, check the box that says **"Automatically install the necessary tools"**. This installs Chocolatey and build tools needed for some npm packages.
8. Click **Install**. The installation may take 2–5 minutes.
9. A separate terminal window may open to install the native build tools — let it finish completely before closing it.
10. Click **Finish** to close the wizard.

**Step 3 — Verify the installation**

1. Press **Windows Key + R**, type `cmd`, and press Enter to open Command Prompt.
   - Alternatively, right-click the Start button and select **Terminal** or **Windows PowerShell**.
2. Type the following and press Enter:
   ```
   node --version
   ```
3. You should see output like `v20.18.0` (the exact patch number may differ).
4. Now verify npm (Node Package Manager):
   ```
   npm --version
   ```
5. You should see something like `10.8.2`.

If you see version numbers, Node.js is installed correctly. If you see an error like `'node' is not recognized as an internal or external command`, restart your computer and try again.

---

### Installing Node.js on macOS

**Step 1 — Download the installer**

1. Go to `https://nodejs.org` in your browser.
2. Click the **"20.x.x LTS"** download button.
3. Select the **macOS Installer (.pkg)** for your chip type:
   - If you have an M1, M2, or M3 Mac (Apple Silicon): choose `node-v20.x.x-arm64.pkg`
   - If you have an older Intel Mac: choose `node-v20.x.x-x64.pkg`
   - Not sure which chip you have? Click the Apple logo in the top-left corner, then "About This Mac". Look for "Chip" or "Processor".

**Step 2 — Run the installer**

1. Open your Downloads folder and double-click the `.pkg` file.
2. Click **Continue** through the welcome screen.
3. Agree to the license agreement.
4. Click **Install**. You may be asked for your macOS password.
5. The installation takes 1–3 minutes. Click **Close** when done.

**Step 3 — Verify the installation**

1. Open the Terminal application (press **Command + Space**, type "Terminal", press Enter).
2. Run:
   ```bash
   node --version
   npm --version
   ```
3. Both commands should print version numbers.

---

### Installing Node.js on Linux (Ubuntu/Debian)

The recommended approach on Linux is to use the **NodeSource repository**, which gives you the correct version with easy updates.

**Step 1 — Open a terminal and run these commands one at a time:**

```bash
# Update your package list
sudo apt-get update

# Install curl (needed to download the NodeSource setup script)
sudo apt-get install -y curl

# Add the NodeSource repository for Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs
```

**Step 2 — Verify:**
```bash
node --version
npm --version
```

---

### Common Node.js Installation Errors

**Error: "node is not recognized" after installation (Windows)**
- Cause: The system PATH was not updated yet.
- Fix: Restart your computer. If the error persists, search Windows for "Environment Variables", open "System Properties" > "Advanced" > "Environment Variables", find `Path` in "System variables", click Edit, and verify that `C:\Program Files\nodejs\` is listed.

**Error: "EACCES: permission denied" when running npm install (macOS/Linux)**
- Cause: npm is trying to write to a folder owned by root.
- Fix: Never use `sudo npm install`. Instead, fix npm's directory permissions:
  ```bash
  mkdir ~/.npm-global
  npm config set prefix '~/.npm-global'
  export PATH=~/.npm-global/bin:$PATH
  ```
  Add the `export` line to your `~/.bashrc` or `~/.zshrc` file so it persists.

**Error: "The engine 'node' is incompatible with this module"**
- Cause: Your Node.js version is too old or too new.
- Fix: Install the correct LTS version. If you have multiple Node.js versions, use **nvm** (Node Version Manager) to switch between them.

---

## 2. Git

### What is Git?

Git is a **version control system**. It tracks every change made to the codebase, allows multiple developers to work simultaneously, and lets you download ("clone") the project from a remote server (GitHub, in this case) to your local machine.

Without Git, you cannot download the project code.

---

### Installing Git on Windows

**Step 1 — Download Git for Windows**

1. Go to `https://git-scm.com/download/win`
2. The download should start automatically for the 64-bit installer. If not, click the **64-bit Git for Windows Setup** link.
3. The file will be named something like `Git-2.x.x-64-bit.exe`.

**Step 2 — Run the installer**

The Git installer has many screens. Here is what to select on each important screen:

- **Select Components**: Leave all defaults checked. Make sure "Git Bash Here" and "Git GUI Here" are checked (they are by default).
- **Choosing the default editor used by Git**: Select **Visual Studio Code** from the dropdown if you have it installed, or leave as **Vim** if you prefer the terminal editor.
- **Adjusting the name of the initial branch in new repositories**: Select **"Override the default branch name for new repositories"** and type `main`.
- **Adjusting your PATH environment**: Select **"Git from the command line and also from 3rd-party software"** (the recommended option — middle choice).
- **Choosing the SSH executable**: Leave as **"Use bundled OpenSSH"**.
- **Choosing HTTPS transport backend**: Leave as **"Use the OpenSSL library"**.
- **Configuring the line ending conversions**: Select **"Checkout Windows-style, commit Unix-style line endings"** (recommended for Windows).
- **Configuring the terminal emulator**: Select **"Use MinTTY"**.
- Leave all remaining screens at their defaults and click **Install**.

**Step 3 — Verify**

Open a new Command Prompt or PowerShell window and run:
```
git --version
```
You should see `git version 2.x.x.windows.x`.

---

### Installing Git on macOS

macOS includes a very old version of Git by default. Install the latest version using Homebrew.

**Step 1 — Install Homebrew (if you don't have it)**

Homebrew is a package manager for macOS. Open Terminal and run:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Follow the prompts. You will need to enter your macOS password.

**Step 2 — Install Git**
```bash
brew install git
```

**Step 3 — Verify**
```bash
git --version
```

---

### Installing Git on Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y git
git --version
```

---

### Configuring Git (All Platforms)

After installing Git, you must tell it your name and email address. This information is attached to every commit you make.

Open a terminal and run these two commands, replacing the placeholders with your actual information:

```bash
git config --global user.name "Your Full Name"
git config --global user.email "your.email@example.com"
```

Verify your configuration:
```bash
git config --list
```

You should see `user.name` and `user.email` in the output.

---

## 3. Visual Studio Code

### What is VS Code?

Visual Studio Code (VS Code) is a free, open-source code editor made by Microsoft. It has excellent support for TypeScript, React, and Next.js. It also integrates with Git, has a built-in terminal, and supports thousands of extensions.

You can use any code editor you prefer, but this guide is written for VS Code.

---

### Installing VS Code on Windows

**Step 1 — Download**
1. Go to `https://code.visualstudio.com`
2. Click the large **Download for Windows** button.
3. The file will be named `VSCodeUserSetup-x64-x.x.x.exe`.

**Step 2 — Install**
1. Run the downloaded file.
2. Accept the license agreement.
3. On the "Select Additional Tasks" screen, check ALL of the following options:
   - "Add 'Open with Code' action to Windows Explorer file context menu"
   - "Add 'Open with Code' action to Windows Explorer directory context menu"
   - "Register Code as an editor for supported file types"
   - "Add to PATH (requires shell restart)"
4. Click **Install**, then **Finish**.

**Step 3 — Verify**
Open a new terminal and run:
```
code --version
```

---

### Installing VS Code on macOS

1. Go to `https://code.visualstudio.com`
2. Click **Download Mac Universal** (works on both Intel and Apple Silicon).
3. The file downloads as a `.zip`. Double-click it to extract.
4. Drag **Visual Studio Code.app** to your **Applications** folder.
5. Open VS Code from Applications.
6. To add the `code` command to your terminal: Press **Command + Shift + P**, type "Shell Command", and select **"Shell Command: Install 'code' command in PATH"**.

---

### Installing VS Code on Linux (Ubuntu/Debian)

```bash
# Download and add the Microsoft GPG key
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -D -o root -g root -m 644 packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg

# Add the VS Code repository
sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'

# Install VS Code
sudo apt-get update
sudo apt-get install -y code
```

---

### Recommended VS Code Extensions

After installing VS Code, install these extensions to improve your development experience. For each extension:

1. Open VS Code.
2. Press **Ctrl + Shift + X** (Windows/Linux) or **Command + Shift + X** (macOS) to open the Extensions panel.
3. Type the extension name in the search box.
4. Click **Install**.

---

**Extension 1: ESLint** (`dbaeumer.vscode-eslint`)

**Why you need it:** ESLint is a tool that analyzes your code for problems as you type. It highlights errors and style issues with red or yellow underlines before you even run the code. The GRC project has ESLint configured with specific rules — this extension shows those violations directly in the editor.

---

**Extension 2: Prettier — Code Formatter** (`esbenp.prettier-vscode`)

**Why you need it:** Prettier automatically formats your code (adds proper indentation, line breaks, semicolons) when you save a file. This ensures everyone on the team writes consistently formatted code regardless of personal preferences.

After installing, configure Prettier as the default formatter:
1. Press **Ctrl + Shift + P** (or **Command + Shift + P** on Mac).
2. Type "Open User Settings (JSON)" and press Enter.
3. Add these lines inside the curly braces:
   ```json
   "editor.defaultFormatter": "esbenp.prettier-vscode",
   "editor.formatOnSave": true
   ```

---

**Extension 3: Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)

**Why you need it:** The GRC application uses Tailwind CSS for styling. This extension provides autocomplete suggestions for Tailwind class names (like `flex`, `p-4`, `text-red-500`) and shows a preview of what each class does. Without it, you have to memorize or look up Tailwind classes manually.

---

**Extension 4: Prisma** (`Prisma.prisma`)

**Why you need it:** The project uses Prisma for database management. The Prisma schema file (`prisma/schema.prisma`) is written in Prisma's own language. This extension adds syntax highlighting, autocomplete, and formatting for `.prisma` files, making it much easier to edit the database schema.

---

**Extension 5: GitLens — Git supercharged** (`eamodio.gitlens`)

**Why you need it:** GitLens enhances VS Code's built-in Git support. It shows who wrote each line of code (git blame), makes it easy to compare versions, and provides a visual history of changes. Essential for team collaboration.

---

**Extension 6: Auto Rename Tag** (`formulahendry.auto-rename-tag`)

**Why you need it:** In React/JSX files (`.tsx`), HTML-like tags always come in pairs (`<div>` and `</div>`). When you rename the opening tag, this extension automatically renames the closing tag. Saves time and prevents common mistakes.

---

**Extension 7: Path Intellisense** (`christian-kohler.path-intellisense`)

**Why you need it:** When writing `import` statements in TypeScript, this extension autocompletes file paths. Instead of typing `../../components/ui/Button`, it suggests the correct path as you type.

---

**Extension 8: DotENV** (`mikestead.dotenv`)

**Why you need it:** The project uses `.env.local` files to store configuration. This extension adds syntax highlighting to `.env` files, making them easier to read.

---

### VS Code Workspace Settings

The GRC project includes a `.vscode` folder with recommended workspace settings. When you open the project folder in VS Code, it may prompt you to **"Install Recommended Extensions"** — click that button to install all project-recommended extensions at once.

---

## 4. Verifying Your Complete Setup

Once you have installed Node.js, npm, and Git, run these commands in a single terminal session to confirm everything is ready:

```bash
node --version
# Expected: v18.x.x or v20.x.x

npm --version
# Expected: 9.x.x or 10.x.x

git --version
# Expected: git version 2.x.x

code --version
# Expected: 1.x.x (or similar)
```

All four commands should print version numbers without any error messages.

---

## 5. Optional but Recommended: nvm (Node Version Manager)

If you work on multiple Node.js projects that require different versions, install **nvm**. It lets you switch between Node.js versions with a single command.

**On Windows:** Download `nvm-windows` from `https://github.com/coreybutler/nvm-windows/releases`. Download `nvm-setup.exe` and run it. Then use:
```
nvm install 20
nvm use 20
```

**On macOS/Linux:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# Restart terminal, then:
nvm install 20
nvm use 20
```

---

## 6. Summary Checklist

Before moving to the next guide (Local Setup), confirm:

- [ ] `node --version` prints `v18.x.x` or `v20.x.x`
- [ ] `npm --version` prints a version number
- [ ] `git --version` prints a version number
- [ ] Git is configured with your name and email (`git config --list`)
- [ ] VS Code is installed and the `code` command works in the terminal
- [ ] VS Code extensions are installed (ESLint, Prettier, Tailwind CSS IntelliSense, Prisma)

Once all items are checked, proceed to the **Local Setup** guide.
