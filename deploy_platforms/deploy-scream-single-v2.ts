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
const want = web3.utils.toChecksumAddress("0x2A651563C9d3Af67aE0388a5c8F89b867038089e"); // Add the LP address.
const tombchef = web3.utils.toChecksumAddress("0xcc0a87F7e7c693042a9Cc703661F5060c80ACb43");
const shouldVerifyOnEtherscan = true;

const vaultParams = {
  mooName: "Scream FRAX TokenX", // Update the mooName.
  mooSymbol: "tokenXScreamFRAX", // Update the mooSymbol.
  delay: 3600,
};

const strategyParams = {
  borrowRate: 1,
  borrowRateMax: 75,
  borrowDepth: 1,
  minLeverage: ethers.BigNumber.from("1000000000000000"),
  outputToNativeRoute: [
    web3.utils.toChecksumAddress("0xe0654c8e6fd4d733349ac7e09f6f23da256bf475"),
    web3.utils.toChecksumAddress("0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83"),
  ],
  nativeToBridge: [
    web3.utils.toChecksumAddress("0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83"),
    web3.utils.toChecksumAddress("0xaf319e5789945197e365e7f7fbfc56b130523b33"),
  ],
  markets: [web3.utils.toChecksumAddress("0x4E6854EA84884330207fB557D1555961D85Fc17E")],

  unirouter: "0xf491e7b69e4244ad4002bc14e878a34207e38c29",
  unirouter2: "0x16327e3fbdaca3bcf7e38f5af2599d2ddc33ae52",
  strategist: accounts.strategist,
  // strategist: "0x6755b6F2067C65ca17C908789834FCdA2714A455", // Add your public address.

  // keeper: beefyfinance.keeper,
  // keeper: "0xa18Ac306483f95a1185Eb34e1B12Cf47BaaA1d01",
  keeper: accounts.keeper,

  // beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  // liquidCFeeRecipient: "0xF5c9f26BD744BE85b55B3cE8e44817A3a3C1A7cE",
  liquidCFeeRecipient: accounts.liquidCFeeRecipient,
};

const contractNames = {
  vault: "LiquidCVaultV6", // Add the vault name which will be deployed.
  strategy: "StrategyScreamV2", // Add the strategy name which will be deployed along with the vault.
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
    strategyParams.borrowRate,
    strategyParams.borrowRateMax,
    strategyParams.borrowDepth,
    strategyParams.minLeverage,
    strategyParams.outputToNativeRoute,
    strategyParams.nativeToBridge,
    strategyParams.markets,
    vault.address,
    strategyParams.unirouter,
    strategyParams.unirouter2,
    strategyParams.keeper,
    strategyParams.strategist,
    strategyParams.liquidCFeeRecipient,
  ];
  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();
  console.log(contractNames.strategy, "is now deployed");

  // add this info to PR
  console.log();
  console.log("Vault:", vault.address);
  console.log("Strategy:", strategy.address);
  // console.log("Want:", strategyParams.want);
  // console.log("PoolId:", strategyParams.poolId);

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
