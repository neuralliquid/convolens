"use client";

import { useState } from "react";
import { useAuth } from "@convolens/contexts";
import { PageHeader } from "@/components/ui/page-header";
import { StyledCard } from "@/components/ui/styled-card";
import { Badge } from "@/components/ui/badge";
import { DeleteAccountButton } from "@/components/settings/delete-account-button";
import PageWrapper from "../page-wrapper";
import { Settings, Bell, Shield, User, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  const { user } = useAuth();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  return (
    <PageWrapper>
      <PageHeader
        title="Settings"
        description="Manage your account preferences and settings"
      />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Shield className="h-4 w-4 mr-2" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="account">
            <User className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="grid gap-6">
            <StyledCard title="Theme" icon={<Moon className="h-6 w-6" />}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dark-mode">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable dark mode for the application
                    </p>
                  </div>
                  <Switch id="dark-mode" />
                </div>
              </div>
            </StyledCard>

            <StyledCard title="Language" icon={<Settings className="h-6 w-6" />}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Application Language</Label>
                    <p className="text-sm text-muted-foreground">
                      Select your preferred language
                    </p>
                  </div>
                  <select className="border rounded p-2">
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                  </select>
                </div>
              </div>
            </StyledCard>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <StyledCard title="Notification Settings" icon={<Bell className="h-6 w-6" />}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch 
                  id="email-notifications" 
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="push-notifications">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications in your browser
                  </p>
                </div>
                <Switch 
                  id="push-notifications" 
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
            </div>
          </StyledCard>
        </TabsContent>

        <TabsContent value="privacy">
          <StyledCard title="Privacy Settings" icon={<Shield className="h-6 w-6" />}>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="data-collection">Data Collection</Label>
                    <Badge variant="outline">Planned</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Anonymous usage data collection is not enabled today — this
                    toggle will control it once it ships.
                  </p>
                </div>
                <Switch id="data-collection" checked={false} disabled />
              </div>
              <p className="text-sm text-muted-foreground">
                ConvoLens does not log the content of your conversations in
                telemetry.
              </p>
            </div>
          </StyledCard>
        </TabsContent>

        <TabsContent value="account">
          <StyledCard title="Account Information" icon={<User className="h-6 w-6" />}>
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <p className="text-sm font-medium">{user?.email || 'example@email.com'}</p>
              </div>

              <div className="pt-4">
                <p className="mb-2 text-sm font-medium text-destructive">
                  Danger zone
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Deletes every conversation, message, and file you&apos;ve
                  imported into ConvoLens, then signs you out. This cannot be
                  undone.
                </p>
                <DeleteAccountButton />
              </div>
            </div>
          </StyledCard>
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
}