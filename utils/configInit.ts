import dotenv from "dotenv";
dotenv.config();

import { BigNumber, ethers } from "ethers";
import { HardhatNetworkAccountUserConfig } from "hardhat/src/types/config";

export const startingEtherPerAccount = ethers.utils.parseUnits(BigNumber.from(1_000_000_000).toString(), "ether");

export const getPKs = () => {
  let deployerAccount, keeperAccount, upgraderAccount, rewarderAccount;

  // PKs without `0x` prefix
  if (process.env.DEPLOYER_PK) deployerAccount = process.env.DEPLOYER_PK;
  if (process.env.KEEPER_PK) keeperAccount = process.env.KEEPER_PK;
  if (process.env.UPGRADER_PK) upgraderAccount = process.env.UPGRADER_PK;
  if (process.env.REWARDER_PK) rewarderAccount = process.env.REWARDER_PK;

  const accounts = [deployerAccount, keeperAccount, upgraderAccount, rewarderAccount].filter(pk => !!pk) as string[];
  return accounts;
};

export const getPlatformAccounts = () => {
  let strategist, keeper, liquidCFeeRecipient;

  if (process.env.FEE_RECEPIENT) liquidCFeeRecipient = process.env.FEE_RECEPIENT;
  if (process.env.KEEPER) keeper = process.env.KEEPER;
  if (process.env.STRATEGIST) strategist = process.env.STRATEGIST;

  const accounts = { strategist, keeper, liquidCFeeRecipient };
  return accounts;
};

export const buildHardhatNetworkAccounts = (accounts: string[]) => {
  
  const hardhatAccounts = accounts.map(pk => {
    // hardhat network wants 0x prefix in front of PK
    const accountConfig: HardhatNetworkAccountUserConfig = {
      privateKey: pk,
      balance: startingEtherPerAccount.toString(),
    };
    return accountConfig;
  });
  return hardhatAccounts;
};
