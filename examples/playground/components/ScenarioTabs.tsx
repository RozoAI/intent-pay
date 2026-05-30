"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BridgeMode } from "./BridgeMode";
import { CheckoutMode } from "./CheckoutMode";
import { DepositMode } from "./DepositMode";

export function ScenarioTabs() {
  return (
    <Tabs defaultValue="bridge" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="bridge">Bridge</TabsTrigger>
        <TabsTrigger value="checkout">Online Checkout</TabsTrigger>
        <TabsTrigger value="deposit">Wallet Deposit</TabsTrigger>
      </TabsList>
      <TabsContent value="bridge">
        <BridgeMode />
      </TabsContent>
      <TabsContent value="checkout">
        <CheckoutMode />
      </TabsContent>
      <TabsContent value="deposit">
        <DepositMode />
      </TabsContent>
    </Tabs>
  );
}
