import { describe, it, expect } from "vitest";
import {
  buildLockedFieldsDetails,
  lockedDeleteMessage,
  lockedUpdateMessage,
  integrityViolation,
} from "@/lib/data-integrity";

describe("Data Integrity & Cascading Lock Helpers", () => {
  it("builds locked field error details with standard error codes", () => {
    const details = buildLockedFieldsDetails(
      ["rollNumber", "classId"],
      "it has active examination records"
    );

    expect(details).toHaveLength(2);
    expect(details[0]).toEqual({
      field: "rollNumber",
      code: "locked",
      message: "rollNumber cannot be changed because it has active examination records.",
    });
    expect(details[1]).toEqual({
      field: "classId",
      code: "locked",
      message: "classId cannot be changed because it has active examination records.",
    });
  });

  it("formats informative locked deletion message with dependency counts", () => {
    const message = lockedDeleteMessage("Academic Year", {
      "Fee Vouchers": 45,
      "Salary Ledgers": 12,
      "Exam Results": 0,
    });

    expect(message).toContain("Academic Year cannot be deleted");
    expect(message).toContain("45 Fee Vouchers");
    expect(message).toContain("12 Salary Ledgers");
    expect(message).not.toContain("0 Exam Results");
  });

  it("formats locked update message accurately", () => {
    const message = lockedUpdateMessage("Fee Category", "vouchers have already been disbursed");
    expect(message).toBe("Fee Category cannot be edited because vouchers have already been disbursed.");
  });

  it("generates an integrity violation HTTP response", async () => {
    const details = [{ field: "code", code: "locked", message: "Code cannot be changed" }];
    const res = integrityViolation("Record is locked", details);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe(true);
    expect(json.message).toBe("Record is locked");
    expect(json.details).toEqual(details);
  });
});
