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
    exec(`graph deploy --product hosted-service ${graph_uri} subgraph.${network}.yaml`);
  })

program
  .command('launch')
  .argument('<graph_uri>')
  .argument('<network>')
  .action(async (graph_uri: string, network: string) =>
  {
    exec(`graph deploy --studio ${graph_uri} subgraph.${network}.yaml`);
  })

program.parse();
