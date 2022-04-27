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
const want = web3.utils.toChecksumAddress("0xcdfd91eea657cc2701117fe9711c9a4f61feed23"); // Add the LP address.
const tombchef = web3.utils.toChecksumAddress("0x188bed1968b795d5c9022f6a0bb5931ac4c18f00");
const shouldVerifyOnEtherscan = true;

const vaultParams = {
  mooName: "Joe PTP-AVAX TokenX", // Update the mooName.
  mooSymbol: "tokenXJoePTP-AVAX", // Update the mooSymbol.
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 28, // Add the LP id.
  chef: tombchef,
  unirouter: "0x60ae616a2155ee3d9a68541ba4544862310933d4",
  strategist: accounts.strategist,
  // strategist: "0x6755b6F2067C65ca17C908789834FCdA2714A455", // Add your public address.

  // keeper: beefyfinance.keeper,
  // keeper: "0xa18Ac306483f95a1185Eb34e1B12Cf47BaaA1d01",
  keeper: accounts.keeper,

  // beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  // liquidCFeeRecipient: "0xF5c9f26BD744BE85b55B3cE8e44817A3a3C1A7cE",
  liquidCFeeRecipient: accounts.liquidCFeeRecipient,
  outputToNativeRoute: ["0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd", "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"], // Add the route to convert from the reward token to the native token.
  secondToNativeRoute: ["0x22d4002028f537599be9f666d1c4fa138522f9c8", "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"],
  outputToLp0Route: ["0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", "0x22d4002028f537599be9f666d1c4fa138522f9c8"], // Add the route to convert your reward token to token0.
  outputToLp1Route: ["0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"], // Add the route to convert your reward token to token1.
  pendingRewardsFunctionName: "pendingCake", // used for rewardsAvailable(), use correct function name from masterchef
};

const contractNames = {
  vault: "LiquidCVaultV6", // Add the vault name which will be deployed.
  strategy: "StrategyTraderJoeDualNonNativeLP", // Add the strategy name which will be deployed along with the vault.
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
    strategyParams.secondToNativeRoute,
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
