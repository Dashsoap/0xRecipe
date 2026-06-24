"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, createConfig, WagmiProvider } from "wagmi";

import { injectiveTestnet } from "@/lib/chain";

const wagmiConfig = createConfig({
  chains: [injectiveTestnet],
  transports: {
    [injectiveTestnet.id]: http(),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  // One QueryClient per browser session.
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
