import { serialize } from "./serialization";
import { createBroadcast } from "./announcementTypes";

describe("serialization", () => {
  describe("#serialize", () => {
    it("returns the correct serialization for a given announcement", async () => {
      const announcement = createBroadcast("1", "https://dsnp.org", "0x12345");
      const serializeAnnouncement = await serialize(announcement);

      expect(serializeAnnouncement).toEqual("contentHash0x12345dsnpType2fromId1urlhttps://dsnp.org");
    });
  });
});
