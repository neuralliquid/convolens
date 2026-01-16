'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
            <TabsTrigger value="whatsapp" disabled>
              WhatsApp Web (Coming Soon)
            </TabsTrigger>
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
                  Connect directly to WhatsApp Web to import your chats
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-center max-w-md">
                  <div className="bg-muted p-4 rounded-lg mb-6 inline-block">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
                  <p className="text-muted-foreground mb-4">
                    Direct WhatsApp Web integration is under development. For now, please use the file upload option.
                  </p>
                  <Button onClick={() => setActiveTab('file')}>
                    Go to File Upload
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
