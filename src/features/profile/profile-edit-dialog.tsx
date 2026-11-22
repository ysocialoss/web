import type { ReactNode } from "react";
import { Link2, Paintbrush, UserRound } from "lucide-react";
import { ComingSoonContent } from "@/components/coming-soon-content";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProfileEditDialogContent({
  children,
  paint,
  saving,
}: {
  children: ReactNode;
  paint?: ReactNode;
  saving: boolean;
}) {
  return (
    <DialogContent
      className="max-h-[90dvh] gap-5 overflow-y-auto overscroll-contain px-5 pt-6 pb-5 sm:max-w-lg sm:px-6"
      showCloseButton={!saving}
    >
      <DialogHeader className="pr-10">
        <DialogTitle className="text-lg font-semibold">
          Edit profile
        </DialogTitle>
      </DialogHeader>
      <Tabs defaultValue="profile" className="min-w-0 gap-5">
        <TabsList aria-label="Edit profile sections" className="w-full">
          <TabsTrigger value="profile" disabled={saving}>
            <UserRound aria-hidden="true" />
            Profile
          </TabsTrigger>
          {paint && (
            <TabsTrigger value="paint" disabled={saving}>
              <Paintbrush aria-hidden="true" />
              Paint
            </TabsTrigger>
          )}
          <TabsTrigger value="connections" disabled={saving}>
            <Link2 aria-hidden="true" />
            Connections
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile" keepMounted className="inert:hidden">
          {children}
        </TabsContent>
        {paint && (
          <TabsContent value="paint" className="inert:hidden">
            {paint}
          </TabsContent>
        )}
        <TabsContent value="connections" className="inert:hidden">
          <ComingSoonContent title="Connections" />
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}
