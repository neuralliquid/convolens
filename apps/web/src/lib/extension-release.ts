import extensionManifest from "../../../chrome-extension/manifest.json";

const GITHUB_RELEASES = "https://github.com/neuralliquid/convolens/releases";

export function getExtensionVersion(): string {
  return extensionManifest.version;
}

export function getExtensionReleaseTag(): string {
  return `extension-v${getExtensionVersion()}`;
}

export function getExtensionReleaseUrl(): string {
  return `${GITHUB_RELEASES}/tag/${getExtensionReleaseTag()}`;
}

export function getExtensionDownloadUrl(): string {
  return `${GITHUB_RELEASES}/download/${getExtensionReleaseTag()}/convolens-extension.zip`;
}

export function getFirefoxExtensionDownloadUrl(): string {
  return `${GITHUB_RELEASES}/download/${getExtensionReleaseTag()}/convolens-extension-firefox.zip`;
}
