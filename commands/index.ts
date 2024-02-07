import { exec, sed } from 'shelljs'
import { Command } from 'commander';
const { version } = require('../package.json')

const program = new Command();

program
  .command('prepare')
  .argument('<network>')
  .action(async (network: string) => 
  {
    exec(`mustache networks/${network}.json subgraph.template.yaml subgraph.${network}.yaml`);
    exec(`mustache networks/${network}.json src/helpers/constants.template.ts src/helpers/constants.ts`);

    const constantsFile = './src/helpers/constants.ts';
    sed('-i', 'VERSION_PLACEHOLDER', version, constantsFile);
  })

program
  .command('codegen')
  .argument('<network>')
  .action(async (network: string) => 
  {
    exec(`graph codegen subgraph.${network}.yaml --output-dir src/types/`);
  })

program
  .command('build')
  .argument('<network>')
  .action(async (network: string) => 
  {
    exec(`graph build subgraph.${network}.yaml`);
  })

program
  .command('deploy')
  .argument('<graph_uri>')
  .argument('<network>')
  .action(async (graph_uri: string, network: string) => 
  {
    /**
      "deploy:arbsepolia": "graph deploy --product hosted-service gammaswap/gammaswap-v1-arbsepolia subgraph.arbitrum-sepolia.yaml",
      "deploy:arbsepolia-dev": "graph deploy --product hosted-service gammaswap/gammaswap-v1-arbsepolia-dev subgraph.arbitrum-sepolia.yaml",
      "deploy:arbsepolia-oct23": "graph deploy --product hosted-service gammaswap/gammaswap-v1-arbsepolia-oct23 subgraph.arbitrum-sepolia-oct23.yaml",
      "deploy:arbitrum": "graph deploy --product hosted-service gammaswap/gammaswap-v1-arbitrum subgraph.arbitrum.yaml",
      "deploy:arbitrum-dev": "graph deploy --product hosted-service gammaswap/gammaswap-v1-arbitrum-dev subgraph.arbitrum.yaml",
      "deploy:arbitrum-oct23": "graph deploy --product hosted-service gammaswap/gammaswap-v1-arbitrum-oct23 subgraph.arbitrum-oct23.yaml",
      "deploy:sepolia": "graph deploy --product hosted-service gammaswap/gammaswap-v1-sepolia subgraph.sepolia.yaml",
      "deploy:sepolia-dev": "graph deploy --product hosted-service gammaswap/gammaswap-v1-sepolia-dev subgraph.sepolia.yaml",
      "deploy:dev": "graph deploy --product hosted-service gammaswap/gammaswap-dev subgraph.arbitrum-sepolia.yaml"
     */

    exec(`graph deploy --product hosted-service ${graph_uri} subgraph.${network}.yaml`);
  })

program.parse();
