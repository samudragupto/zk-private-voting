import { http, createConfig } from "wagmi";
import { polygonAmoy } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

export const config = createConfig({
  chains: [polygonAmoy],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "ZK Private DAO Voting",
      },
    }),
    injected(),
  ],
  transports: {
    [polygonAmoy.id]: http(import.meta.env.VITE_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology"),
  },
});
