---
name: testflight
description: Build the Aria iOS app on EAS and submit it to TestFlight from this Mac. Use when the user asks to ship, release, build for TestFlight, "push a new build", or "run the build commands". Syncs the branch, then runs `eas build --platform ios --auto-submit` non-interactively so no prompts need answering.
allowed-tools: Bash(git status:*), Bash(git fetch:*), Bash(git reset:*), Bash(git log:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(eas build:*), Bash(eas whoami:*), Bash(eas --version:*), Bash(which eas:*)
---

# Ship Aria to TestFlight

Runs the two commands the user uses for every release, from the project root, without stopping for questions.

```bash
git fetch origin && git reset --hard origin/claude/blissful-bohr-bt1krl
eas build --platform ios --auto-submit
```

## How the questions are answered

`eas build` normally asks things interactively (log in to Apple? reuse the distribution certificate? which
App Store Connect app?). A non-interactive run can't type answers, so the answers are configured in advance
and the build runs with `--non-interactive`:

| EAS would ask | Answer, already configured |
|---|---|
| Expo account | the logged-in `eas whoami` account (doritlz) |
| Bundle identifier | `com.arya.piano` (app.json) |
| Distribution certificate / provisioning profile | reuse the ones stored on EAS (created by earlier builds) |
| Build number | incremented remotely (`appVersionSource: remote`, `autoIncrement`) |
| Which App Store Connect app to submit to | `ascAppId` 6816935719 (eas.json → submit.production.ios) |
| Apple sign-in for the submission | the App Store Connect API key stored on EAS from the first submission |

Never pass answers on the command line that the user hasn't given, and never use `--force`/`--clear-cache`
unless asked.

## Steps

1. **Check you're in the Aria project.** `git rev-parse --show-toplevel` must contain `app.json` with
   `"bundleIdentifier": "com.arya.piano"`. If not, stop and ask where the project is.

2. **Protect local work before resetting.** Run `git status --porcelain`.
   - Untracked files only → fine: `git reset --hard` doesn't touch them. Mention them.
   - Modified or staged tracked files → **stop**. `git reset --hard` would erase them. Show the list and ask
     whether to discard them or let the user commit and push first. Don't decide for them.

3. **Sync to the branch:**
   ```bash
   git fetch origin && git reset --hard origin/claude/blissful-bohr-bt1krl
   ```
   Report the commit it landed on (`git log --oneline -1`).

4. **Check EAS is ready:** `which eas` (the user runs EAS as the global `eas` command — don't switch to
   `npx eas-cli`) and `eas whoami`. If not logged in, stop: ask the user to run `eas login` themselves,
   since it needs their password.

5. **Build and submit:**
   ```bash
   eas build --platform ios --auto-submit --non-interactive --no-wait
   ```
   `--no-wait` returns as soon as the build is queued; the build (~15–25 min) and the TestFlight submission
   continue on EAS's servers. Give the user the build URL from the output
   (`https://expo.dev/accounts/doritlz/projects/aria/builds/…`) and say TestFlight usually shows it 5–15
   minutes after the build finishes.

## If it fails

- **"Credentials are not set up" / "distribution certificate" errors** — the stored credentials are missing
  or expired. Non-interactive mode can't create them. Tell the user to run once, interactively:
  `eas build --platform ios --auto-submit` and answer **Yes** to "Log in to your Apple account?" and
  **Yes** to reusing/generating the certificate and profile. After that, this skill works again.
- **Submission asks for Apple credentials / "ascApiKey" missing** — the App Store Connect API key isn't
  stored on EAS. Have the user run `eas credentials --platform ios` → App Store Connect API key → set up
  (interactive, once), or submit the finished build interactively with `eas submit --platform ios --latest`.
- **Install or Xcode errors in the build log** — open the build URL, find the red step, and copy the lines
  starting with `error:` back to the conversation that maintains the app; don't retry blindly.
- **Network/proxy errors** — retry the `eas build` command once; if it fails again, report the error.
