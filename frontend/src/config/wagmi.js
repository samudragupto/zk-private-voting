import { http, createConfig } from "wagmi";
import { polygonMumbai, polygonAmoy } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [polygonMumbai, polygonAmoy],
  connectors: [injected()],
  transports: {
    [polygonMumbai.id]: http("https://rpc-mumbai.maticvigil.com"),
    [polygonAmoy.id]: http("https://rpc-amoy.polygon.technology"),
  },
});
