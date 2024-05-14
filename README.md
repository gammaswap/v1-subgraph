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

### Versioning

If only updating configurations, then bump to next minor version. If also updating subgraph source code, ABIs or yaml
templates, then bump to next major version

### Goldsky Commands

deploy a subgraph:

`goldsky subgraph deploy <nameAndVersion>`

delete a subgraph: 

`goldsky subgraph delete <nameAndVersion>`

update a subgraph:

`goldsky subgraph update <nameAndVersion>`

show logs of a subgraph:

`goldsky subgraph log <nameAndVersion>`

create a subgraph tag:

`goldsky subgraph tag create <nameAndVersion> --tag <tagName>`

delete a subgraph tag:

`goldsky subgraph tag delete <nameAndVersion> --tag <tagName>`

list subgraphs:

`goldsky subgraph list <nameAndVersion>`

Source: https://docs.goldsky.com/reference/cli
