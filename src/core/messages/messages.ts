import { ethers } from "ethers";

import { getConfig, ConfigOpts } from "../../config";
import { HexString } from "types/Strings";
import { MissingSigner } from "../utilities/errors";
import { sortObject } from "../utilities/json";

/**
 * DSNPType: an enum representing different types of DSNP messages
 */
export enum DSNPType {
  GraphChange = 1,
  Broadcast = 2,
  Reply = 3,
  Reaction = 4,
  Profile = 5,
}

/**
 * DSNPMessage: a message intended for inclusion in a batch file
 */
export interface DSNPMessage {
  dsnpType: DSNPType;
}

/**
 * BroadcastMessage: a DSNP message of type Broadcast
 */
export interface BroadcastMessage extends DSNPMessage {
  dsnpType: DSNPType.Broadcast;
  contentHash: string;
  fromId: string;
  uri: string;
}

/**
 * createBroadcastMessage() generates a broadcast message from a given URI and
 * hash.
 *
 * @param   fromId The id of the user from whom the message is posted
 * @param   uri    The URI of the activity pub content to reference
 * @param   hash   The hash of the content at the URI
 * @returns        A BroadcastMessage
 */
export const createBroadcastMessage = (fromId: string, uri: string, hash: HexString): BroadcastMessage => ({
  dsnpType: DSNPType.Broadcast,
  contentHash: hash,
  fromId,
  uri,
});

/**
 * ReplyMessage: a DSNP message of type Reply
 */
export interface ReplyMessage extends DSNPMessage {
  dsnpType: DSNPType.Reply;
  contentHash: HexString;
  fromId: string;
  inReplyTo: string;
  uri: string;
}

/**
 * createReplyMessage() generates a reply message from a given URI, hash and
 * message identifier.
 *
 * @param   fromId    The id of the user from whom the message is posted
 * @param   uri       The URI of the activity pub content to reference
 * @param   hash      The hash of the content at the URI
 * @param   inReplyTo The message id of the parent message
 * @returns           A ReplyMessage
 */
export const createReplyMessage = (fromId: string, uri: string, hash: HexString, inReplyTo: string): ReplyMessage => ({
  dsnpType: DSNPType.Reply,
  contentHash: hash,
  fromId,
  inReplyTo,
  uri,
});

/**
 * ReactionMessage: a DSNP message of type Reaction
 */
export interface ReactionMessage extends DSNPMessage {
  dsnpType: DSNPType.Reaction;
  emoji: string;
  fromId: string;
  inReplyTo: string;
}

/**
 * createReactionMessage() generates a reply message from a given URI, hash and
 * message identifier.
 *
 * @param   fromId    The id of the user from whom the message is posted
 * @param   emoji     The emoji to respond with
 * @param   inReplyTo The message id of the parent message
 * @returns           A ReactionMessage
 */
export const createReactionMessage = (fromId: string, emoji: string, inReplyTo: string): ReactionMessage => ({
  dsnpType: DSNPType.Reaction,
  emoji,
  fromId,
  inReplyTo,
});

const serialize = (message: DSNPMessage): string => {
  const sortedMessage = sortObject((message as unknown) as Record<string, unknown>);
  let serialization = "";

  for (const key in sortedMessage) {
    serialization = `${serialization}${key}${sortedMessage[key]}`;
  }

  return serialization;
};

/**
 * sign() takes a DSNP message and returns a Uint8Array signature for the
 * message using the Signer provided in the configuration options.
 *
 * @throws {@link MissingSigner}
 * This error is thrown if no Signer is defined in the configuration options.
 *
 * @param message The DSNP message to sign
 * @param opts    Optional. Configuration overrides, such as from address, if any
 * @returns       The message signature in hex
 */
export const sign = async (message: DSNPMessage, opts?: ConfigOpts): Promise<HexString> => {
  const { signer } = await getConfig(opts);
  if (!signer) throw MissingSigner;
  return signer.signMessage(serialize(message));
};

/**
 * recoverPublicKey() takes a DSNP message and a message signature and returns
 * the corresponding public key for validation.
 *
 * @param message   The DSNP message to sign
 * @param signature The message signature to validate
 * @returns         The address of the signer in hex
 */
export const recoverPublicKey = (message: DSNPMessage, signature: HexString): HexString => {
  return ethers.utils.verifyMessage(serialize(message), signature);
};
