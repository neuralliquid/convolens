"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chrome, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { ExtensionInstallInstructions } from "@/components/extension/install-instructions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FileUpload from "@/components/file-upload/FileUpload";
import { useFileUpload } from "@/hooks/useFileUpload";
import { toast } from "@/components/ui/toaster";

export default function ImportChatPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("whatsapp");
  const whatsappTabTriggerRef = useRef<HTMLButtonElement>(null);
  const focusWhatsappTabOnActivate = useRef(false);

  // Radix unmounts inactive TabsContent, so the "Use the browser extension
  // instead" button (which lives inside the file-export tab's content) is
  // removed from the DOM the moment it switches tabs, dropping keyboard
  // focus to the document body. Move focus to the newly active tab trigger
  // once the switch actually takes effect.
  useEffect(() => {
    if (activeTab === "whatsapp" && focusWhatsappTabOnActivate.current) {
      focusWhatsappTabOnActivate.current = false;
      whatsappTabTriggerRef.current?.focus();
    }
  }, [activeTab]);

  const jumpToExtensionTab = () => {
    focusWhatsappTabOnActivate.current = true;
    setActiveTab("whatsapp");
  };

  const { uploadFile } = useFileUpload("/api/chat-export/upload", {
    onSuccess: (result) => {
      toast({
        title: "Conversation received",
        description: result?.duplicate
          ? "This conversation was already in your workspace."
          : "Your WhatsApp export is now stored in your workspace.",
        variant: "default",
      });
      router.push(result?.data?.dashboardUrl || "/dashboard");
    },
    onError: (error) => {
      console.error("Upload error:", error);
    },
    // Mirrors the API's multer config in chat-export.routes.ts: 25MB cap,
    // .txt or .zip (WhatsApp's "Export chat" archive with attached media).
    // Extension entries (".txt"/".zip") are included alongside the MIME
    // types because browsers report .zip under empty or generic MIME types
    // in some environments — useFileUpload falls back to filename-suffix
    // matching for any entry starting with ".".
    maxSizeMB: 25,
    acceptedTypes: [
      "text/plain",
      "application/zip",
      "application/x-zip-compressed",
      "application/x-zip",
      ".txt",
      ".zip",
    ],
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Import Chat</h1>
        <p className="text-muted-foreground mb-3">
          Use the browser extension to send a chat straight from WhatsApp
          Web without exporting a file first. A plain-text export is also
          available if you prefer to upload a file.
        </p>
        <Badge variant="planned" className="mb-8">
          More import paths — planned
        </Badge>

        <Tabs
          defaultValue="whatsapp"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 max-w-md mb-8">
            <TabsTrigger
              ref={whatsappTabTriggerRef}
              value="whatsapp"
              className="gap-1.5"
            >
              Browser extension
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary">
                Recommended
              </span>
            </TabsTrigger>
            <TabsTrigger value="file">Chat export (.txt or .zip)</TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <Card>
              <CardHeader>
                <CardTitle>Upload Chat Export</CardTitle>
                <CardDescription>
                  Select a WhatsApp text export, or the full "Export chat"
                  .zip archive.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onFileUpload={uploadFile}
                  acceptedFormats={[".txt", ".zip"]}
                  maxSizeMB={25}
                />
                <div className="mt-6 text-sm text-muted-foreground">
                  <h4 className="font-medium mb-2">
                    How to export chats from WhatsApp:
                  </h4>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Open the WhatsApp chat you want to export</li>
                    <li>Tap on the three dots menu (⋮) in the top right</li>
                    <li>
                      Select &quot;More&quot; then &quot;Export chat&quot;
                    </li>
                    <li>
                      Choose &quot;Without media&quot; to reduce file size
                    </li>
                    <li>
                      Select your preferred sharing method and save the file
                    </li>
                  </ol>
                </div>
                <div className="mt-6 flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-950 dark:border-green-900 dark:bg-green-950/30 dark:text-green-100">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>
                    Review the file before uploading. Only choose a conversation
                    you have permission to send to ConvoLens.
                  </p>
                </div>
                <div className="mt-6 text-sm text-muted-foreground">
                  Prefer a live connection without manually exporting a file?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    onClick={jumpToExtensionTab}
                  >
                    Use the browser extension instead
                  </button>
                  .
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle>Connect WhatsApp Web</CardTitle>
                <CardDescription>
                  Use the ConvoLens extension to send only the chat you select.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4 md:col-span-2">
                    <div className="mb-3 flex items-center gap-2 font-medium">
                      <Chrome className="h-5 w-5 text-primary" />
                      Use the browser extension
                    </div>
                    <div className="mb-6">
                      <ExtensionInstallInstructions />
                    </div>
                    <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                      <li>Open WhatsApp Web and select a conversation.</li>
                      <li>
                        Open the ConvoLens toolbar icon and connect your
                        signed-in session.
                      </li>
                      <li>
                        Select <strong>Send Current Chat</strong> in the popup,
                        or <strong>Send to ConvoLens</strong> beside the chat.
                      </li>
                    </ol>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="primary">
                    <Link
                      href="https://web.whatsapp.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open WhatsApp Web
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("file")}
                  >
                    Use file upload
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
