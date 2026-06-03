"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

interface PreviewPaneProps {
  preview: ReactNode;
  code: ReactNode;
  emptyState?: ReactNode;
}

export function PreviewPane({ preview, code, emptyState }: PreviewPaneProps) {
  return (
    <Tabs defaultValue="preview" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="code">Code</TabsTrigger>
      </TabsList>
      <TabsContent value="preview">
        <div className="rounded-xl border border-border bg-card p-6 min-h-64">
          {preview}
        </div>
      </TabsContent>
      <TabsContent value="code">
        <div className="rounded-xl border border-border overflow-hidden min-h-64">
          {code ?? (
            emptyState ?? (
              <div className="flex flex-col items-center justify-center h-full min-h-64 gap-2 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Fill in the configuration to generate code.
                </p>
              </div>
            )
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
