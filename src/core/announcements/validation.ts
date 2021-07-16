import fetch from "cross-fetch";
import { keccak256 } from "js-sha3";

import {
  isActivityContentHash,
  isActivityContentAudio,
  isActivityContentImage,
  isActivityContentVideo,
  isValidActivityContent,
  ActivityContentAudio,
  ActivityContentImage,
  ActivityContentVideo,
} from "../activityContent";
import { ConfigOpts } from "../../config";
import { Permission } from "../contracts/identity";
import { isSignatureAuthorizedTo } from "../contracts/registry";
import { SignedAnnouncement } from "./crypto";
import {
  Announcement,
  DSNPGraphChangeType,
  DSNPType,
  GraphChangeAnnouncement,
  BroadcastAnnouncement,
  ReplyAnnouncement,
  ReactionAnnouncement,
  ProfileAnnouncement,
} from "./factories";
import { isDSNPUserId, isDSNPAnnouncementId } from "../identifiers";
import { convertSignedAnnouncementToAnnouncement } from "./utilities";
import { isRecord, isString, isNumber } from "../utilities/validation";

const isValidEmoji = (obj: unknown): boolean => {
  if (!isString(obj)) return false;
  for (let i = 0; i < obj.length; i++) {
    const charCode = obj.charCodeAt(i);
    if (
      !(charCode >= 8192 && charCode <= 11263) &&
      !(charCode >= 57344 && charCode <= 65535) &&
      !(charCode >= 126976 && charCode <= 1114111)
    )
      return false;
  }
  return true;
};

/**
 * isGraphChangeType() is a type check for DSNPGraphChangeType
 *
 * @param obj - The object to check
 * @returns True if the object is a DSNPGraphChangeType, otherwise false
 */
const isGraphChangeType = (obj: unknown): obj is DSNPGraphChangeType => {
  if (!isNumber(obj)) return false;
  return obj == DSNPGraphChangeType.Follow || obj == DSNPGraphChangeType.Unfollow;
};

/**
 * isAnnouncementType() is a type check for DSNPType
 *
 * @param obj - The object to check
 * @returns True if the object is a DSNPType, otherwise false
 */
const isAnnouncementType = (obj: unknown): obj is DSNPType => {
  if (!isNumber(obj)) return false;
  return (
    obj == DSNPType.GraphChange ||
    obj == DSNPType.Broadcast ||
    obj == DSNPType.Reply ||
    obj == DSNPType.Reaction ||
    obj == DSNPType.Profile
  );
};

/**
 * isGraphChangeAnnouncement() is a type check for GraphChangeAnnouncement
 *
 * @param obj - The object to check
 * @returns True if the object is a GraphChangeAnnouncement, otherwise false
 */
const isGraphChangeAnnouncement = (obj: unknown): obj is GraphChangeAnnouncement => {
  if (!isRecord(obj)) return false;
  if (obj["dsnpType"] != DSNPType.GraphChange) return false;
  if (!isDSNPUserId(obj["fromId"])) return false;
  if (!isGraphChangeType(obj["changeType"])) return false;
  if (!isDSNPUserId(obj["objectId"])) return false;

  return true;
};

/**
 * isBroadcastAnnouncement() is a type check for BroadcastAnnouncement
 *
 * @param obj - The object to check
 * @returns True if the object is a BroadcastAnnouncement, otherwise false
 */
const isBroadcastAnnouncement = (obj: unknown): obj is BroadcastAnnouncement => {
  if (!isRecord(obj)) return false;
  if (obj["dsnpType"] != DSNPType.Broadcast) return false;
  if (!isDSNPUserId(obj["fromId"])) return false;
  if (!isString(obj["url"])) return false;
  if (!isString(obj["contentHash"])) return false;

  return true;
};

/**
 * isReplyAnnouncement() is a type check for ReplyAnnouncement
 *
 * @param obj - The object to check
 * @returns True if the object is a ReplyAnnouncement, otherwise false
 */
const isReplyAnnouncement = (obj: unknown): obj is ReplyAnnouncement => {
  if (!isRecord(obj)) return false;
  if (obj["dsnpType"] != DSNPType.Reply) return false;
  if (!isDSNPUserId(obj["fromId"])) return false;
  if (!isString(obj["url"])) return false;
  if (!isString(obj["contentHash"])) return false;
  if (!isDSNPAnnouncementId(obj["inReplyTo"])) return false;

  return true;
};

/**
 * isReactionAnnouncement() is a type check for ReactionAnnouncement
 *
 * @param obj - The object to check
 * @returns True if the object is a ReactionAnnouncement, otherwise false
 */
const isReactionAnnouncement = (obj: unknown): obj is ReactionAnnouncement => {
  if (!isRecord(obj)) return false;
  if (obj["dsnpType"] != DSNPType.Reaction) return false;
  if (!isDSNPUserId(obj["fromId"])) return false;
  if (!isValidEmoji(obj["emoji"])) return false;
  if (!isDSNPAnnouncementId(obj["inReplyTo"])) return false;

  return true;
};

/**
 * isProfileAnnouncement() is a type check for ProfileAnnouncement
 *
 * @param obj - The object to check
 * @returns True if the object is a ProfileAnnouncement, otherwise false
 */
const isProfileAnnouncement = (obj: unknown): obj is ProfileAnnouncement => {
  if (!isRecord(obj)) return false;
  if (obj["dsnpType"] != DSNPType.Profile) return false;
  if (!isDSNPUserId(obj["fromId"])) return false;
  if (!isString(obj["url"])) return false;
  if (!isString(obj["contentHash"])) return false;

  return true;
};

/**
 * isAnnouncement() is a type check for Announcement
 *
 * @param obj - The object to check
 * @returns True if the object is a Announcement, otherwise false
 */
const isAnnouncement = (obj: unknown): obj is Announcement => {
  if (!isRecord(obj)) return false;
  if (!isAnnouncementType(obj["dsnpType"])) return false;

  const validators = {
    [DSNPType.GraphChange]: isGraphChangeAnnouncement,
    [DSNPType.Broadcast]: isBroadcastAnnouncement,
    [DSNPType.Reply]: isReplyAnnouncement,
    [DSNPType.Reaction]: isReactionAnnouncement,
    [DSNPType.Profile]: isProfileAnnouncement,
  };

  return validators[obj["dsnpType"]](obj);
};

/**
 * isSignedAnnouncement() is a type check for SignedAnnouncements
 *
 * @param obj - The object to check
 * @returns True if the object is a SignedAnnouncement, otherwise false
 */
export const isSignedAnnouncement = (obj: unknown): obj is SignedAnnouncement => {
  if (!isRecord(obj)) return false;
  if (!isString(obj["signature"])) return false;
  return isAnnouncement(obj);
};

const validateKeccak256FileHash = async (
  activityContent: ActivityContentAudio | ActivityContentImage | ActivityContentVideo
): Promise<boolean> => {
  let keccakHash: string | null = null;
  if (Array.isArray(activityContent["hash"])) {
    for (const hash in activityContent["hash"]) {
      if (!isActivityContentHash(hash)) return false;
      if (hash["algorithm"] == "keccak256") keccakHash = hash["value"];
    }
  } else {
    if (!isActivityContentHash(activityContent["hash"])) return false;
    if (activityContent["hash"]["algorithm"] == "keccak256") keccakHash = activityContent["hash"]["value"];
  }

  if (keccakHash === null) return true;

  let fileUrl: string | null = null;
  if (typeof activityContent["url"] === "string") {
    fileUrl = activityContent["url"];
  } else {
    fileUrl = activityContent["url"]["href"];
  }

  const fileContents = await fetch(fileUrl).then((res) => res.text());
  return keccak256(fileContents) == keccakHash;
};

/**
 * isValidAnnouncement() validates an announcement and its associated content.
 *
 * @param obj - A signed announcement to validate
 * @param opts - Optional. Configuration overrides, such as from address, if any
 * @returns True if the announcement is valid, otherwise false
 */
export const isValidAnnouncement = async (obj: unknown, opts?: ConfigOpts): Promise<boolean> => {
  if (!isSignedAnnouncement(obj)) return false;

  if (
    !(await isSignatureAuthorizedTo(
      obj.signature,
      convertSignedAnnouncementToAnnouncement(obj),
      obj.fromId,
      Permission.ANNOUNCE,
      undefined,
      opts
    ))
  )
    return false;

  if (isBroadcastAnnouncement(obj) || isReplyAnnouncement(obj)) {
    const content = await fetch(obj["url"]).then((res) => res.text());
    if (keccak256(content) != obj["contentHash"]) return false;

    const activityContent = JSON.parse(content);
    if (!isValidActivityContent(activityContent)) return false;

    if (
      isActivityContentAudio(activityContent) ||
      isActivityContentImage(activityContent) ||
      isActivityContentVideo(activityContent)
    ) {
      if (!(await validateKeccak256FileHash(activityContent))) return false;
    }
  }

  return true;
};
