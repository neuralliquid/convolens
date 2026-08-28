import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getExtensionDownloadUrl,
  getFirefoxExtensionDownloadUrl,
  getExtensionReleaseUrl,
  getExtensionVersion,
} from "@/lib/extension-release";

export interface ExtensionInstallInstructionsProps {
  browser?: "chrome" | "firefox";
  heading?: string;
}

export function ExtensionInstallInstructions({
  browser = "chrome",
  heading = "Install the Chrome extension",
}: ExtensionInstallInstructionsProps) {
  const version = getExtensionVersion();
  const isFirefox = browser === "firefox";
  const downloadUrl = isFirefox
    ? getFirefoxExtensionDownloadUrl()
    : getExtensionDownloadUrl();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{heading}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isFirefox ? (
            <>
              Firefox support is available for private-preview testing. This
              build is not Mozilla-signed yet, so Firefox removes the temporary
              installation when the browser restarts.
            </>
          ) : (
            <>
              Download ConvoLens v{version}, extract the ZIP into a new folder,
              then load that folder as an unpacked Chrome extension. If Chrome
              already has ConvoLens loaded, remove it first so it does not keep
              showing an older version. There is no Chrome Web Store listing
              yet.
            </>
          )}
        </p>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          Download and extract{" "}
          <code>
            {isFirefox
              ? "convolens-extension-firefox.zip"
              : "convolens-extension.zip"}
          </code>{" "}
          into a new folder. Do not overwrite an older unpacked copy.
        </li>
        {isFirefox ? (
          <>
            <li>
              Open <code>about:debugging#/runtime/this-firefox</code>.
            </li>
            <li>
              Choose <strong>Load Temporary Add-on</strong>, open the extracted
              folder, and select <code>manifest.json</code>.
            </li>
          </>
        ) : (
          <>
            <li>
              Open <code>chrome://extensions</code> and turn on Developer mode.
            </li>
            <li>
              If ConvoLens is already listed, click <strong>Remove</strong>.
            </li>
            <li>
              Choose <strong>Load unpacked</strong> and select the extracted
              folder that contains <code>manifest.json</code>.
            </li>
          </>
        )}
        <li>
          Confirm the card shows v{version}. If it still shows an older version,
          {isFirefox ? (
            <> remove the temporary add-on and load it again.</>
          ) : (
            <>
              {" "}
              click <strong>Reload</strong>.
            </>
          )}
        </li>
        <li>
          Sign in to ConvoLens, then open WhatsApp Web and send the chat you
          choose.
        </li>
      </ol>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="primary">
          <a href={downloadUrl}>
            <Download className="mr-2 h-4 w-4" />
            Download {isFirefox ? "Firefox" : "Chrome"} build v{version}
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={getExtensionReleaseUrl()} target="_blank" rel="noreferrer">
            Release notes
          </a>
        </Button>
      </div>
    </div>
  );
}
