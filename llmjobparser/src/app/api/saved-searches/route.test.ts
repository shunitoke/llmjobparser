import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  db: null,
}));

describe("saved-searches API", () => {
  it("should return 503 when database is not configured", async () => {
    const { GET } = await import("./route");
    const request = new Request(
      "http://localhost/api/saved-searches?userId=test-id",
    );
    const response = await GET(request);

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toBe("Database not configured");
  });
});
