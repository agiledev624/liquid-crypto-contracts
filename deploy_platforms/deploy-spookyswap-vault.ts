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
    USDC: { address: USDC },
    BOO: { address: BOO },
    MAI: { address: MAI },
    TUSD: { address: TUSD },
    WETH: { address: WETH },
    TREEB: { address: TREEB },
    YFI: { address: YFI },
    wsHEC: { address: wsHEC },
  },
} = addressBook.fantom;

const accounts = getPlatformAccounts();

const want = web3.utils.toChecksumAddress("0xd343b8361ce32a9e570c1fc8d4244d32848df88b"); // Add the LP address.
const shouldVerifyOnEtherscan = true;

const vaultParams = {
  mooName: "Boo USDC-DEI TokenX", // Update the mooName.
  mooSymbol: "tokenXBooUSDC-DEI", // Update the mooSymbol.
  delay: 3600,
};

const strategyParams = {
  want,
  poolId: 1, // Add the LP id.
  chef: "0x18b4f774fdc7bf685daeef66c2990b1ddd9ea6ad",
  unirouter: "0xf491e7b69e4244ad4002bc14e878a34207e38c29",
  strategist: accounts.strategist,
  // strategist: "0x6755b6F2067C65ca17C908789834FCdA2714A455", // Add your public address.

  // keeper: beefyfinance.keeper,
  // keeper: "0xa18Ac306483f95a1185Eb34e1B12Cf47BaaA1d01",
  keeper: accounts.keeper,

  // beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  // liquidCFeeRecipient: "0xF5c9f26BD744BE85b55B3cE8e44817A3a3C1A7cE",
  liquidCFeeRecipient: accounts.liquidCFeeRecipient,
  secondToNative: ["0xde5ed76e7c05ec5e4572cfc88d1acea165109e44", "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83"],
  outputToNativeRoute: ["0x841fad6eae12c286d1fd18d1d525dffa75c7effe", "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83"], // Add the route to convert from the reward token to the native token.
  nativeToLp0: ["0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83", "0x04068da6c83afcfa0e13ba15a6696662335d5b75"], // Add the route to convert your reward token to token0.
  nativeToLp1: [
    "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83",
    "0x04068da6c83afcfa0e13ba15a6696662335d5b75",
    "0xde12c7959e1a72bbe8a5f7a1dc8f8eef9ab011b3",
  ], // Add the route to convert your reward token to token1.
  pendingRewardsFunctionName: "pendingBOO", // used for rewardsAvailable(), use correct function name from masterchef
};

const contractNames = {
  vault: "LiquidCVaultV6", // Add the vault name which will be deployed.
  strategy: "StrategySpookyV2LP", // Add the strategy name which will be deployed along with the vault.
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
    strategyParams.secondToNative,
    strategyParams.nativeToLp0,
    strategyParams.nativeToLp1,
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
