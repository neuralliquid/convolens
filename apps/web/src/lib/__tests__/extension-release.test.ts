import {
  getExtensionDownloadUrl,
  getExtensionReleaseTag,
  getExtensionVersion,
} from "../extension-release";
import extensionManifest from "../../../../chrome-extension/manifest.json";

describe("extension release links", () => {
  it("matches the packaged Chrome extension version", () => {
    expect(getExtensionVersion()).toBe(extensionManifest.version);
    expect(getExtensionReleaseTag()).toBe(
      `extension-v${extensionManifest.version}`,
    );
    expect(getExtensionDownloadUrl()).toBe(
      `https://github.com/neuralliquid/convolens/releases/download/extension-v${extensionManifest.version}/convolens-extension.zip`,
    );
  });
});
