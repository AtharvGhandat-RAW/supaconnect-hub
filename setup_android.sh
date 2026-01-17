
#!/bin/bash
set -e

# info
echo "Setting up Android SDK..."

# directories
export CMD_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
export ANDROID_HOME="/workspaces/supaconnect-hub/android-sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"

# download
echo "Downloading command line tools..."
wget -q "$CMD_TOOLS_URL" -O cmdline-tools.zip
unzip -q cmdline-tools.zip -d "$ANDROID_HOME/cmdline-tools"
mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
rm cmdline-tools.zip

# set path
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# install sdk
echo "Installing SDK packages..."
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "platform-tools" "platforms;android-36" "build-tools;36.0.0-rc1"

# create local.properties
echo "sdk.dir=$ANDROID_HOME" > /workspaces/supaconnect-hub/android/local.properties

echo "Android SDK setup complete."
