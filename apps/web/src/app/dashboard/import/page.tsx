'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Chrome, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FileUpload from '@/components/file-upload/FileUpload';
import { useFileUpload } from '@/hooks/useFileUpload';
import { toast } from '@/components/ui/toaster';

export default function ImportChatPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('file');
  
  const { uploadFile, isUploading } = useFileUpload('/api/chat-export/upload', {
    onSuccess: (data) => {
      console.log('Upload successful:', data);
      toast({
        title: 'Success',
        description: 'Chat export processed successfully!',
        variant: 'default',
      });
      // Redirect to chat view or dashboard
      router.push('/dashboard');
    },
    onError: (error) => {
      console.error('Upload error:', error);
    },
    maxSizeMB: 10,
    acceptedTypes: ['text/plain'],
  });

  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Import Chat</h1>
        <p className="text-muted-foreground mb-8">
          Upload a WhatsApp chat export to analyze and summarize your conversations.
        </p>

        <Tabs 
          defaultValue="file" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 max-w-md mb-8">
            <TabsTrigger value="file">File Upload</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp Web</TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <Card>
              <CardHeader>
                <CardTitle>Upload Chat Export</CardTitle>
                <CardDescription>
                  Upload a .txt file exported from WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload 
                  onFileUpload={uploadFile}
                  acceptedFormats={['.txt']}
                  maxSizeMB={10}
                />
                <div className="mt-6 text-sm text-muted-foreground">
                  <h4 className="font-medium mb-2">How to export chats from WhatsApp:</h4>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Open the WhatsApp chat you want to export</li>
                    <li>Tap on the three dots menu (⋮) in the top right</li>
                    <li>Select &quot;More&quot; then &quot;Export chat&quot;</li>
                    <li>Choose &quot;Without media&quot; to reduce file size</li>
                    <li>Select your preferred sharing method and save the file</li>
                  </ol>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    // Example file for testing
                    const blob = new Blob(
                      [
                        '[18/07/2023, 14:30] John: Hey, how are you?\n[18/07/2023, 14:32] Jane: I\'m good, thanks! How about you?\n[18/07/2023, 14:33] John: Doing well! Just wanted to check in.'
                      ],
                      { type: 'text/plain' }
                    );
                    const file = new File([blob], 'sample-chat.txt', { type: 'text/plain' });
                    uploadFile(file);
                  }}
                  disabled={isUploading}
                >
                  Try Sample File
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle>Connect WhatsApp Web</CardTitle>
                <CardDescription>
                  Use the ConvoLens browser extension to extract the open WhatsApp Web chat.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium">
                      <Chrome className="h-5 w-5 text-primary" />
                      Install
                    </div>
                    <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                      <li>Build the extension from <code>apps/chrome-extension</code>.</li>
                      <li>Open <code>chrome://extensions</code> and enable Developer mode.</li>
                      <li>Choose Load unpacked and select the extension folder.</li>
                    </ol>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center gap-2 font-medium">
                      <Settings className="h-5 w-5 text-primary" />
                      Configure
                    </div>
                    <dl className="space-y-2 text-sm text-muted-foreground">
                      <div>
                        <dt className="font-medium text-foreground">API endpoint</dt>
                        <dd className="break-all">https://nl-prod-convolens-api.calmmoss-612abacc.southafricanorth.azurecontainerapps.io</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Dashboard</dt>
                        <dd>https://convolens.neuralliquid.ai</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="primary">
                    <Link href="https://web.whatsapp.com" target="_blank" rel="noreferrer">
                      Open WhatsApp Web
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('file')}>
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
