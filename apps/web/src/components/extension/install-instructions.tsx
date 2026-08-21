import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getExtensionDownloadUrl,
  getExtensionReleaseUrl,
  getExtensionVersion,
} from "@/lib/extension-release";

export function ExtensionInstallInstructions({
  heading = "Install the Chrome extension",
}: {
  heading?: string;
}) {
  const version = getExtensionVersion();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{heading}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Download ConvoLens v{version}, extract the ZIP, then load the folder
          that contains <code>manifest.json</code> as an unpacked Chrome
          extension. There is no Chrome Web Store listing yet.
        </p>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Download and extract <code>convolens-extension.zip</code>.</li>
        <li>
          Open <code>chrome://extensions</code> and turn on Developer mode.
        </li>
        <li>
          Choose <strong>Load unpacked</strong> and select the extracted folder
          that contains <code>manifest.json</code>.
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
