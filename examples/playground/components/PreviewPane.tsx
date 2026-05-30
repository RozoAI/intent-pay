"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

interface PreviewPaneProps {
  preview: ReactNode;
  code: ReactNode;
}

export function PreviewPane({ preview, code }: PreviewPaneProps) {
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
        <div className="rounded-xl border border-border overflow-hidden">
          {code ?? (
            <p className="text-sm text-muted-foreground p-6">
              Fill in the configuration to generate code.
            </p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
