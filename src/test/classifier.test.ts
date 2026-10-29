import { describe, expect, it } from "vitest";

import { classifyText } from "@/lib/mock/classifier";

describe("mock hybrid classifier", () => {
  it("routes a DB timeout to the Regex stage as a Database Error", () => {
    const r = classifyText("ERROR Connection to DB timed out after 30s");
    expect(r.classified_by).toBe("Regex");
    expect(r.category).toBe("Database Error");
  });

  it("classifies repeated failed logins as a High Login Failure", () => {
    const r = classifyText("Failed login attempt from 192.168.4.22 x5");
    expect(r.category).toBe("Login Failure");
    expect(r.severity).toBe("High");
  });

  it("sends the CRM escalation log to the LLM fallback as a Workflow Error", () => {
    const r = classifyText("Escalation rule execution failed for ticket ID 9807 - undefined escalation level.");
    expect(r.classified_by).toBe("LLM");
    expect(r.category).toBe("Workflow Error");
  });

  it("flags an unrecognised log as an Unknown anomaly decided by DBSCAN", () => {
    const r = classifyText("WARN Checksum drift on shard ζ-7: entropy pool exhausted, quorum vote inconclusive");
    expect(r.classified_by).toBe("DBSCAN");
    expect(r.is_known).toBe(false);
  });

  it("classifies the Hadoop RM contact error with BERT+LogReg", () => {
    const r = classifyText(
      "2015-10-18 18:07:56,238 ERROR [RMCommunicator Allocator] org.apache.hadoop.mapreduce.v2.app.rm.RMContainerAllocator: ERROR IN CONTACTING RM.",
    );
    expect(r.classified_by).toBe("BERT+LogReg");
    expect(r.category).toBe("API Failure");
  });
});
