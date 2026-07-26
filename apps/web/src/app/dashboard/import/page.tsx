"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chrome, ExternalLink, FileText, ShieldCheck } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState("file");

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
    maxSizeMB: 10,
    acceptedTypes: ["text/plain"],
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Import Chat</h1>
        <p className="text-muted-foreground mb-8">
          Choose a WhatsApp text export or the browser extension. Additional
          import options are planned as the preview expands.
        </p>

        <Tabs
          defaultValue="file"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 max-w-md mb-8">
            <TabsTrigger value="file">Chat export (.txt)</TabsTrigger>
            <TabsTrigger value="whatsapp">Browser extension</TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <Card>
              <CardHeader>
                <CardTitle>Upload Chat Export</CardTitle>
                <CardDescription>
                  Select a WhatsApp text export without media.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onFileUpload={uploadFile}
                  acceptedFormats={[".txt"]}
                  maxSizeMB={10}
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
                    <div className="mt-4 flex gap-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        The browser extension is available to private-preview
                        participants.
                      </p>
                    </div>
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
