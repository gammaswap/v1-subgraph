## Subgraph Deployment Instructions

<p>Subgraph must have already been created in https://thegraph.com under the GammaSwap Labs account</p>

1. Run "yarn prepare:arbitrum"
2. Run "yarn codegen"
3. Run "yarn build:arbitrum" (optional, only to see if there are any compilation errors)
4. Run "graph auth --product hosted-service 'ACCESS_TOKEN'" (get ACCESS_TOKEN from https://thegraph.com)
5. Run "yarn deploy"