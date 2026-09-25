const hre = require('hardhat');

async function main() {
  const InstitutionRegistry = await hre.ethers.getContractFactory('InstitutionRegistry');
  const institutionRegistry = await InstitutionRegistry.deploy();
  await institutionRegistry.waitForDeployment();

  const CredentialRegistry = await hre.ethers.getContractFactory('CredentialRegistry');
  const credentialRegistry = await CredentialRegistry.deploy(await institutionRegistry.getAddress());
  await credentialRegistry.waitForDeployment();

  console.log('InstitutionRegistry:', await institutionRegistry.getAddress());
  console.log('CredentialRegistry:', await credentialRegistry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
