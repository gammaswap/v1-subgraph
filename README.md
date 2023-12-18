## Subgraph Deployment Instructions

<p>Subgraph must have already been created in https://thegraph.com under the GammaSwap Labs account</p>

1. Run "yarn codegen"
2. Run "yarn build:arbitrum"
3. Run "yarn prepare:arbitrum"
4. Run "graph auth --product hosted-service 'ACCESS_TOKEN'" (get ACCESS_TOKEN from https://thegraph.com)
5. Run "yarn deploy"