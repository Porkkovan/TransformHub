import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// We test the API route handlers directly by importing them as functions.
// We mock the global `fetch` that these route handlers use internally to
// proxy requests to the agent-service.
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Set the AGENT_SERVICE_URL for deterministic test behavior
vi.stubEnv("AGENT_SERVICE_URL", "http://agent-service:8000");

// Import route handlers after env is set
import { GET as listGET, POST as listPOST } from "../approvals/route";
import { GET as detailGET, POST as detailPOST } from "../approvals/[id]/route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function makeParamsPromise(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/approvals (list)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("proxies to agent-service and returns JSON on success", async () => {
    const mockData = [
      { id: "appr-1", status: "PENDING", gate_name: "review" },
      { id: "appr-2", status: "APPROVED", gate_name: "deploy" },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const req = makeRequest("http://localhost:3000/api/approvals");
    const res = await listGET(req);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent-service:8000/api/v1/approvals"
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual(mockData);
  });

  it("forwards query parameters to agent-service", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const req = makeRequest(
      "http://localhost:3000/api/approvals?status=PENDING&execution_id=exec-1"
    );
    const res = await listGET(req);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent-service:8000/api/v1/approvals?status=PENDING&execution_id=exec-1"
    );
    expect(res.status).toBe(200);
  });

  it("returns upstream error status when agent-service returns non-ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: "Not found" }),
    });

    const req = makeRequest("http://localhost:3000/api/approvals");
    const res = await listGET(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("returns 500 when the upstream fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    const req = makeRequest("http://localhost:3000/api/approvals");
    const res = await listGET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch approvals");
  });

  it("handles upstream non-JSON error response gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("Not JSON");
      },
    });

    const req = makeRequest("http://localhost:3000/api/approvals");
    const res = await listGET(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch approvals");
  });
});

describe("POST /api/approvals (create)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("proxies the request body to agent-service and returns created approval", async () => {
    const requestBody = {
      execution_id: "exec-200",
      gate_name: "budget_review",
      agent_type: "fiduciary",
      data_for_review: { budget: 100000 },
    };

    const mockResponse = {
      id: "appr-new",
      ...requestBody,
      status: "PENDING",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const req = makeRequest("http://localhost:3000/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const res = await listPOST(req);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent-service:8000/api/v1/approvals",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("appr-new");
    expect(body.status).toBe("PENDING");
  });

  it("returns upstream error when agent-service rejects creation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Missing required fields" }),
    });

    const req = makeRequest("http://localhost:3000/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await listPOST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing required fields");
  });

  it("returns 500 when upstream throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));

    const req = makeRequest("http://localhost:3000/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gate_name: "test" }),
    });

    const res = await listPOST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create approval");
  });
});

describe("GET /api/approvals/[id] (detail)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("fetches a single approval by id", async () => {
    const mockApproval = {
      id: "appr-detail",
      status: "PENDING",
      gate_name: "final_review",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockApproval,
    });

    const req = makeRequest("http://localhost:3000/api/approvals/appr-detail");
    const res = await detailGET(req, makeParamsPromise("appr-detail"));

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent-service:8000/api/v1/approvals/appr-detail"
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("appr-detail");
  });

  it("returns 404 when approval not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: "Not found" }),
    });

    const req = makeRequest(
      "http://localhost:3000/api/approvals/appr-nonexistent"
    );
    const res = await detailGET(req, makeParamsPromise("appr-nonexistent"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("returns 500 when upstream throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const req = makeRequest("http://localhost:3000/api/approvals/appr-err");
    const res = await detailGET(req, makeParamsPromise("appr-err"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to get approval");
  });
});

describe("POST /api/approvals/[id] (approve/reject)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("defaults to approve when no action is specified", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "APPROVED" }),
    });

    const req = makeRequest("http://localhost:3000/api/approvals/appr-1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewer_id: "user-1",
        note: "LGTM",
      }),
    });

    const res = await detailPOST(req, makeParamsPromise("appr-1"));

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent-service:8000/api/v1/approvals/appr-1/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reviewer_id: "user-1", note: "LGTM" }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("APPROVED");
  });

  it("routes to approve endpoint when action is 'approve'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "APPROVED" }),
    });

    const req = makeRequest("http://localhost:3000/api/approvals/appr-2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approve",
        reviewer_id: "user-2",
        note: "All clear",
      }),
    });

    const res = await detailPOST(req, makeParamsPromise("appr-2"));

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent-service:8000/api/v1/approvals/appr-2/approve",
      expect.anything()
    );
    expect(res.status).toBe(200);
  });

  it("routes to reject endpoint when action is 'reject'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "REJECTED" }),
    });

    const req = makeRequest("http://localhost:3000/api/approvals/appr-3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reject",
        reviewer_id: "user-3",
        note: "Compliance issues",
      }),
    });

    const res = await detailPOST(req, makeParamsPromise("appr-3"));

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent-service:8000/api/v1/approvals/appr-3/reject",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          reviewer_id: "user-3",
          note: "Compliance issues",
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("REJECTED");
  });

  it("passes empty string for note when omitted", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "APPROVED" }),
    });

    const req = makeRequest("http://localhost:3000/api/approvals/appr-4", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approve",
        reviewer_id: "user-4",
      }),
    });

    const res = await detailPOST(req, makeParamsPromise("appr-4"));

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent-service:8000/api/v1/approvals/appr-4/approve",
      expect.objectContaining({
        body: JSON.stringify({ reviewer_id: "user-4", note: "" }),
      })
    );
    expect(res.status).toBe(200);
  });

  it("returns upstream error when agent-service rejects the action", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ detail: "Gate already resolved" }),
    });

    const req = makeRequest("http://localhost:3000/api/approvals/appr-5", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approve",
        reviewer_id: "user-5",
      }),
    });

    const res = await detailPOST(req, makeParamsPromise("appr-5"));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Gate already resolved");
  });

  it("returns 500 when upstream throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("service down"));

    const req = makeRequest("http://localhost:3000/api/approvals/appr-6", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approve",
        reviewer_id: "user-6",
      }),
    });

    const res = await detailPOST(req, makeParamsPromise("appr-6"));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to process approval");
  });
});
