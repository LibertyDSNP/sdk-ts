import { HexString } from "../../types/Strings";
import { keccak256 } from "js-sha3";
import * as types from "../../types/typechain";
import { ethers } from "ethers";
import { JsonFragment } from "@ethersproject/abi";

const DSNP_MIGRATION_TYPE = "DSNPMigration(address,string)";

export const getKeccakTopic = (topic: string): HexString => "0x" + keccak256(topic);

type RawLog = { topics: Array<string>; data: string };

const EVENTS_ABI = new ethers.utils.Interface(
  [
    types.Publisher__factory,
    types.BeaconFactory__factory,
    types.Identity__factory,
    types.Migrations__factory,
    types.Registry__factory,
  ]
    // eslint-disable-next-line id-length
    .reduce((m, f) => m.concat(f.abi as Array<JsonFragment>), [] as Array<JsonFragment>)
    .filter((ef) => ef.type === "event") as Array<JsonFragment>
);

interface ContractResult {
  contractAddr: string;
  contractName: string;
  blockNumber: number;
  blockHash: string;
}

export interface VmError {
  body?: string;
  error?: {
    body?: string;
  };
}

export const DSNP_MIGRATION_ABI: ethers.utils.ParamType[] = [
  ethers.utils.ParamType.fromObject({
    indexed: false,
    baseType: "address",
    name: "contractAddr",
    type: "address",
  }),
  ethers.utils.ParamType.fromObject({
    indexed: false,
    baseType: "string",
    name: "contractName",
    type: "string",
  }),
];

const decodeReturnValues = (inputs: ethers.utils.ParamType[], logs: ethers.providers.Log[]): ContractResult[] => {
  const decoder = new ethers.utils.AbiCoder();
  return logs.map((log: ethers.providers.Log) => {
    const { contractAddr, contractName } = decoder.decode(inputs, log.data);

    return {
      contractAddr: contractAddr,
      contractName: contractName,
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
    };
  });
};

const filterValues = (values: ContractResult[], contractName: string): ContractResult[] => {
  return values.filter((result: ContractResult) => {
    return result.contractName == contractName;
  });
};

/**
 * getContractAddress() uses DSNP Migrations to retrieve the most recently deployed contract address
 *
 * @param provider - initialized provider
 * @param contractName - Name of contract to find address for
 * @returns HexString A hexadecimal string representing the contract address
 */
export const getContractAddress = async (
  provider: ethers.providers.Provider,
  contractName: string
): Promise<HexString | null> => {
  const topic = getKeccakTopic(DSNP_MIGRATION_TYPE);

  const logs: ethers.providers.Log[] = await provider.getLogs({
    topics: [topic],
    fromBlock: 0,
  });
  const decodedValues = decodeReturnValues(DSNP_MIGRATION_ABI, logs);
  const filteredResults = filterValues(decodedValues, contractName);
  return filteredResults.length > 0 ? filteredResults[filteredResults.length - 1].contractAddr : null;
};

/**
 * Get the JSON RPC error from the body, if one exists
 *
 * @param e - The error expected to have a vm Error
 * @returns the error if any
 */
export const getVmError = (e: VmError): string | undefined => {
  try {
    if (e.body) {
      const parsed = JSON.parse(e.body);
      return parsed?.error?.message;
    }
    if (e.error?.body) {
      const parsed = JSON.parse(e.error.body);
      return parsed?.error?.message;
    }
  } catch (e) {
    return undefined;
  }
  return undefined;
};

/**
 * Parse all transaction logs.
 * This requires that all contracts involved in processing the transaction be included in EVENTS_ABI.
 *
 * @param logs - raw logs from a transaction
 * @returns parsed logs excluding any logs that cannot be parsed by the interface.
 * @throws error if a log is unparsable. This is probably because the event's ABI has not been added to EVENTS_ABI.
 */
export const parseLogs = (logs: Array<RawLog>): Array<ethers.utils.LogDescription> => {
  return logs.map((log) => EVENTS_ABI.parseLog(log)) as Array<ethers.utils.LogDescription>;
};

/**
 * Find event with given name.
 *
 * @param name - name of event to find.
 * @param logs - raw logs from a transaction
 * @returns First event in log that matches name
 * @throws error if no matching events were found
 * @throws error if a log is unparsable. This is probably because the event's ABI has not been added to EVENTS_ABI.
 */
export const findEvent = (name: string, logs: Array<RawLog>): ethers.utils.LogDescription => {
  const event = parseLogs(logs).find((e) => e.name === name);
  if (event === undefined) {
    throw `no ${name} logs found`;
  }
  return event;
};
