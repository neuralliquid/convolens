import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getExtensionDownloadUrl,
  getExtensionReleaseUrl,
  getExtensionVersion,
} from "@/lib/extension-release";

export interface ExtensionInstallInstructionsProps {
  heading?: string;
}

export function ExtensionInstallInstructions({
  heading = "Install the Chrome extension",
}: ExtensionInstallInstructionsProps) {
  const version = getExtensionVersion();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{heading}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Download ConvoLens v{version}, extract the ZIP into a new folder, then
          load that folder as an unpacked Chrome extension. If Chrome already
          has ConvoLens loaded, remove it first so it does not keep showing an
          older version. There is no Chrome Web Store listing yet.
        </p>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          Download and extract <code>convolens-extension.zip</code> into a new
          folder. Do not overwrite an older unpacked copy.
        </li>
        <li>
          Open <code>chrome://extensions</code> and turn on Developer mode.
        </li>
        <li>
          If ConvoLens is already listed, click <strong>Remove</strong>.
        </li>
        <li>
          Choose <strong>Load unpacked</strong> and select the extracted folder
          that contains <code>manifest.json</code>.
        </li>
        <li>
          Confirm the card shows v{version}. If it still shows an older version,
          click <strong>Reload</strong>.
        </li>
        <li>
          Sign in to ConvoLens, then open WhatsApp Web and send the chat you
          choose.
        </li>
      </ol>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="primary">
          <a href={getExtensionDownloadUrl()}>
            <Download className="mr-2 h-4 w-4" />
            Download extension v{version}
          </a>
        </Button>
        <Button asChild variant="outline">
          <a
            href={getExtensionReleaseUrl()}
            target="_blank"
            rel="noreferrer"
          >
            Release notes
          </a>
        </Button>
      </div>
    </div>
  );
}
