# Tooling for haex-vault that nixpkgs does not provide as a ready package: the e2e drivers, the
# Android SDK with its NDK, and the emulator the Android e2e runs use. Delivered to the consumer repo by `com.github.haexmas.atoms.haex-vault` and
# read by `nix-devshell-base`'s `flake.nix`: a function from `pkgs` to a list of derivations for the
# devShell.
pkgs:
let
  # The WebDriver bridge Tauri ships for end-to-end tests; it is not in nixpkgs. Built from the
  # crates.io release, so a version bump changes `version` and both hashes together.
  tauri-driver = pkgs.rustPlatform.buildRustPackage rec {
    pname = "tauri-driver";
    version = "2.0.6";
    src = pkgs.fetchCrate {
      inherit pname version;
      hash = "sha256-fTCkEs4NLBW0khaHL4jpVNkrbQg22YPsRMjfJNqnCWA=";
    };
    cargoHash = "sha256-MThAcU+U8PyBGauh3dy7ZRvRX9INmOEeghIlQEGLAPs=";
    # Its tests drive a real browser driver.
    doCheck = false;
  };

  # Only the driver binary of webkitgtk, never the library. The app links the host's
  # webkit2gtk-4.1 (see the haex-vault molecule's README), and putting `webkitgtk_4_1` itself into the
  # devShell would put its `lib/` on LD_LIBRARY_PATH and its `.pc` files on PKG_CONFIG_PATH and
  # push the host's WebKit aside. The driver speaks WebKit's automation protocol to the app, so it
  # has to be the same version as the host's WebKit: the `version` file lets a runner check that.
  webkit-webdriver = pkgs.runCommand "webkit-webdriver-${pkgs.webkitgtk_4_1.version}" { } ''
    mkdir -p $out/bin $out/share/webkit-webdriver
    ln -s ${pkgs.webkitgtk_4_1}/bin/WebKitWebDriver $out/bin/WebKitWebDriver
    echo ${pkgs.webkitgtk_4_1.version} > $out/share/webkit-webdriver/version
  '';

  # The Android SDK for `tauri android init/build`: one platform, the build tools Gradle asks for,
  # the platform tools and one NDK; the emulator is a separate SDK below. Adopting this molecule
  # accepts the Android SDK license, as `sdkmanager --licenses` would.
  ndkVersion = "28.2.13676358";
  androidenv = pkgs.androidenv.override { licenseAccepted = true; };
  android = androidenv.composeAndroidPackages {
    # What the Android project of Tauri 2.12 asks for: `compileSdk = 37` for the app, 36 for
    # Tauri's own Android library (`:tauri-android`), and the build tools of its Android Gradle
    # plugin (9.3).
    platformVersions = [ "36" "37.0" ];
    buildToolsVersions = [ "36.0.0" "37.0.0" ];
    includeNDK = true;
    ndkVersions = [ ndkVersion ];
    includeEmulator = false;
    includeSystemImages = false;
    includeSources = false;
  };
  androidSdk = android.androidsdk;

  # The variables the Tauri CLI and Gradle read, set when the devShell starts (a setup hook of a
  # shell package is sourced by `nix develop`).
  android-env = pkgs.makeSetupHook { name = "haex-android-env"; } (
    pkgs.writeText "haex-android-env.sh" ''
      export ANDROID_HOME=${androidSdk}/libexec/android-sdk
      export ANDROID_SDK_ROOT="$ANDROID_HOME"
      export NDK_HOME="$ANDROID_HOME/ndk/${ndkVersion}"
      export ANDROID_NDK_ROOT="$NDK_HOME"
      export ANDROID_NDK="$NDK_HOME"
      export JAVA_HOME=${pkgs.jdk17.home}
    ''
  );

  # The local relay must use the same release as haex-vault's Cargo.lock. nixpkgs can lag behind that
  # release, and the relay's CLI/configuration is part of the e2e contract.
  iroh-relay = pkgs.rustPlatform.buildRustPackage rec {
    pname = "iroh-relay";
    version = "1.3.0";
    src = pkgs.fetchFromGitHub {
      owner = "n0-computer";
      repo = "iroh";
      rev = "v${version}";
      hash = "sha256-ugGYRESccGgkI8evd21NE3jzNgULDEHwuf0UWdqKp6A=";
    };
    cargoHash = "sha256-L0OnbXUC8JNW+/Xm0Q/8EjSlGmKYGvQQM+SqrRLb8mQ=";
    buildFeatures = [ "server" ];
    cargoBuildFlags = [ "--bin" "iroh-relay" ];
    nativeBuildInputs = [ pkgs.lld ];
    doCheck = false;
  };

  # androidenv provides the SDK for x86_64 Linux and macOS hosts only.
  androidHost =
    (pkgs.stdenv.hostPlatform.isLinux && pkgs.stdenv.hostPlatform.isx86_64)
    || pkgs.stdenv.hostPlatform.isDarwin;

  # The emulator haex-vault's Android e2e suite runs on, the one its CI starts: API 35, `google_apis`,
  # x86_64, 4 cores. A separate SDK, because androidenv takes the system images of every platform
  # it composes, and the build SDK above has two others; only `haex-emulator` sees it.
  emulatorSdk =
    (androidenv.composeAndroidPackages {
      platformVersions = [ "35" ];
      buildToolsVersions = [ ];
      includeEmulator = true;
      includeSystemImages = true;
      systemImageTypes = [ "google_apis" ];
      abiVersions = [ "x86_64" ];
      includeSources = false;
      includeNDK = false;
      includeCmake = false;
    }).androidsdk;

  # Creates the AVD `haex-api35` the way the CI's emulator action does, once, and starts it. Extra
  # arguments go to the emulator (`-no-window` for a run without a window, `-wipe-data` for a
  # fresh phone). adb sees it as `emulator-5554`, the `ANDROID_SERIAL` the e2e runner reads.
  haex-emulator = pkgs.writeShellApplication {
    name = "haex-emulator";
    runtimeInputs = [ emulatorSdk ];
    text = ''
      export ANDROID_HOME=${emulatorSdk}/libexec/android-sdk
      export ANDROID_SDK_ROOT="$ANDROID_HOME"
      avd=haex-api35
      avd_home="''${ANDROID_AVD_HOME:-''${ANDROID_USER_HOME:-$HOME/.android}/avd}"
      if [ ! -f "$avd_home/$avd.avd/config.ini" ]; then
        echo no | avdmanager create avd --force --name "$avd" --abi google_apis/x86_64 \
          --package 'system-images;android-35;google_apis;x86_64'
        echo 'hw.cpu.ncore=4' >>"$avd_home/$avd.avd/config.ini"
      fi
      exec emulator -avd "$avd" -gpu swiftshader_indirect -noaudio -no-boot-anim \
        -camera-back none "$@"
    '';
  };

  # chromedriver drives the app's web view on the emulator, and only a chromedriver of the web
  # view's major version can: the one the system image above ships (124). From Chrome for
  # Testing, linux64 only; a new system image with another web view changes `version` and `hash`
  # (the e2e runner's preflight names the mismatch).
  chromedriver = pkgs.stdenv.mkDerivation rec {
    pname = "chromedriver-android";
    version = "124.0.6367.207";
    src = pkgs.fetchzip {
      url = "https://storage.googleapis.com/chrome-for-testing-public/${version}/linux64/chromedriver-linux64.zip";
      hash = "sha256-7yzKAiJA0SLXxinKo4rZDP5Il651F28G89GNI6uyBug=";
    };
    nativeBuildInputs = [ pkgs.autoPatchelfHook ];
    buildInputs = [
      pkgs.glib
      pkgs.nss
      pkgs.nspr
      pkgs.libxcb
    ];
    installPhase = "install -Dm755 chromedriver $out/bin/chromedriver";
  };
  emulatorHost = pkgs.stdenv.hostPlatform.isLinux && pkgs.stdenv.hostPlatform.isx86_64;

  # llama.cpp's CUDA build (haex-vault feature `llm-llamacpp-cuda`, spec 070 R1) links cudart and cuBLAS
  # statically, so the app needs only the NVIDIA driver at run time. `llama-cpp-sys-2` looks for the
  # static libraries in `$CUDA_LIBRARY_PATH/lib64`; nixpkgs' toolkit has no `lib64` and keeps static
  # cuBLAS in a separate output, so this directory gathers them. The same toolkit as `cudatoolkit` in
  # the package fragment, and only where that one exists.
  cudaHost = pkgs.stdenv.hostPlatform.isLinux && pkgs.stdenv.hostPlatform.isx86_64;
  cudaStatic = pkgs.runCommand "haex-cuda-static" { } ''
    mkdir -p $out/lib64
    ln -s ${pkgs.cudatoolkit}/include $out/include
    ln -s ${pkgs.cudatoolkit}/lib/libcudart_static.a ${pkgs.cudatoolkit}/lib/libculibos.a \
      ${pkgs.cudatoolkit}/lib/stubs $out/lib64/
    ln -s ${pkgs.cudaPackages.libcublas.static}/lib/libcublas_static.a \
      ${pkgs.cudaPackages.libcublas.static}/lib/libcublasLt_static.a $out/lib64/
  '';
  cuda-env = pkgs.makeSetupHook { name = "haex-cuda-env"; } (
    pkgs.writeText "haex-cuda-env.sh" ''
      export CUDA_LIBRARY_PATH=${cudaStatic}
    ''
  );
in
# WebKitGTK and Xvfb are Linux-only; the other platforms have their own drivers.
pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux [ tauri-driver webkit-webdriver ]
++ pkgs.lib.optionals androidHost [ androidSdk android-env ]
++ pkgs.lib.optionals emulatorHost [ haex-emulator chromedriver ]
++ pkgs.lib.optionals cudaHost [ cuda-env ]
++ [ iroh-relay ]
