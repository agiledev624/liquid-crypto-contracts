import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../utils/predictAddresses";
import { setCorrectCallFee } from "../utils/setCorrectCallFee";
import { setPendingRewardsFunctionName } from "../utils/setPendingRewardsFunctionName";
import { verifyContract } from "../utils/verifyContract";
import { getPlatformAccounts } from "../utils/configInit";

const registerSubsidy = require("../utils/registerSubsidy");

const {
  platforms: { spookyswap },
  tokens: {
    TSHARE: { address: TSHARE },
    FTM: { address: FTM },
    TOMB: { address: TOMB },
  },
} = addressBook.fantom;

const accounts = getPlatformAccounts();

const IDIA = web3.utils.toChecksumAddress("0x0b15Ddf19D47E6a86A56148fb4aFFFc6929BcB89");
const want = web3.utils.toChecksumAddress("0xa4aa24b8e855052071df60e174219e6c8fee45a3"); // Add the LP address.
const tombchef = web3.utils.toChecksumAddress("0x42b652a523367e7407fb4bf2fa1f430781e7db8c");
const unirouter = web3.utils.toChecksumAddress("0x145863eb42cf62847a6ca784e6416c1682b1b2ae");
const shouldVerifyOnEtherscan = false;

const vaultParams = {
  mooName: "Dark DARK-CRO TokenX", // Update the mooName.
  mooSymbol: "tokenXDarkDARK-CRO", // Update the mooSymbol.
  delay: 3600,
};

const strategyParams = {
  want,
  poolId: 0, // Add the LP id.
  chef: tombchef,
  unirouter: unirouter,
  strategist: accounts.strategist,
  // strategist: "0x6755b6F2067C65ca17C908789834FCdA2714A455", // Add your public address.

  // keeper: beefyfinance.keeper,
  // keeper: "0xa18Ac306483f95a1185Eb34e1B12Cf47BaaA1d01",
  keeper: accounts.keeper,

  // beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  // liquidCFeeRecipient: "0xF5c9f26BD744BE85b55B3cE8e44817A3a3C1A7cE",
  liquidCFeeRecipient: accounts.liquidCFeeRecipient,
  outputToNativeRoute: ["0x9d3bbb0e988d9fb2d55d07fe471be2266ad9c81c", "0x5c7f8a570d578ed84e63fdfa7b1ee72deae1ae23"], // Add the route to convert from the reward token to the native token.
  outputToLp0Route: ["0x9d3bbb0e988d9fb2d55d07fe471be2266ad9c81c", "0x5c7f8a570d578ed84e63fdfa7b1ee72deae1ae23"], // Add the route to convert your reward token to token0.
  outputToLp1Route: [
    "0x9d3bbb0e988d9fb2d55d07fe471be2266ad9c81c",
    "0x5c7f8a570d578ed84e63fdfa7b1ee72deae1ae23",
    "0x83b2ac8642ae46fc2823bc959ffeb3c1742c48b5",
  ], // Add the route to convert your reward token to token1.
  pendingRewardsFunctionName: "pendingReward", // used for rewardsAvailable(), use correct function name from masterchef
};

const contractNames = {
  vault: "LiquidCVaultV6", // Add the vault name which will be deployed.
  strategy: "StrategyCommonChefLP", // Add the strategy name which will be deployed along with the vault.
};

async function main() {
  if (
    Object.values(vaultParams).some(v => v === undefined) ||
    Object.values(strategyParams).some(v => v === undefined) ||
    Object.values(contractNames).some(v => v === undefined)
  ) {
    console.error("one of config values undefined");
    return;
  }

  await hardhat.run("compile");

  const Vault = await ethers.getContractFactory(contractNames.vault);
  const Strategy = await ethers.getContractFactory(contractNames.strategy);

  const [deployer] = await ethers.getSigners();
  const predictedAddresses = await predictAddresses({ creator: deployer.address });
  console.log("Deploying:", vaultParams.mooName);
  const vaultConstructorArguments = [
    predictedAddresses.strategy,
    vaultParams.mooName,
    vaultParams.mooSymbol,
    vaultParams.delay,
  ];
  const vault = await Vault.deploy(...vaultConstructorArguments);
  await vault.deployed();
  console.log(vaultParams.mooName, "is now deployed");

  console.log("Deploying:", contractNames.strategy);
  const strategyConstructorArguments = [
    strategyParams.want,
    strategyParams.poolId,
    strategyParams.chef,
    vault.address,
    strategyParams.unirouter,
    strategyParams.keeper,
    strategyParams.strategist,
    strategyParams.liquidCFeeRecipient,
    strategyParams.outputToNativeRoute,
    strategyParams.outputToLp0Route,
    strategyParams.outputToLp1Route,
  ];
  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();
  console.log(contractNames.strategy, "is now deployed");

  // add this info to PR
  console.log();
  console.log("Vault:", vault.address);
  console.log("Strategy:", strategy.address);
  console.log("Want:", strategyParams.want);
  console.log("PoolId:", strategyParams.poolId);

  console.log();
  console.log("Running post deployment");

  const verifyContractsPromises: Promise<any>[] = [];
  if (shouldVerifyOnEtherscan) {
    // skip await as this is a long running operation, and you can do other stuff to prepare vault while this finishes
    verifyContractsPromises.push(
      verifyContract(vault.address, vaultConstructorArguments),
      verifyContract(strategy.address, strategyConstructorArguments)
    );
  }
  // await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
  // await setCorrectCallFee(strategy, hardhat.network.name);
  console.log();

  await Promise.all(verifyContractsPromises);

  if (hardhat.network.name === "bsc") {
    await registerSubsidy(vault.address, deployer);
    await registerSubsidy(strategy.address, deployer);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
