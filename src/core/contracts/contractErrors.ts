import { DSNPUserId } from "../identifiers";
import { DSNPError } from "../errors";

/**
 * ContractError indicates that an error occurred in the contracts module.
 */
export class ContractError extends DSNPError {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

/**
 * MissingContractAddressError indicates that a contract address could not be
 * found either on the chain or in the configuration overrides.
 */
export class MissingContractAddressError extends ContractError {
  contractName: string;

  constructor(contractName: string) {
    super(`Could not find address for ${contractName} contract.`);
    this.name = "MissingContractAddressError";
    this.contractName = contractName;
  }
}

/**
 * MissingRegistrationContractError indicates that the registration for a given
 * DSNP User Id could not be found.
 */
export class MissingRegistrationContractError extends ContractError {
  dsnpUserId: DSNPUserId;

  constructor(dsnpUserId: DSNPUserId) {
    super(`Could not find registration for user id ${dsnpUserId}.`);
    this.name = "MissingRegistrationContractError";
    this.dsnpUserId = dsnpUserId;
  }
}

/**
 * NoLogsFoundContractError indicates that a log event could not be found.
 */
export class NoLogsFoundContractError extends ContractError {
  eventName: string;

  constructor(eventName: string) {
    super(`Could not find log event: ${eventName}.`);
    this.name = "NoLogsFoundContractError";
    this.eventName = eventName;
  }
}
