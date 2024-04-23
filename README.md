## Subgraph Deployment Instructions

<p>Subgraph must have already been created in https://thegraph.com under the GammaSwap Labs account</p>
**IMPORTANT** Use all lowercase addresses in config json files

1. Run "yarn prepare arbitrum"
2. Run "yarn codegen arbitrum"
3. Run "yarn build arbitrum" (optional, only to see if there are any compilation errors)
4. Run "graph auth --product hosted-service 'ACCESS_TOKEN'" (get ACCESS_TOKEN from https://thegraph.com)
5. Run "yarn deploy:arbitrum"

*If authenticating to studio run the following

graph auth --studio 'ACCESS_TOKEN'

*The deployment script for base mainnet uses launch instead of the deploy command to deploy to graph studio

### Process for updating Arbitrum Subgraph

After confident changes in test environments are safe in the subgraph and UI (e.g. arbitrumSepolia), do the following
in order making sure each step is successful

1. Update gammaswap-v1-arbitrum-dev
2. Test main branch of UI against gammaswap-v1-arbitrum-dev
3. Deploy to gammaswap-v1-arbitrum